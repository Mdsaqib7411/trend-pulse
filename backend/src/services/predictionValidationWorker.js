/**
 * PredictionValidationWorker — Phase 4B
 *
 * Retrospectively evaluates historical predictions by comparing what was
 * predicted against what actually happened, computing accuracy metrics
 * for each validation window (24h, 72h, 7d).
 *
 * Execution model:
 *   - Runs as a node-cron scheduled job (every 15 minutes via intelligenceScheduler.js)
 *   - Three independent scan passes per run: 24h, 72h, 7d
 *   - Each pass finds PredictionHistory documents where the window has elapsed
 *     but has not yet been evaluated, then fills in actual states + accuracy metrics
 *   - Geo F1 and temporal MAE are computed from actualRegions populated by geo data
 *
 * Safety:
 *   - `BATCH_SIZE` per pass caps MongoDB write volume per run
 *   - Overlap guard in scheduler prevents concurrent runs
 *   - All writes use `{ new: false }` to avoid thundering herd
 *   - Non-fatal: any single record failure is caught and logged, scan continues
 *
 * Accuracy Metrics Computed:
 *   - lifecycleAccuracy  — ordinal distance (0.0–1.0, 1.0 = exact match)
 *   - brierScore         — probabilistic calibration (0.0 = perfect, 1.0 = worst)
 *   - geoF1Score         — harmonic mean of geo precision/recall (requires actualRegions)
 *   - temporalMAE        — mean absolute error of time-lag predictions, in hours
 */

'use strict';

const Trend = require('../models/Trend');
const PredictionHistory = require('../models/PredictionHistory');
const logger = require('./loggerService');

// ─── Configuration ────────────────────────────────────────────────────────────

const WINDOW_MS = {
    '24h': 24 * 60 * 60 * 1000,
    '72h': 72 * 60 * 60 * 1000,
    '7d':  7  * 24 * 60 * 60 * 1000
};

// Max records processed per window per run — prevents long-blocking DB operations
const BATCH_SIZE = 50;

// Geo match requires at minimum a country match
const GEO_COUNTRY_WEIGHT = 1.0;
const GEO_STATE_BONUS    = 0.5;  // state match earns additional weight


class PredictionValidationWorker {

    // ─── Entry Point ──────────────────────────────────────────────────────────

    /**
     * Main run method — executes all three validation passes.
     * Called by intelligenceScheduler.js every 15 minutes.
     *
     * @returns {{ processed24h, processed72h, processed7d }} — counts per window
     */
    async run() {
        const results = { processed24h: 0, processed72h: 0, processed7d: 0 };

        try {
            results.processed24h = await this._evaluateWindow('24h');
        } catch (err) {
            logger.error('[ValidationWorker] 24h pass failed: %s', err.message);
        }

        try {
            results.processed72h = await this._evaluateWindow('72h');
        } catch (err) {
            logger.error('[ValidationWorker] 72h pass failed: %s', err.message);
        }

        try {
            results.processed7d = await this._evaluateWindow('7d');
        } catch (err) {
            logger.error('[ValidationWorker] 7d pass failed: %s', err.message);
        }

        const total = results.processed24h + results.processed72h + results.processed7d;
        if (total > 0) {
            logger.info(
                '[ValidationWorker] Run complete — 24h:%d 72h:%d 7d:%d',
                results.processed24h, results.processed72h, results.processed7d
            );
        }

        return results;
    }


    // ─── Window Evaluation Pass ───────────────────────────────────────────────

    /**
     * Finds PredictionHistory records where:
     *   1. The validation window has elapsed (computedAt + windowMs <= now)
     *   2. The window flag (evaluated24h/72h/7d) is still false
     *
     * For each record, fetches the current lifecycle state from the Trend
     * document and computes all applicable accuracy metrics.
     *
     * @param {'24h'|'72h'|'7d'} windowKey
     * @returns {number} count of records evaluated
     */
    async _evaluateWindow(windowKey) {
        // Static map ensures exact field name match with the Mongoose schema.
        // replace('h','H') produces 'evaluated24H' not 'evaluated24h' — fixed here.
        const FIELD_MAP = {
            '24h': { flagField: 'evaluated24h', stateField: 'actualState24h' },
            '72h': { flagField: 'evaluated72h', stateField: 'actualState72h' },
            '7d':  { flagField: 'evaluated7d',  stateField: 'actualState7d'  }
        };
        const { flagField, stateField } = FIELD_MAP[windowKey];
        const windowMs = WINDOW_MS[windowKey];
        const cutoff   = new Date(Date.now() - windowMs);

        // Find unevaluated records where the window has elapsed
        const records = await PredictionHistory.find({
            [flagField]:  false,
            computedAt:  { $lte: cutoff }
        })
        .sort({ computedAt: 1 })  // oldest first — ensures FIFO evaluation
        .limit(BATCH_SIZE)
        .lean()
        .maxTimeMS(5000);

        if (records.length === 0) return 0;

        // Batch-fetch all referenced Trend documents in one query
        const trendIds = [...new Set(records.map(r => r.trendId))];
        const trends = await Trend.find(
            { trendId: { $in: trendIds } },
            {
                trendId: 1,
                'predictions.lifecycleState': 1,
                'predictions.predictedRegions': 1,
                trendScore: 1
            }
        ).lean().maxTimeMS(5000);

        // Index by trendId for O(1) lookup
        const trendMap = {};
        for (const t of trends) {
            trendMap[t.trendId] = t;
        }

        let processed = 0;

        for (const record of records) {
            try {
                const trend = trendMap[record.trendId];
                const actualState = trend?.predictions?.lifecycleState || null;

                // Build update payload
                const update = {
                    [stateField]: actualState,
                    [flagField]:  true,
                    evaluatedAt:  new Date()
                };

                // ── Lifecycle Accuracy ─────────────────────────────────────
                if (actualState && windowKey === '24h') {
                    // Primary accuracy metric: computed on first window (24h)
                    update.lifecycleAccuracy = PredictionHistory.computeLifecycleAccuracy(
                        record.predictedState,
                        actualState
                    );

                    // ── Brier Score ────────────────────────────────────────
                    const wasCorrect = record.predictedState === actualState;
                    update.brierScore = PredictionHistory.computeBrierScore(
                        record.confidenceScore,
                        wasCorrect
                    );

                    // ── Shadow Mode Accuracy (Phase 4C.1) ──────────────────
                    if (record.shadowPredictedState) {
                        update.shadowLifecycleAccuracy = PredictionHistory.computeLifecycleAccuracy(
                            record.shadowPredictedState,
                            actualState
                        );
                        const shadowWasCorrect = record.shadowPredictedState === actualState;
                        update.shadowBrierScore = PredictionHistory.computeBrierScore(
                            record.confidenceScore,
                            shadowWasCorrect
                        );
                    }
                }

                // ── Geo Metrics ────────────────────────────────────────────
                // Only compute on 24h window if actualRegions are present.
                // actualRegions are populated from geo monitoring (Phase 4C+)
                // or can be populated manually for testing.
                if (windowKey === '24h' && record.actualRegions && record.actualRegions.length > 0) {
                    const geoMetrics = this._computeGeoMetrics(
                        record.predictedRegions || [],
                        record.actualRegions || []
                    );
                    update.geoF1Score  = geoMetrics.f1Score;
                    update.temporalMAE = geoMetrics.temporalMAE;
                }

                // Write evaluation result
                await PredictionHistory.updateOne(
                    { _id: record._id },
                    { $set: update }
                ).maxTimeMS(3000);

                processed++;

            } catch (recordErr) {
                logger.warn(
                    '[ValidationWorker] Failed to evaluate record %s (trend: %s): %s',
                    record._id, record.trendId, recordErr.message
                );
                // Continue — do not abort the entire pass for one bad record
            }
        }

        return processed;
    }


    // ─── Geo Accuracy Computation ─────────────────────────────────────────────

    /**
     * Computes geoF1Score and temporalMAE from predicted vs actual region arrays.
     *
     * Matching logic:
     *   - A predicted region "matches" an actual region if country is identical.
     *   - State match earns a weight bonus (GEO_STATE_BONUS = 0.5).
     *   - Weighted precision and recall are used for F1 to reward state precision.
     *
     * temporalMAE:
     *   - Computed only for matched region pairs where actualTimeLag is recorded.
     *   - If no valid lag pairs, returns null.
     *
     * @param {Array} predictedRegions — from PredictionHistory.predictedRegions
     * @param {Array} actualRegions    — from PredictionHistory.actualRegions
     * @returns {{ f1Score: number|null, temporalMAE: number|null }}
     */
    _computeGeoMetrics(predictedRegions, actualRegions) {
        if (predictedRegions.length === 0 || actualRegions.length === 0) {
            return { f1Score: null, temporalMAE: null };
        }

        let weightedMatches = 0;
        const temporalErrors = [];

        for (const predicted of predictedRegions) {
            for (const actual of actualRegions) {
                if (predicted.country !== actual.country) continue;

                // Country match found
                let matchWeight = GEO_COUNTRY_WEIGHT;

                // Bonus for state match (both must have a non-empty state)
                if (
                    predicted.state &&
                    actual.state &&
                    predicted.state === actual.state
                ) {
                    matchWeight += GEO_STATE_BONUS;
                }

                weightedMatches += matchWeight;

                // Temporal error: only if actual time lag was recorded
                if (
                    typeof actual.actualTimeLag === 'number' &&
                    actual.actualTimeLag !== null &&
                    typeof predicted.timeLagHours === 'number'
                ) {
                    temporalErrors.push(
                        Math.abs(predicted.timeLagHours - actual.actualTimeLag)
                    );
                }

                break; // Take first country match per predicted region
            }
        }

        // Weighted precision and recall
        const totalPredictedWeight = predictedRegions.length * GEO_COUNTRY_WEIGHT;
        const totalActualWeight    = actualRegions.length    * GEO_COUNTRY_WEIGHT;

        const precision = totalPredictedWeight > 0
            ? weightedMatches / totalPredictedWeight
            : 0;
        const recall = totalActualWeight > 0
            ? weightedMatches / totalActualWeight
            : 0;

        const f1Score = (precision + recall) > 0
            ? parseFloat((2 * precision * recall / (precision + recall)).toFixed(4))
            : 0;

        const temporalMAE = temporalErrors.length > 0
            ? parseFloat((temporalErrors.reduce((a, b) => a + b, 0) / temporalErrors.length).toFixed(2))
            : null;

        return { f1Score, temporalMAE };
    }


    // ─── Accuracy Statistics Aggregation ─────────────────────────────────────

    /**
     * Computes aggregate accuracy statistics across all evaluated predictions.
     * Used by the system intelligence stats endpoint and future dashboard.
     *
     * Aggregates:
     *   - meanLifecycleAccuracy   — average lifecycleAccuracy across all evaluated records
     *   - meanBrierScore          — average Brier score (lower = better calibration)
     *   - meanGeoF1               — average geoF1 where geo data was available
     *   - meanTemporalMAE         — average temporal MAE in hours
     *   - exactMatchRate          — % where predictedState === actualState24h
     *   - totalEvaluated          — total records with at least 24h evaluation
     *   - byState                 — per-predicted-state breakdown
     *   - byCategory              — per-category breakdown
     *
     * @param {{ days?: number, category?: string }} opts
     * @returns {Object} aggregated accuracy stats
     */
    async getAccuracyStats(opts = {}) {
        const { days = 30, category = null } = opts;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const matchStage = {
            evaluated24h: true,
            computedAt:   { $gte: since }
        };
        if (category) matchStage.trendCategory = category;

        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalEvaluated:        { $sum: 1 },
                    meanLifecycleAccuracy: { $avg: '$lifecycleAccuracy' },
                    meanBrierScore:        { $avg: '$brierScore' },
                    meanGeoF1:             { $avg: '$geoF1Score' },
                    meanTemporalMAE:       { $avg: '$temporalMAE' },
                    exactMatches: {
                        $sum: {
                            $cond: [
                                { $eq: ['$predictedState', '$actualState24h'] },
                                1, 0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalEvaluated:        1,
                    meanLifecycleAccuracy: { $round: ['$meanLifecycleAccuracy', 4] },
                    meanBrierScore:        { $round: ['$meanBrierScore', 4] },
                    meanGeoF1:             { $round: ['$meanGeoF1', 4] },
                    meanTemporalMAE:       { $round: ['$meanTemporalMAE', 2] },
                    exactMatchRate: {
                        $round: [
                            { $multiply: [
                                { $divide: ['$exactMatches', { $max: ['$totalEvaluated', 1] }] },
                                100
                            ]},
                            1
                        ]
                    }
                }
            }
        ];

        // Per-state breakdown
        // Mongoose 9: maxTimeMS must be passed as aggregate option, not chained.
        const stateBreakdown = await PredictionHistory.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$predictedState',
                    count:            { $sum: 1 },
                    meanAccuracy:     { $avg: '$lifecycleAccuracy' },
                    meanBrierScore:   { $avg: '$brierScore' },
                    exactMatchCount:  {
                        $sum: {
                            $cond: [
                                { $eq: ['$predictedState', '$actualState24h'] },
                                1, 0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    state:         '$_id',
                    count:         1,
                    meanAccuracy:  { $round: ['$meanAccuracy', 4] },
                    meanBrierScore:{ $round: ['$meanBrierScore', 4] },
                    exactMatchRate: {
                        $round: [
                            { $multiply: [
                                { $divide: ['$exactMatchCount', { $max: ['$count', 1] }] },
                                100
                            ]},
                            1
                        ]
                    },
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ], { maxTimeMS: 5000 });

        const [summary] = await PredictionHistory.aggregate(pipeline, { maxTimeMS: 5000 });

        return {
            ...(summary || {
                totalEvaluated: 0,
                meanLifecycleAccuracy: null,
                meanBrierScore: null,
                meanGeoF1: null,
                meanTemporalMAE: null,
                exactMatchRate: null
            }),
            byState:   stateBreakdown,
            windowDays: days,
            generatedAt: new Date().toISOString()
        };
    }
}

module.exports = new PredictionValidationWorker();
