/**
 * Trend Moderation Service — Anti-spam and manipulation protection.
 *
 * Source Reliability Algorithm:
 *   - Penalizes engagement if suspicious velocity spikes are detected.
 *   - Detects identical/near-identical titles within the same 5-minute time block.
 *   - Applies a reliability multiplier (0.1 to 1.0) to engagement scores.
 */

const logger = require('./loggerService');

const VELOCITY_SPIKE_THRESHOLD = 500; // % change considered suspicious
const TITLE_SIMILARITY_THRESHOLD = 0.85;
const TIME_BLOCK_MS = 5 * 60 * 1000; // 5 minutes

class TrendModerationService {

    /**
     * Moderates a batch of raw trends before they enter the scoring pipeline.
     * Mutates engagementScore in-place based on reliability assessment.
     *
     * @param {Array} trends — Raw trend array from aggregator
     * @returns {Array} — Same array with penalized engagement scores
     */
    moderateBatch(trends) {
        if (!trends || trends.length < 2) return trends;

        // Phase 1: Detect title clusters within same 5-min block
        const titleGroups = this.detectTitleClusters(trends);

        // Phase 2: Apply penalties
        for (const trend of trends) {
            let reliabilityMultiplier = 1.0;

            // Penalty 1: Duplicate title cluster detection
            const clusterSize = titleGroups.get(this.normalizeTitle(trend.title)) || 1;
            if (clusterSize > 2) {
                // More than 2 near-identical titles in same window = spam signal
                reliabilityMultiplier *= 0.3;
                logger.warn(`[Moderation] Cluster spam detected: "${trend.title.substring(0, 40)}..." (cluster: ${clusterSize})`);
            }

            // Penalty 2: Suspicious velocity spike
            if (this.isSuspiciousVelocity(trend)) {
                reliabilityMultiplier *= 0.5;
                logger.warn(`[Moderation] Suspicious velocity for "${trend.title.substring(0, 40)}..."`);
            }

            // Penalty 3: Missing source metadata
            if (!trend.sourceUrl && !trend.url) {
                reliabilityMultiplier *= 0.7;
            }

            // Apply multiplier to engagement
            trend.engagementScore = Math.round((trend.engagementScore || 0) * reliabilityMultiplier);
        }

        return trends;
    }

    /**
     * Groups trends by normalized title, detecting clusters of near-identical content.
     * Returns a Map<normalizedTitle, count>.
     */
    detectTitleClusters(trends) {
        const groups = new Map();

        for (let i = 0; i < trends.length; i++) {
            const titleA = this.normalizeTitle(trends[i].title);
            let matched = false;

            for (const [existingTitle, count] of groups) {
                if (this.computeTitleSimilarity(titleA, existingTitle) >= TITLE_SIMILARITY_THRESHOLD) {
                    groups.set(existingTitle, count + 1);
                    groups.set(titleA, groups.get(existingTitle));
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                groups.set(titleA, 1);
            }
        }

        return groups;
    }

    /**
     * Detects if a trend's engagement score is suspiciously high relative to its age.
     * New trends (< 1 hour) with engagement > 10,000 are flagged.
     */
    isSuspiciousVelocity(trend) {
        const hoursOld = trend.publishedAt
            ? (Date.now() - new Date(trend.publishedAt).getTime()) / (1000 * 60 * 60)
            : 24;

        if (hoursOld < 1 && (trend.engagementScore || 0) > 10000) {
            return true;
        }

        // Extreme engagement-to-age ratio
        if (hoursOld < 0.5 && (trend.engagementScore || 0) > 5000) {
            return true;
        }

        return false;
    }

    /**
     * Normalize title: lowercase, strip punctuation, collapse whitespace.
     */
    normalizeTitle(title) {
        if (!title) return '';
        return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Word-overlap similarity between two normalized titles.
     */
    computeTitleSimilarity(titleA, titleB) {
        const wordsA = new Set(titleA.split(' ').filter(w => w.length > 2));
        const wordsB = new Set(titleB.split(' ').filter(w => w.length > 2));
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        const intersection = [...wordsA].filter(w => wordsB.has(w));
        return intersection.length / Math.min(wordsA.size, wordsB.size);
    }
}

module.exports = new TrendModerationService();
