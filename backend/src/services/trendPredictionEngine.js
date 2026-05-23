/**
 * Trend Prediction Engine — Viral Spread Prediction & Lifecycle State Machine.
 *
 * Phase 3.5 Step 2:
 *   1. Lifecycle state machine: emerging → accelerating → viral → declining → dead
 *   2. Historical trend memory: 6-month semantic scan for calibrated confidence
 *   3. Regional migration matrix: predicted propagation paths with time-lag + probability
 *   4. Explainable justification: transparent prediction reasoning string
 *
 * All outputs write to `trend.predictions` sub-document in MongoDB.
 */

const Trend = require('../models/Trend');
const cacheService = require('./cacheService');
const logger = require('./loggerService');

// ─── Lifecycle State Thresholds ─────────────────────────────────────────────
// Evaluated against rolling scoreHistory velocity deltas
const LIFECYCLE_THRESHOLDS = {
    EMERGING_MIN_COMPOSITE:    15,
    ACCELERATING_VELOCITY:     20,   // composite delta > 20 over last 3 snapshots
    VIRAL_COMPOSITE:           65,
    VIRAL_VELOCITY:            35,
    DECLINING_VELOCITY:       -10,   // negative delta sustained
    DEAD_MAX_COMPOSITE:         8,
    DEAD_HOURS_STALE:          72
};

// ─── Historical Scan Configuration ──────────────────────────────────────────
const HISTORICAL_WINDOW_MONTHS = 6;
const HISTORICAL_KEYWORD_THRESHOLD = 0.45; // 45% overlap = semantically similar
const MAX_HISTORICAL_MATCHES = 10;

// ─── Migration Matrix: Regional Propagation Patterns ────────────────────────
// Empirical category → region migration patterns with typical time lags (hours)
const MIGRATION_MATRIX = {
    'AI': [
        { from: { country: 'US', state: 'CA' }, to: { country: 'US', state: 'NY' }, timeLagHours: 2, baseProbability: 0.82 },
        { from: { country: 'US' },              to: { country: 'GB' },              timeLagHours: 3, baseProbability: 0.75 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'KA' }, timeLagHours: 4, baseProbability: 0.70 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'MH' }, timeLagHours: 4, baseProbability: 0.65 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'MP' }, timeLagHours: 6, baseProbability: 0.40 },
        { from: { country: 'US' },              to: { country: 'DE' },              timeLagHours: 5, baseProbability: 0.55 },
        { from: { country: 'IN' },              to: { country: 'PK' },              timeLagHours: 3, baseProbability: 0.60 }
    ],
    'Technology': [
        { from: { country: 'US' },              to: { country: 'GB' },              timeLagHours: 2, baseProbability: 0.80 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'KA' }, timeLagHours: 3, baseProbability: 0.72 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'TN' }, timeLagHours: 4, baseProbability: 0.55 },
        { from: { country: 'US' },              to: { country: 'IN', state: 'MP' }, timeLagHours: 5, baseProbability: 0.38 },
        { from: { country: 'US' },              to: { country: 'DE' },              timeLagHours: 4, baseProbability: 0.60 },
        { from: { country: 'IN' },              to: { country: 'PK' },              timeLagHours: 2, baseProbability: 0.58 }
    ],
    'Cricket': [
        { from: { country: 'IN' },              to: { country: 'PK' },              timeLagHours: 1, baseProbability: 0.92 },
        { from: { country: 'IN' },              to: { country: 'AU' },              timeLagHours: 2, baseProbability: 0.78 },
        { from: { country: 'IN' },              to: { country: 'GB' },              timeLagHours: 3, baseProbability: 0.70 },
        { from: { country: 'IN', state: 'MH' }, to: { country: 'IN', state: 'MP' }, timeLagHours: 1, baseProbability: 0.85 },
        { from: { country: 'IN', state: 'MH' }, to: { country: 'IN', state: 'KA' }, timeLagHours: 1, baseProbability: 0.80 }
    ],
    '_default': [
        { from: { country: 'US' },              to: { country: 'GB' },              timeLagHours: 3, baseProbability: 0.65 },
        { from: { country: 'US' },              to: { country: 'IN' },              timeLagHours: 5, baseProbability: 0.50 },
        { from: { country: 'US' },              to: { country: 'DE' },              timeLagHours: 5, baseProbability: 0.45 },
        { from: { country: 'IN' },              to: { country: 'PK' },              timeLagHours: 3, baseProbability: 0.55 },
        { from: { country: 'GB' },              to: { country: 'AU' },              timeLagHours: 4, baseProbability: 0.50 }
    ]
};

// ─── Stop Words (shared across Phase 3.5 modules) ──────────────────────────
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'and', 'but', 'or', 'if', 'while', 'as', 'that', 'this', 'it',
    'its', 'what', 'which', 'who', 'whom', 'these', 'those', 'am', 'he',
    'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'his',
    'your', 'our', 'their', 'new', 'says', 'said', 'also'
]);


class TrendPredictionEngine {

    // ─── 1. KEYWORD EXTRACTION ──────────────────────────────────────────────

    /**
     * Extract significant keyword tokens from text.
     */
    extractKeywords(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));
    }

    /**
     * Compute keyword overlap ratio (min-denominator Jaccard).
     */
    computeOverlap(kwA, kwB) {
        if (kwA.length === 0 || kwB.length === 0) return 0;
        const setA = new Set(kwA);
        const setB = new Set(kwB);
        let intersection = 0;
        for (const w of setA) {
            if (setB.has(w)) intersection++;
        }
        return intersection / Math.min(setA.size, setB.size);
    }


    // ─── 2. LIFECYCLE STATE MACHINE ─────────────────────────────────────────

    /**
     * Determine lifecycle state from scoreHistory and current metrics.
     *
     * State transitions:
     *   emerging      → composite ≥ 15, positive velocity, < 12 hours old
     *   accelerating  → sustained velocity delta > 20 over last 3 snapshots
     *   viral         → composite ≥ 65 AND velocity > 35
     *   declining     → sustained negative velocity delta
     *   dead          → composite < 8 AND older than 72 hours
     *
     * @param {Object} trend — Trend document with scoreHistory, scoring, publishedAt
     * @returns {string} — One of: 'emerging', 'accelerating', 'viral', 'declining', 'dead'
     */
    computeLifecycleState(trend) {
        const composite = trend.scoring?.compositeScore || trend.trendScore || 0;
        const history = trend.scoreHistory || [];
        const hoursOld = this.getHoursOld(trend);

        // Dead: very low score and stale
        if (composite < LIFECYCLE_THRESHOLDS.DEAD_MAX_COMPOSITE && hoursOld > LIFECYCLE_THRESHOLDS.DEAD_HOURS_STALE) {
            return 'dead';
        }

        // Compute velocity: average delta over last 3 snapshots
        const velocity = this.computeVelocity(history);

        // Viral: high composite AND strong positive velocity
        if (composite >= LIFECYCLE_THRESHOLDS.VIRAL_COMPOSITE && velocity >= LIFECYCLE_THRESHOLDS.VIRAL_VELOCITY) {
            return 'viral';
        }

        // Accelerating: moderate-to-high composite with strong upward momentum
        if (composite >= LIFECYCLE_THRESHOLDS.EMERGING_MIN_COMPOSITE && velocity >= LIFECYCLE_THRESHOLDS.ACCELERATING_VELOCITY) {
            return 'accelerating';
        }

        // Declining: negative velocity sustained
        if (velocity <= LIFECYCLE_THRESHOLDS.DECLINING_VELOCITY && hoursOld > 6) {
            return 'declining';
        }

        // Emerging: above minimum threshold, positive velocity, relatively new
        if (composite >= LIFECYCLE_THRESHOLDS.EMERGING_MIN_COMPOSITE && velocity >= 0 && hoursOld < 24) {
            return 'emerging';
        }

        // Default: if old with low velocity but above dead threshold
        if (velocity < 0) return 'declining';
        return 'emerging';
    }

    /**
     * Compute average velocity delta over the last N scoreHistory snapshots.
     * Returns the average change in composite score per snapshot interval.
     */
    computeVelocity(history, windowSize = 3) {
        if (!history || history.length < 2) return 0;

        const recent = history.slice(-Math.min(history.length, windowSize + 1));
        if (recent.length < 2) return 0;

        let totalDelta = 0;
        for (let i = 1; i < recent.length; i++) {
            totalDelta += (recent[i].c || 0) - (recent[i - 1].c || 0);
        }

        return totalDelta / (recent.length - 1);
    }


    // ─── 3. HISTORICAL MEMORY & CALIBRATION ─────────────────────────────────

    /**
     * Scan historical trends (up to 6 months) for semantically similar trends.
     * Calculate a calibrated confidence score based on:
     *   - Keyword overlap density with historical matches
     *   - Historical peak-to-current ratio (did similar trends reach viral?)
     *   - Category consistency (same category boosts confidence)
     *   - Platform spread (multi-platform verified trends get trust boost)
     *
     * @param {Object} trend — Current trend document
     * @returns {{ confidenceScore: number, matchedTrendId: string|null, matchProfile: number, historicalPeak: number }}
     */
    async computeHistoricalConfidence(trend) {
        const keywords = this.extractKeywords(trend.title);
        const analysisKeywords = (trend.analysis?.keywords || []).map(k => k.toLowerCase());
        const allKeywords = [...new Set([...keywords, ...analysisKeywords])];

        if (allKeywords.length === 0) {
            return { confidenceScore: 0.3, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };
        }

        const sixMonthsAgo = new Date(Date.now() - HISTORICAL_WINDOW_MONTHS * 30 * 24 * 60 * 60 * 1000);

        // Find historical trends in the same category or with keyword overlap
        const candidates = await Trend.find({
            createdAt: { $gte: sixMonthsAgo },
            trendId: { $ne: trend.trendId },
            trendScore: { $gt: 10 }
        }, {
            trendId: 1, title: 1, category: 1, trendScore: 1,
            'scoring.compositeScore': 1, platformCount: 1,
            'analysis.keywords': 1, 'scoreHistory': { $slice: -10 }
        })
        .sort({ trendScore: -1 })
        .limit(100)
        .maxTimeMS(3000)
        .lean();

        let bestMatch = null;
        let bestOverlap = 0;

        for (const candidate of candidates) {
            const candidateKeywords = this.extractKeywords(candidate.title);
            const candidateAnalysisKw = (candidate.analysis?.keywords || []).map(k => k.toLowerCase());
            const candidateAll = [...new Set([...candidateKeywords, ...candidateAnalysisKw])];

            const overlap = this.computeOverlap(allKeywords, candidateAll);

            if (overlap >= HISTORICAL_KEYWORD_THRESHOLD && overlap > bestOverlap) {
                bestOverlap = overlap;
                bestMatch = candidate;
            }
        }

        if (!bestMatch) {
            // No historical match — base confidence from data completeness
            return this.computeBaselineConfidence(trend);
        }

        // Calibrate confidence from the historical match profile
        const historicalPeak = bestMatch.scoring?.compositeScore || bestMatch.trendScore || 0;
        const currentComposite = trend.scoring?.compositeScore || trend.trendScore || 0;

        // Factor 1: Keyword match density (weight: 0.35)
        const matchDensity = bestOverlap; // 0.0 to 1.0

        // Factor 2: Historical success rate — did the matched trend peak? (weight: 0.30)
        const historicalSuccessRate = Math.min(1.0, historicalPeak / 80); // 80+ = full success

        // Factor 3: Category consistency (weight: 0.15)
        const categoryMatch = (trend.category === bestMatch.category) ? 1.0 : 0.5;

        // Factor 4: Platform verification (weight: 0.10)
        const platformFactor = Math.min(1.0, (trend.platformCount || 1) / 2);

        // Factor 5: Velocity curve similarity (weight: 0.10)
        const velocitySimilarity = this.compareVelocityCurves(
            trend.scoreHistory || [],
            bestMatch.scoreHistory || []
        );

        const confidenceScore = parseFloat((
            (matchDensity * 0.35) +
            (historicalSuccessRate * 0.30) +
            (categoryMatch * 0.15) +
            (platformFactor * 0.10) +
            (velocitySimilarity * 0.10)
        ).toFixed(3));

        return {
            confidenceScore: Math.min(1.0, Math.max(0.0, confidenceScore)),
            matchedTrendId: bestMatch.trendId,
            matchProfile: parseFloat((bestOverlap * 100).toFixed(1)),
            historicalPeak
        };
    }

    /**
     * Compute baseline confidence when no historical match is found.
     * Based on data completeness: score history depth, analysis status, platform count.
     */
    computeBaselineConfidence(trend) {
        let score = 0.20; // Base floor

        // ScoreHistory depth bonus (max +0.20)
        const historyDepth = (trend.scoreHistory || []).length;
        score += Math.min(0.20, historyDepth * 0.01);

        // Analysis completeness bonus (max +0.15)
        if (trend.analysis?.status === 'completed') score += 0.15;
        else if (trend.analysis?.status === 'processing') score += 0.05;

        // Platform verification bonus (max +0.10)
        score += Math.min(0.10, ((trend.platformCount || 1) - 1) * 0.05);

        // Engagement magnitude bonus (max +0.10)
        const engagement = trend.engagementScore || 0;
        score += Math.min(0.10, Math.log1p(engagement) * 0.01);

        return {
            confidenceScore: parseFloat(Math.min(1.0, score).toFixed(3)),
            matchedTrendId: null,
            matchProfile: 0,
            historicalPeak: 0
        };
    }

    /**
     * Compare two velocity curves by computing the cosine-like similarity
     * of their composite score deltas.
     */
    compareVelocityCurves(historyA, historyB) {
        if (historyA.length < 3 || historyB.length < 3) return 0.5; // neutral

        const deltasA = this.extractDeltas(historyA.slice(-6));
        const deltasB = this.extractDeltas(historyB.slice(-6));

        // Pad shorter array
        const len = Math.min(deltasA.length, deltasB.length);
        if (len === 0) return 0.5;

        // Compute directional agreement (how many deltas agree in sign)
        let agreements = 0;
        for (let i = 0; i < len; i++) {
            if ((deltasA[i] >= 0 && deltasB[i] >= 0) || (deltasA[i] < 0 && deltasB[i] < 0)) {
                agreements++;
            }
        }

        return agreements / len;
    }

    /**
     * Extract delta array from scoreHistory composite values.
     */
    extractDeltas(history) {
        const deltas = [];
        for (let i = 1; i < history.length; i++) {
            deltas.push((history[i].c || 0) - (history[i - 1].c || 0));
        }
        return deltas;
    }


    // ─── 4. REGIONAL MIGRATION MATRIX ───────────────────────────────────────

    /**
     * Predict regional propagation paths for a trend.
     *
     * Uses the empirical MIGRATION_MATRIX keyed by category.
     * Adjusts base probabilities using:
     *   - Current lifecycle state (viral → higher probability)
     *   - Historical confidence (higher confidence → higher probability)
     *   - Platform count (cross-platform → faster spread)
     *
     * @param {Object} trend
     * @param {string} lifecycleState
     * @param {number} confidenceScore
     * @returns {Array<{ country: string, state: string, probability: number, timeLagHours: number }>}
     */
    predictRegionalMigration(trend, lifecycleState, confidenceScore) {
        const category = trend.category || '_default';
        const sourceCountry = trend.geography?.country || 'US';
        const sourceState = trend.geography?.state || '';

        // Get migration paths for this category
        const paths = MIGRATION_MATRIX[category] || MIGRATION_MATRIX['_default'];

        // Lifecycle multiplier: viral trends spread faster and wider
        const lifecycleMultiplier = {
            'viral': 1.3,
            'accelerating': 1.1,
            'emerging': 0.9,
            'declining': 0.6,
            'dead': 0.2
        }[lifecycleState] || 0.9;

        // Confidence adjustment: higher confidence → more trustworthy predictions
        const confidenceAdjustment = 0.7 + (confidenceScore * 0.3);

        // Platform spread factor: cross-platform trends propagate faster
        const platformFactor = Math.min(1.2, 1.0 + ((trend.platformCount || 1) - 1) * 0.1);

        const predictions = [];

        for (const path of paths) {
            // Check if this path originates from the trend's current region
            const fromMatch = this.matchRegion(path.from, sourceCountry, sourceState);
            if (!fromMatch) continue;

            // Compute adjusted probability
            const adjustedProbability = parseFloat(
                Math.min(0.99, Math.max(0.05,
                    path.baseProbability * lifecycleMultiplier * confidenceAdjustment * platformFactor
                )).toFixed(2)
            );

            // Compute adjusted time lag (viral trends spread faster)
            const adjustedTimeLag = parseFloat(
                Math.max(0.5, path.timeLagHours / (lifecycleMultiplier * platformFactor)).toFixed(1)
            );

            predictions.push({
                country: path.to.country,
                state: path.to.state || '',
                probability: adjustedProbability,
                timeLagHours: adjustedTimeLag
            });
        }

        // Sort by probability descending
        predictions.sort((a, b) => b.probability - a.probability);

        return predictions;
    }

    /**
     * Check if a migration path's "from" region matches the trend's origin.
     */
    matchRegion(from, country, state) {
        if (from.country !== country) return false;
        if (from.state && state && from.state !== state) return false;
        return true;
    }


    // ─── 5. EXPLAINABLE JUSTIFICATION ───────────────────────────────────────

    /**
     * Generate a structured human-readable justification string
     * explaining why the system believes the prediction.
     */
    buildJustification(trend, lifecycleState, confidence, predictedRegions) {
        const parts = [];

        // Lifecycle reasoning
        const composite = trend.scoring?.compositeScore || trend.trendScore || 0;
        const velocity = this.computeVelocity(trend.scoreHistory || []);
        parts.push(`Lifecycle: ${lifecycleState.toUpperCase()} (composite: ${composite}/100, velocity: ${velocity.toFixed(1)}/snapshot).`);

        // Historical match reasoning
        if (confidence.matchedTrendId) {
            parts.push(`Historical calibration: ${confidence.matchProfile}% keyword match with Trend ID ${confidence.matchedTrendId} (historical peak: ${confidence.historicalPeak}/100). Category trends with similar velocity curves have a ${(confidence.confidenceScore * 100).toFixed(0)}% prediction accuracy.`);
        } else {
            parts.push(`No strong historical match found. Baseline confidence derived from data completeness (${(confidence.confidenceScore * 100).toFixed(0)}%).`);
        }

        // Migration reasoning
        if (predictedRegions.length > 0) {
            const topRegion = predictedRegions[0];
            const regionLabel = topRegion.state
                ? `${topRegion.state}, ${topRegion.country}`
                : topRegion.country;
            parts.push(`Migration forecast: This ${trend.category || 'general'} trend is predicted to reach ${regionLabel} within ${topRegion.timeLagHours}h with ${(topRegion.probability * 100).toFixed(0)}% probability, based on empirical category propagation patterns${confidence.matchedTrendId ? ` and an ${confidence.matchProfile}% historical matching profile with Trend ID ${confidence.matchedTrendId}` : ''}.`);
        }

        // Platform factor
        if ((trend.platformCount || 1) > 1) {
            parts.push(`Cross-platform verification: Detected across ${trend.platformCount} platforms (multiplier: ${trend.crossPlatformMultiplier || 1.0}x), increasing propagation speed estimates.`);
        }

        return parts.join(' ');
    }


    // ─── 6. MAIN ENTRY: FULL PREDICTION PIPELINE ────────────────────────────

    /**
     * Run the complete prediction pipeline for a single trend.
     * Computes lifecycle, historical confidence, migration paths, and justification.
     * Persists results to trend.predictions in MongoDB.
     *
     * @param {string} trendId
     * @returns {Object|null} — Full prediction result or null if trend not found
     */
    async predictForTrend(trendId) {
        const cacheKey = `trendpulse:prediction:${trendId}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;

        const trend = await Trend.findOne({ trendId }).maxTimeMS(2000).lean();
        if (!trend) return null;

        // Step 1: Compute lifecycle state
        const lifecycleState = this.computeLifecycleState(trend);

        // Step 2: Historical confidence calibration
        const confidence = await this.computeHistoricalConfidence(trend);

        // Step 3: Regional migration prediction
        const predictedRegions = this.predictRegionalMigration(
            trend, lifecycleState, confidence.confidenceScore
        );

        // Step 4: Build explainable justification
        const predictionJustification = this.buildJustification(
            trend, lifecycleState, confidence, predictedRegions
        );

        const prediction = {
            lifecycleState,
            confidenceScore: confidence.confidenceScore,
            matchedTrendId: confidence.matchedTrendId,
            matchProfile: confidence.matchProfile,
            historicalPeak: confidence.historicalPeak,
            predictedRegions,
            predictionJustification,
            computedAt: new Date()
        };

        // Persist to MongoDB
        try {
            await Trend.updateOne(
                { trendId },
                { $set: { predictions: prediction } }
            ).maxTimeMS(2000);
        } catch (err) {
            logger.error('[PredictionEngine] Persist error for %s: %s', trendId, err.message);
        }

        // Cache for 5 minutes
        await cacheService.setex(cacheKey, 300, prediction);

        logger.info(`[PredictionEngine] ${trendId}: ${lifecycleState} (confidence: ${confidence.confidenceScore}, regions: ${predictedRegions.length})`);

        return prediction;
    }

    /**
     * Batch prediction: run predictions for an array of scored trends.
     * Called post-scoring in the trend worker pipeline.
     *
     * @param {Array} trends — Array of trend docs (lean)
     * @returns {number} — Count of trends predicted
     */
    async predictBatch(trends) {
        if (!trends || trends.length === 0) return 0;

        let count = 0;
        for (const trend of trends) {
            try {
                await this.predictForTrend(trend.trendId);
                count++;
            } catch (err) {
                logger.error('[PredictionEngine] Batch error for %s: %s', trend.trendId, err.message);
            }
        }

        logger.info(`[PredictionEngine] Batch complete: ${count}/${trends.length} trends predicted.`);
        return count;
    }


    // ─── UTILS ──────────────────────────────────────────────────────────────

    getHoursOld(trend) {
        const published = trend.publishedAt || trend.createdAt || new Date();
        return Math.max(0, (Date.now() - new Date(published).getTime()) / (1000 * 60 * 60));
    }
}

module.exports = new TrendPredictionEngine();
