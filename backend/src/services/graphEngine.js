/**
 * Graph Engine — Trend Relationship Graph builder.
 *
 * Phase 3.5: Detects contextual connections between distinct trends
 * and links them via the relatedTrendIds array in MongoDB.
 *
 * Uses tokenization and keyword overlap to evaluate relationships.
 * Threshold: ≥40% keyword overlap between two distinct trends = related.
 * Cap: max 5 related trends per document to prevent graph bloat.
 */

const Trend = require('../models/Trend');
const logger = require('./loggerService');

const RELATIONSHIP_THRESHOLD = 0.40;
const MAX_RELATED_PER_TREND = 5;

// Same stop words used across fusion and graph for consistency
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

class GraphEngine {

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
     * Compute keyword overlap ratio (Jaccard-like, using min denominator).
     */
    computeOverlap(keywordsA, keywordsB) {
        if (keywordsA.length === 0 || keywordsB.length === 0) return 0;
        const setA = new Set(keywordsA);
        const setB = new Set(keywordsB);
        let intersection = 0;
        for (const word of setA) {
            if (setB.has(word)) intersection++;
        }
        return intersection / Math.min(setA.size, setB.size);
    }

    /**
     * Process a batch of trends and build relationship links.
     *
     * For each pair of distinct trends, compute keyword overlap.
     * If overlap ≥ RELATIONSHIP_THRESHOLD and they are not the same trend
     * (i.e., not fused duplicates), link them bidirectionally.
     *
     * @param {Array} trends — Array of trend documents (lean objects or Mongoose docs)
     * @returns {number} — Number of new links created
     */
    async buildRelationships(trends) {
        if (!trends || trends.length < 2) return 0;

        // Pre-compute keyword sets
        const keywordMap = new Map();
        for (const trend of trends) {
            const titleKeywords = this.extractKeywords(trend.title);
            // Also include AI-extracted keywords if available
            const analysisKeywords = (trend.analysis?.keywords || []).map(k => k.toLowerCase());
            const combined = [...new Set([...titleKeywords, ...analysisKeywords])];
            keywordMap.set(trend.trendId, combined);
        }

        const bulkOps = [];
        let linkCount = 0;

        // Pairwise comparison (O(n^2) but n is small — max 15 per batch)
        const trendArray = Array.from(keywordMap.entries());

        for (let i = 0; i < trendArray.length; i++) {
            for (let j = i + 1; j < trendArray.length; j++) {
                const [idA, kwA] = trendArray[i];
                const [idB, kwB] = trendArray[j];

                if (!idA || !idB || idA === idB) continue;

                const overlap = this.computeOverlap(kwA, kwB);

                if (overlap >= RELATIONSHIP_THRESHOLD) {
                    // Link A → B (addToSet prevents duplicates)
                    bulkOps.push({
                        updateOne: {
                            filter: { trendId: idA },
                            update: {
                                $addToSet: { relatedTrendIds: idB }
                            }
                        }
                    });

                    // Link B → A (bidirectional)
                    bulkOps.push({
                        updateOne: {
                            filter: { trendId: idB },
                            update: {
                                $addToSet: { relatedTrendIds: idA }
                            }
                        }
                    });

                    linkCount++;
                }
            }
        }

        // Persist all links
        if (bulkOps.length > 0) {
            try {
                await Trend.bulkWrite(bulkOps, { ordered: false });
                logger.info(`[GraphEngine] Created ${linkCount} relationship links.`);
            } catch (err) {
                logger.error('[GraphEngine] Bulk link error: %s', err.message);
            }
        }

        // Enforce cap: trim relatedTrendIds to MAX_RELATED_PER_TREND
        await this.enforceRelationshipCap(trends.map(t => t.trendId).filter(Boolean));

        return linkCount;
    }

    /**
     * Enforce max related trends cap by keeping only the most recent entries.
     */
    async enforceRelationshipCap(trendIds) {
        try {
            const overflowed = await Trend.find({
                trendId: { $in: trendIds },
                [`relatedTrendIds.${MAX_RELATED_PER_TREND}`]: { $exists: true }
            }, { trendId: 1, relatedTrendIds: 1 })
            .maxTimeMS(2000)
            .lean();

            for (const trend of overflowed) {
                const trimmed = trend.relatedTrendIds.slice(-MAX_RELATED_PER_TREND);
                await Trend.updateOne(
                    { trendId: trend.trendId },
                    { $set: { relatedTrendIds: trimmed } }
                ).maxTimeMS(2000);
            }
        } catch (err) {
            logger.error('[GraphEngine] Cap enforcement error: %s', err.message);
        }
    }

    /**
     * Get the full hydrated graph for a specific trend.
     * Returns the target trend + all related trend documents.
     *
     * @param {string} trendId
     * @returns {{ trend: Object, relatedTrends: Array, graphSize: number }}
     */
    async getHydratedGraph(trendId) {
        const trend = await Trend.findOne({ trendId }).maxTimeMS(2000).lean();
        if (!trend) return null;

        const relatedIds = trend.relatedTrendIds || [];
        let relatedTrends = [];

        if (relatedIds.length > 0) {
            relatedTrends = await Trend.find(
                { trendId: { $in: relatedIds } },
                {
                    trendId: 1, title: 1, category: 1, image: 1,
                    trendScore: 1, scoring: 1, type: 1, platformCount: 1,
                    crossPlatformMultiplier: 1, publishedAt: 1,
                    'analysis.summary': 1, 'analysis.sentiment': 1,
                    'analysis.sentimentScore': 1, 'analysis.status': 1,
                    sources: 1, relatedTrendIds: 1
                }
            )
            .maxTimeMS(2000)
            .lean();
        }

        return {
            trend,
            relatedTrends,
            graphSize: 1 + relatedTrends.length
        };
    }
}

module.exports = new GraphEngine();
