/**
 * Platform Fusion Engine — Cross-platform trend deduplication and merger.
 *
 * Phase 3.5: Processes incoming raw trends from trendWorker.
 * Uses a 30-minute deduplication radar window to detect semantic overlaps.
 *
 * Pipeline:
 *   1. Extract keyword tokens from incoming trend title.
 *   2. Scan existing trends within 30-min window for ≥85% keyword overlap.
 *   3. If match found → MERGE into existing doc (update sources array).
 *   4. If cross-platform → apply crossPlatformMultiplier: 1.8 to composite scoring.
 *   5. If no match → pass through as new trend.
 */

const Trend = require('../models/Trend');
const logger = require('./loggerService');

const FUSION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const KEYWORD_OVERLAP_THRESHOLD = 0.85;
const CROSS_PLATFORM_MULTIPLIER = 1.8;

// Stop words to exclude from keyword extraction
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

class PlatformFusionEngine {

    /**
     * Extract meaningful keyword tokens from a title string.
     * Strips punctuation, lowercases, removes stop words, strips short tokens.
     *
     * @param {string} text
     * @returns {string[]}
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
     * Compute Jaccard-like keyword overlap ratio between two keyword sets.
     * Returns a value in [0, 1].
     */
    computeOverlap(keywordsA, keywordsB) {
        if (keywordsA.length === 0 || keywordsB.length === 0) return 0;
        const setA = new Set(keywordsA);
        const setB = new Set(keywordsB);
        let intersection = 0;
        for (const word of setA) {
            if (setB.has(word)) intersection++;
        }
        const minLen = Math.min(setA.size, setB.size);
        return minLen > 0 ? intersection / minLen : 0;
    }

    /**
     * Main fusion entry: process a batch of incoming raw trends.
     *
     * For each trend:
     *   1. Check if a semantically matching trend exists within the 30-min window.
     *   2. If yes → merge source data into existing doc.
     *   3. If no  → mark as new (will be created by aggregator's bulkWrite).
     *
     * @param {Array} incomingTrends — Raw trend objects from API fetchers
     * @returns {{ newTrends: Array, mergedCount: number }}
     */
    async processBatch(incomingTrends) {
        if (!incomingTrends || incomingTrends.length === 0) {
            return { newTrends: [], mergedCount: 0 };
        }

        const windowStart = new Date(Date.now() - FUSION_WINDOW_MS);
        let mergedCount = 0;
        const newTrends = [];

        // Fetch existing trends within the radar window for comparison
        const existingTrends = await Trend.find(
            { createdAt: { $gte: windowStart } },
            { trendId: 1, title: 1, type: 1, sources: 1, platformCount: 1, crossPlatformMultiplier: 1 }
        ).lean();

        // Pre-compute keyword sets for existing trends
        const existingKeywordMap = new Map();
        for (const existing of existingTrends) {
            existingKeywordMap.set(existing.trendId, {
                doc: existing,
                keywords: this.extractKeywords(existing.title)
            });
        }

        for (const incoming of incomingTrends) {
            const incomingKeywords = this.extractKeywords(incoming.title);
            if (incomingKeywords.length === 0) {
                newTrends.push(incoming);
                continue;
            }

            let matched = false;

            for (const [existingId, existingEntry] of existingKeywordMap) {
                const overlap = this.computeOverlap(incomingKeywords, existingEntry.keywords);

                if (overlap >= KEYWORD_OVERLAP_THRESHOLD) {
                    // MERGE: Do not create new doc, update existing
                    await this.mergeIntoExisting(existingId, incoming, existingEntry.doc);
                    mergedCount++;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Enrich new trend with initial source metadata
                incoming.sources = this.buildInitialSources(incoming);
                incoming.platformCount = 1;
                incoming.crossPlatformMultiplier = 1.0;
                newTrends.push(incoming);

                // Add to the comparison map so subsequent items in this batch
                // can also fuse against trends that were just processed
                if (incoming.trendId) {
                    existingKeywordMap.set(incoming.trendId, {
                        doc: incoming,
                        keywords: incomingKeywords
                    });
                }
            }
        }

        if (mergedCount > 0) {
            logger.info(`[FusionEngine] Merged ${mergedCount} trends into existing documents.`);
        }

        return { newTrends, mergedCount };
    }

    /**
     * Merge incoming trend data into an existing Trend document.
     * Updates the sources array for the respective platform and
     * applies crossPlatformMultiplier if platformCount > 1.
     */
    async mergeIntoExisting(existingTrendId, incoming, existingDoc) {
        const update = {};
        const pushOps = {};

        // Determine which source array to update
        const sourceEntry = this.buildSourceEntry(incoming);
        if (sourceEntry.key && sourceEntry.data) {
            pushOps[`sources.${sourceEntry.key}`] = sourceEntry.data;
        }

        // Count distinct platforms
        const existingPlatforms = new Set();
        if (existingDoc.sources?.reddit?.length > 0) existingPlatforms.add('reddit');
        if (existingDoc.sources?.youtube?.length > 0) existingPlatforms.add('youtube');
        if (existingDoc.sources?.googleNews?.length > 0) existingPlatforms.add('googleNews');
        existingPlatforms.add(sourceEntry.key || this.getPlatformKey(incoming.type));
        const platformCount = existingPlatforms.size;

        // Apply cross-platform multiplier when verified across >1 platform
        const multiplier = platformCount > 1 ? CROSS_PLATFORM_MULTIPLIER : 1.0;

        update.platformCount = platformCount;
        update.crossPlatformMultiplier = multiplier;

        // Aggregate engagement: add incoming engagement to existing
        const engagementBoost = incoming.engagementScore || 0;

        const updateQuery = {
            $set: update,
            $inc: { engagementScore: engagementBoost }
        };

        if (Object.keys(pushOps).length > 0) {
            updateQuery.$push = pushOps;
        }

        try {
            await Trend.updateOne({ trendId: existingTrendId }, updateQuery);
            logger.info(`[FusionEngine] Merged "${incoming.title?.substring(0, 35)}..." → ${existingTrendId} (platforms: ${platformCount}, multiplier: ${multiplier})`);
        } catch (err) {
            logger.error('[FusionEngine] Merge error: %s', err.message);
        }
    }

    /**
     * Build the initial sources object for a brand-new trend.
     */
    buildInitialSources(trend) {
        const sources = { reddit: [], youtube: [], googleNews: [] };
        const entry = this.buildSourceEntry(trend);
        if (entry.key && entry.data) {
            sources[entry.key] = [entry.data];
        }
        return sources;
    }

    /**
     * Build a single source entry object from a raw trend.
     */
    buildSourceEntry(trend) {
        const type = trend.type || 'news';

        if (type === 'reddit') {
            return {
                key: 'reddit',
                data: {
                    url: trend.url || trend.sourceUrl || '',
                    subreddit: (trend.source || '').replace('r/', ''),
                    score: trend.engagementScore || 0,
                    comments: trend.comments || 0,
                    fetchedAt: new Date()
                }
            };
        }

        if (type === 'video') {
            return {
                key: 'youtube',
                data: {
                    url: trend.url || trend.sourceUrl || '',
                    channelTitle: trend.source || trend.author || '',
                    viewCount: trend.engagementScore || 0,
                    fetchedAt: new Date()
                }
            };
        }

        // Default: news (NewsAPI, GNews)
        return {
            key: 'googleNews',
            data: {
                url: trend.url || trend.sourceUrl || '',
                sourceName: trend.source || '',
                fetchedAt: new Date()
            }
        };
    }

    /**
     * Map trend type to source key.
     */
    getPlatformKey(type) {
        if (type === 'reddit') return 'reddit';
        if (type === 'video') return 'youtube';
        return 'googleNews';
    }
}

module.exports = new PlatformFusionEngine();
