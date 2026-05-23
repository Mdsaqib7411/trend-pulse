/**
 * AI Optimization Service — Cost control and duplicate deduplication.
 *
 * Cost Rule: AI enrichment queue fires ONLY if scoring.viralScore > 65.
 * Duplicate Detection: If an incoming trend's primary keywords overlap >90%
 * with an existing enriched trend, mirror the analysis block and skip LLM call.
 */

const Trend = require('../models/Trend');
const logger = require('./loggerService');

const VIRAL_SCORE_THRESHOLD = 65;
const KEYWORD_OVERLAP_THRESHOLD = 0.9;

class AIOptimizationService {

    /**
     * Determines whether a trend qualifies for LLM enrichment.
     * Returns { shouldEnrich: boolean, reason: string, mirroredAnalysis?: Object }
     */
    async evaluateForEnrichment(trendId) {
        const trend = await Trend.findOne({ trendId }).lean();
        if (!trend) {
            return { shouldEnrich: false, reason: 'trend_not_found' };
        }

        // Already processed
        if (trend.analysis?.status === 'completed') {
            return { shouldEnrich: false, reason: 'already_completed' };
        }

        // Cost gate: only enrich trends with viralScore > threshold
        const viralScore = trend.scoring?.viralScore || 0;
        if (viralScore < VIRAL_SCORE_THRESHOLD) {
            logger.info(`[AIOptimization] Skipping LLM for ${trendId} (viralScore: ${viralScore} < ${VIRAL_SCORE_THRESHOLD})`);
            return { shouldEnrich: false, reason: 'below_viral_threshold' };
        }

        // Duplicate detection: find existing enriched trends with similar keywords
        const mirroredAnalysis = await this.findDuplicateAnalysis(trend);
        if (mirroredAnalysis) {
            logger.info(`[AIOptimization] Mirroring existing analysis for ${trendId}`);
            return { shouldEnrich: false, reason: 'duplicate_mirrored', mirroredAnalysis };
        }

        return { shouldEnrich: true, reason: 'qualifies' };
    }

    /**
     * Smart duplicate detection via keyword intersection.
     * If >90% of the incoming trend's title words match an existing enriched trend,
     * return the existing analysis block to avoid redundant LLM spend.
     */
    async findDuplicateAnalysis(trend) {
        const titleWords = this.extractKeywords(trend.title);
        if (titleWords.length < 3) return null; // Too few words for reliable matching

        // Fetch recently enriched trends (last 48 hours)
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const candidates = await Trend.find({
            'analysis.status': 'completed',
            trendId: { $ne: trend.trendId },
            updatedAt: { $gte: cutoff }
        }, {
            title: 1, 'analysis': 1, 'analysis.keywords': 1
        }).limit(50).lean();

        for (const candidate of candidates) {
            const candidateWords = this.extractKeywords(candidate.title);
            const overlap = this.computeOverlap(titleWords, candidateWords);

            if (overlap >= KEYWORD_OVERLAP_THRESHOLD) {
                return {
                    ...candidate.analysis,
                    status: 'completed',
                    summary: candidate.analysis.summary,
                    processedAt: new Date()
                };
            }
        }

        return null;
    }

    /**
     * Extract normalized keyword set from text.
     */
    extractKeywords(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2); // Ignore short filler words
    }

    /**
     * Jaccard-like overlap coefficient between two keyword arrays.
     */
    computeOverlap(wordsA, wordsB) {
        const setA = new Set(wordsA);
        const setB = new Set(wordsB);
        const intersection = [...setA].filter(w => setB.has(w));
        const minSize = Math.min(setA.size, setB.size);
        return minSize === 0 ? 0 : intersection.length / minSize;
    }

    /**
     * Apply mirrored analysis to a trend document in MongoDB.
     */
    async applyMirroredAnalysis(trendId, mirroredAnalysis) {
        await Trend.updateOne(
            { trendId },
            { $set: { analysis: mirroredAnalysis } }
        );
        logger.info(`[AIOptimization] Mirrored analysis persisted for ${trendId}`);
    }
}

module.exports = new AIOptimizationService();
