/**
 * TrendPulse — Mathematical Trend Scoring Engine
 * 
 * Computes three discrete metrics (0-100): viralScore, heatScore, growthScore.
 * Uses logarithmic time-decay to penalize stale content,
 * and log-normalized engagement to prevent mega-influencer dominance.
 */

const Trend = require('../models/Trend');
const logger = require('./loggerService');

class TrendScoreEngine {

    /**
     * Logarithmic Time-Decay Formula.
     * Score = RawEngagement / Math.pow((HoursSinceCreation + 2), 1.5)
     * 
     * The +2 offset prevents division by zero and gives a 2-hour "grace window"
     * where very new content is not yet penalized harshly.
     */
    computeDecayedEngagement(rawEngagement, hoursSinceCreation) {
        const clampedHours = Math.max(0, hoursSinceCreation);
        return rawEngagement / Math.pow((clampedHours + 2), 1.5);
    }

    /**
     * Log-normalizes a raw value against a dataset maximum.
     * Uses log(1 + x) to compress outlier values (mega-influencer suppression).
     * Returns a value in [0, 100].
     */
    logNormalize(value, maxValue) {
        if (maxValue <= 0 || value <= 0) return 0;
        const normalized = Math.log1p(value) / Math.log1p(maxValue);
        return Math.min(100, Math.round(normalized * 100));
    }

    /**
     * Computes viralScore (0-100).
     * Measures cross-platform engagement acceleration using time-decay.
     * Higher raw engagement + newer publish time = higher viral potential.
     */
    computeViralScore(trend, maxDecayedEngagement) {
        const hoursOld = this.getHoursOld(trend);
        const raw = trend.engagementScore || 0;
        const decayed = this.computeDecayedEngagement(raw, hoursOld);
        return this.logNormalize(decayed, maxDecayedEngagement);
    }

    /**
     * Computes heatScore (0-100).
     * Combines recency with source diversity.
     * A trend appearing on multiple source types (news, reddit, video)
     * within a short timeframe receives an amplified heat signal.
     */
    computeHeatScore(trend, maxHeatRaw) {
        const hoursOld = this.getHoursOld(trend);
        // Recency component: exponential decay over 48 hours
        const recency = Math.exp(-0.05 * hoursOld) * 50;
        // Source type bonus
        const sourceBonus = trend.type === 'video' ? 15 : trend.type === 'reddit' ? 10 : 5;
        // Engagement component (log-compressed)
        const engComponent = Math.log1p(trend.engagementScore || 0) * 3;
        const raw = recency + sourceBonus + engComponent;
        return this.logNormalize(raw, maxHeatRaw);
    }

    /**
     * Computes growthScore (0-100).
     * Measures relative growth acceleration delta.
     * Uses the difference between the current trendScore and the historical
     * average to detect anomalous acceleration spikes.
     */
    computeGrowthScore(trend, previousScore, maxGrowthDelta) {
        const currentScore = trend.trendScore || 0;
        const prev = previousScore || 0;
        // Acceleration delta: positive = growing, negative = declining
        const delta = currentScore - prev;
        // Only reward positive growth
        const clampedDelta = Math.max(0, delta);
        return this.logNormalize(clampedDelta, maxGrowthDelta);
    }

    /**
     * Helper: computes hours since publish time.
     */
    getHoursOld(trend) {
        const published = trend.publishedAt || trend.createdAt || new Date();
        return Math.max(0, (Date.now() - new Date(published).getTime()) / (1000 * 60 * 60));
    }

    /**
     * Main entry point: Scores a batch of trends.
     * 
     * 1. Computes per-item raw metrics.
     * 2. Finds batch maximums for normalization.
     * 3. Normalizes all scores to [0, 100].
     * 4. Persists scores + appends to scoreHistory in MongoDB.
     * 
     * @param {Array} trends — Array of trend documents from MongoDB
     * @returns {Array} — Same trends, enriched with scoring fields
     */
    async scoreBatch(trends) {
        if (!trends || trends.length === 0) return [];

        // --- Phase 1: Compute raw metrics for normalization bounds ---
        const rawMetrics = [];
        const previousScores = {};

        // Fetch previous scores for growth delta calculation
        const trendIds = trends.map(t => t.trendId).filter(Boolean);
        if (trendIds.length > 0) {
            const existingTrends = await Trend.find(
                { trendId: { $in: trendIds } },
                { trendId: 1, trendScore: 1 }
            ).lean();
            existingTrends.forEach(t => {
                previousScores[t.trendId] = t.trendScore || 0;
            });
        }

        for (const trend of trends) {
            const hoursOld = this.getHoursOld(trend);
            const raw = trend.engagementScore || 0;
            const decayedEngagement = this.computeDecayedEngagement(raw, hoursOld);

            const recency = Math.exp(-0.05 * hoursOld) * 50;
            const sourceBonus = trend.type === 'video' ? 15 : trend.type === 'reddit' ? 10 : 5;
            const engComponent = Math.log1p(raw) * 3;
            const heatRaw = recency + sourceBonus + engComponent;

            const prevScore = previousScores[trend.trendId] || 0;
            const growthDelta = Math.max(0, (trend.trendScore || 0) - prevScore);

            rawMetrics.push({ decayedEngagement, heatRaw, growthDelta });
        }

        // --- Phase 2: Derive batch maximums for relative normalization ---
        const maxDecayed = Math.max(1, ...rawMetrics.map(m => m.decayedEngagement));
        const maxHeat = Math.max(1, ...rawMetrics.map(m => m.heatRaw));
        const maxGrowth = Math.max(1, ...rawMetrics.map(m => m.growthDelta));

        // --- Phase 3: Normalize and assign scores ---
        const scoredTrends = [];
        const bulkOps = [];
        const now = new Date();

        for (let i = 0; i < trends.length; i++) {
            const trend = trends[i];
            const prevScore = previousScores[trend.trendId] || 0;

            const viralScore = this.computeViralScore(trend, maxDecayed);
            const heatScore = this.computeHeatScore(trend, maxHeat);
            const growthScore = this.computeGrowthScore(trend, prevScore, maxGrowth);

            // Composite trendScore: weighted blend
            // Apply crossPlatformMultiplier for multi-source verified trends
            const cpMultiplier = trend.crossPlatformMultiplier || 1.0;
            const rawComposite = (viralScore * 0.4) + (heatScore * 0.35) + (growthScore * 0.25);
            const compositeScore = Math.min(100, Math.round(rawComposite * cpMultiplier));

            const scoring = {
                viralScore,
                heatScore,
                growthScore,
                compositeScore
            };

            // scoreHistory entry (compact)
            const historyEntry = {
                ts: now,
                v: viralScore,
                h: heatScore,
                g: growthScore,
                c: compositeScore
            };

            // Build update operation
            if (trend.trendId) {
                bulkOps.push({
                    updateOne: {
                        filter: { trendId: trend.trendId },
                        update: {
                            $set: {
                                trendScore: compositeScore,
                                scoring
                            },
                            $push: {
                                scoreHistory: {
                                    $each: [historyEntry],
                                    $slice: -48 // Keep last 48 entries (4 hours at 5-min intervals)
                                }
                            }
                        }
                    }
                });
            }

            scoredTrends.push({
                ...trend,
                trendScore: compositeScore,
                scoring
            });
        }

        // --- Phase 4: Persist to MongoDB ---
        if (bulkOps.length > 0) {
            try {
                await Trend.bulkWrite(bulkOps, { ordered: false });
                logger.info(`[ScoreEngine] Persisted ${bulkOps.length} scored trends.`);
            } catch (err) {
                logger.error('[ScoreEngine] Bulk write error: %s', err.message);
            }
        }

        return scoredTrends;
    }

    /**
     * Computes the velocity delta (%) between current and previous composite score.
     * Used by alertService to detect >50% spikes.
     */
    computeVelocityDelta(currentScore, previousScore) {
        if (!previousScore || previousScore === 0) {
            return currentScore > 0 ? 100 : 0;
        }
        return parseFloat((((currentScore - previousScore) / previousScore) * 100).toFixed(1));
    }
}

module.exports = new TrendScoreEngine();
