/**
 * PredictionHistory — Prediction Accuracy Foundation (Phase 4A)
 *
 * Purpose:
 *   Immutable prediction audit log. Each document is a snapshot of what the
 *   engine predicted at `computedAt`, stored BEFORE the outcome is known.
 *   Validation fields (actualState*, accuracy metrics) are filled in
 *   retrospectively by the PredictionValidationWorker (Phase 4B).
 *
 * Design Decisions:
 *   - Separate collection (NOT sub-document on Trend) — rationale:
 *       1. One trend produces many predictions over its lifecycle (every score run).
 *       2. Sub-document growth would bloat the hot Trend document.
 *       3. Independent TTL index can auto-expire old records without touching Trend.
 *       4. Aggregation pipelines for accuracy statistics stay off the hot path.
 *
 *   - `trendId` is a String FK (not ObjectId ref) — matches existing Trend.trendId
 *     convention throughout the codebase.
 *
 *   - All accuracy fields default to null to distinguish "not yet evaluated"
 *     from a genuine 0.0 score.
 *
 *   - brierScore: lower = better (0.0 = perfect, 1.0 = worst). Stored as-is.
 *   - lifecycleAccuracy: 1.0 = exact match, 0.0 = opposite end of state sequence.
 *   - geoF1Score: harmonic mean of geo precision/recall (0.0–1.0).
 *   - temporalMAE: Mean Absolute Error of timeLagHours prediction, in hours.
 */

const mongoose = require('mongoose');

// ─── Predicted Region Snapshot ───────────────────────────────────────────────
// Frozen copy of what was predicted — must NOT be mutated during validation.
const predictedRegionSchema = new mongoose.Schema({
    country:      { type: String, required: true },
    state:        { type: String, default: '' },
    probability:  { type: Number, required: true, min: 0, max: 1 },
    timeLagHours: { type: Number, required: true, min: 0 }
}, { _id: false });

// ─── Actual Region Observation ────────────────────────────────────────────────
// Populated by PredictionValidationWorker from live geo data.
const actualRegionSchema = new mongoose.Schema({
    country:         { type: String, required: true },
    state:           { type: String, default: '' },
    observedAt:      { type: Date },              // when activity was actually detected
    actualTimeLag:   { type: Number, default: null } // real hours from computedAt
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────
const predictionHistorySchema = new mongoose.Schema({

    // ── Identity ────────────────────────────────────────────────────────────
    trendId:        { type: String, required: true, index: true },
    // Human-readable title snapshot — avoids join when reading history logs
    trendTitle:     { type: String, default: '' },
    trendCategory:  { type: String, default: '' },

    // ── Prediction Snapshot (frozen at computedAt) ────────────────────────
    predictedState:  {
        type: String,
        required: true,
        enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead']
    },
    confidenceScore: { type: Number, required: true, min: 0, max: 1 },
    rawConfidence:   { type: Number, default: null },
    computedAt:      { type: Date, required: true, index: true },

    // Scoring context at time of prediction
    compositScoreAtPrediction: { type: Number, default: 0 },
    velocityAtPrediction:      { type: Number, default: 0 },

    // Historical calibration inputs
    matchedTrendId:  { type: String, default: null },
    matchProfile:    { type: Number, default: 0 },   // 0–100 keyword overlap %
    historicalPeak:  { type: Number, default: 0 },

    // Regional propagation predictions (frozen snapshot)
    predictedRegions: { type: [predictedRegionSchema], default: [] },

    // Prediction justification text (for audit trail)
    predictionJustification: { type: String, default: '' },

    // ── Validation Windows ────────────────────────────────────────────────
    // Actual lifecycle state observed at each window.
    // null = not yet evaluated (window hasn't elapsed or worker hasn't run).
    actualState24h: {
        type: String,
        enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead', null],
        default: null
    },
    actualState72h: {
        type: String,
        enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead', null],
        default: null
    },
    actualState7d: {
        type: String,
        enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead', null],
        default: null
    },

    // Actual regions where trend was observed (for geo F1 calculation)
    actualRegions: { type: [actualRegionSchema], default: [] },

    // ── Accuracy Metrics (all null until evaluated) ───────────────────────
    /**
     * lifecycleAccuracy: Ordinal distance score.
     * State sequence: emerging(0) → accelerating(1) → viral(2) → declining(3) → dead(4)
     * Score = 1 - (|predictedOrdinal - actualOrdinal| / 4)
     * 1.0 = exact, 0.75 = one step off, 0.0 = opposite ends.
     * Computed from primaryWindow (24h by default).
     */
    lifecycleAccuracy: { type: Number, default: null, min: 0, max: 1 },

    /**
     * geoF1Score: Harmonic mean of geo precision and recall.
     * precision = |predictedRegions ∩ actualRegions| / |predictedRegions|
     * recall    = |predictedRegions ∩ actualRegions| / |actualRegions|
     * Match threshold: country must match; state match earns +0.5 bonus weight.
     * Range: 0.0 (no overlap) to 1.0 (perfect overlap).
     */
    geoF1Score: { type: Number, default: null, min: 0, max: 1 },

    /**
     * temporalMAE: Mean Absolute Error of time-lag predictions, in hours.
     * For each region that was correctly predicted, MAE = |predictedTimeLag - actualTimeLag|.
     * Averaged across all matched regions.
     * Lower = better. null if no geo matches to evaluate.
     */
    temporalMAE: { type: Number, default: null, min: 0 },

    /**
     * brierScore: Probabilistic calibration metric for the predicted confidence.
     * Formula: (confidenceScore - outcomeWasCorrect)^2
     * outcomeWasCorrect = 1 if predictedState === actualState24h, else 0.
     * Range: 0.0 (perfect calibration) to 1.0 (worst calibration).
     */
    brierScore: { type: Number, default: null, min: 0, max: 1 },

    // Timestamp when the validation worker last ran for this prediction
    evaluatedAt: { type: Date, default: null },

    // Which validation windows have been completed
    evaluated24h: { type: Boolean, default: false },
    evaluated72h: { type: Boolean, default: false },
    evaluated7d:  { type: Boolean, default: false },

    // ── Shadow Mode Rollout (Phase 4C.1) ──────────────────────────────────
    shadowPredictedState:    { type: String, enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead', null], default: null },
    shadowLifecycleAccuracy: { type: Number, default: null, min: 0, max: 1 },
    shadowBrierScore:        { type: Number, default: null, min: 0, max: 1 },

    // ── Engine Metadata ───────────────────────────────────────────────────
    // Tracks which engine version produced this prediction (for model drift detection)
    engineVersion: { type: String, default: '1.0.0' }

}, {
    timestamps: true,  // createdAt = when record was inserted (may differ from computedAt)
    collection: 'predictionhistories'
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query: all predictions for a trend, newest first
predictionHistorySchema.index({ trendId: 1, computedAt: -1 });

// Validation worker query: find records needing 24h/72h/7d evaluation
predictionHistorySchema.index({ evaluated24h: 1, computedAt: 1 });
predictionHistorySchema.index({ evaluated72h: 1, computedAt: 1 });
predictionHistorySchema.index({ evaluated7d:  1, computedAt: 1 });

// Accuracy analytics: aggregate by predicted state across time ranges
predictionHistorySchema.index({ predictedState: 1, computedAt: -1 });

// Category-level accuracy aggregations
predictionHistorySchema.index({ trendCategory: 1, computedAt: -1 });

// Compound: find unevaluated predictions older than N hours (worker scan pattern)
predictionHistorySchema.index({ evaluated24h: 1, evaluated72h: 1, evaluated7d: 1, computedAt: 1 });

// TTL: auto-expire prediction records older than 90 days
// Keeps collection lean; accuracy aggregates are derived during window evaluation
predictionHistorySchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }  // 90 days
);

// ─── Static Helper ────────────────────────────────────────────────────────────

/**
 * Convert lifecycle state string to ordinal integer for distance computation.
 * Used by the validation worker to compute lifecycleAccuracy.
 */
predictionHistorySchema.statics.stateOrdinal = function(state) {
    const MAP = {
        'emerging':     0,
        'accelerating': 1,
        'viral':        2,
        'declining':    3,
        'dead':         4
    };
    return MAP[state] ?? -1;
};

/**
 * Compute lifecycleAccuracy from predicted and actual state strings.
 * Returns null if either state is unknown.
 */
predictionHistorySchema.statics.computeLifecycleAccuracy = function(predictedState, actualState) {
    const predOrd = this.stateOrdinal(predictedState);
    const actOrd  = this.stateOrdinal(actualState);
    if (predOrd === -1 || actOrd === -1) return null;
    return parseFloat((1 - (Math.abs(predOrd - actOrd) / 4)).toFixed(4));
};

/**
 * Compute Brier Score from confidence and binary outcome.
 * @param {number} confidenceScore  — 0.0 to 1.0
 * @param {boolean} wasCorrect      — true if predictedState === actualState
 */
predictionHistorySchema.statics.computeBrierScore = function(confidenceScore, wasCorrect) {
    const outcome = wasCorrect ? 1.0 : 0.0;
    return parseFloat(Math.pow(confidenceScore - outcome, 2).toFixed(4));
};

module.exports = mongoose.model('PredictionHistory', predictionHistorySchema);
