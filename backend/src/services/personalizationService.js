/**
 * Personalization Engine — Phase 3, Step 3
 * 
 * High-performance personalized trend feed based on:
 * - User interests (keyword matching)
 * - Preferred sources (filter + boost)
 * - Base trend score
 * - Recency (< 3 hours)
 * - AI virality score
 * 
 * Target: <200ms response time (excluding external API fetch)
 */

// Score constants (strict spec)
const INTEREST_MATCH_BOOST = 20;     // Per matched keyword
const INTEREST_BOOST_CAP = 60;       // Max interest boost
const SOURCE_PREFERENCE_BOOST = 15;  // If source matches preferred
const RECENCY_BOOST = 10;            // If published < 3 hours ago
const AI_VIRALITY_BOOST = 15;        // If viralityScore > 8
const RECENCY_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours in ms

class PersonalizationService {

    /**
     * Main function: Personalize a list of trends for a specific user.
     * 
     * @param {Array} trends  - Array of trend objects from aggregator
     * @param {Object} user   - User document from DB
     * @returns {Array}       - Top 15 trends sorted by personalizedScore DESC
     */
    personalizeTrends(trends, user) {
        // Safety: handle empty/null input
        if (!trends || trends.length === 0) return [];

        const interests = (user.interests || []).map(i => i.toLowerCase().trim());
        const preferredSources = (user.preferredSources || []).map(s => s.toLowerCase().trim());
        const hasSourceFilter = preferredSources.length > 0;

        const now = Date.now();

        // Single pass: score + filter + annotate
        const scored = [];

        for (let i = 0; i < trends.length; i++) {
            const trend = trends[i];

            // ── STEP 8: Source Filtering (early exit for performance) ──
            if (hasSourceFilter) {
                const trendSource = (trend.source || '').toLowerCase();
                const sourceAllowed = preferredSources.some(ps =>
                    trendSource.includes(ps) || ps.includes(trendSource)
                );
                if (!sourceAllowed) continue; // Skip this trend entirely
            }

            // ── STEP 1: Normalize ──
            const normalizedTitle = (trend.title || '').toLowerCase().trim();

            // ── STEP 2: Keyword Matching ──
            const matchedInterests = [];
            for (let j = 0; j < interests.length; j++) {
                if (normalizedTitle.includes(interests[j])) {
                    matchedInterests.push(interests[j]);
                }
            }
            const matchCount = matchedInterests.length;

            // ── STEP 3: Base Score ──
            let personalizedScore = trend.trendScore || 0;

            // ── STEP 4: Interest Boost (capped at 60) ──
            const interestBoost = Math.min(matchCount * INTEREST_MATCH_BOOST, INTEREST_BOOST_CAP);
            personalizedScore += interestBoost;

            // ── STEP 5: Preferred Source Boost ──
            let sourceBoost = 0;
            if (preferredSources.length > 0) {
                const trendSource = (trend.source || '').toLowerCase();
                const isPreferred = preferredSources.some(ps =>
                    trendSource.includes(ps) || ps.includes(trendSource)
                );
                if (isPreferred) {
                    sourceBoost = SOURCE_PREFERENCE_BOOST;
                    personalizedScore += sourceBoost;
                }
            }

            // ── STEP 6: Recency Boost ──
            let recencyBoost = 0;
            const publishedAt = trend.publishedAt ? new Date(trend.publishedAt).getTime() : 0;
            if (publishedAt && (now - publishedAt) < RECENCY_THRESHOLD_MS) {
                recencyBoost = RECENCY_BOOST;
                personalizedScore += recencyBoost;
            }

            // ── STEP 7: AI Virality Boost ──
            let viralityBoost = 0;
            const viralityScore = trend.analysis?.viralityScore || 0;
            if (viralityScore > 8) {
                viralityBoost = AI_VIRALITY_BOOST;
                personalizedScore += viralityBoost;
            }

            // ── STEP 9: Build Explanation ──
            const reasons = [];
            if (matchCount > 0) reasons.push(`Matched ${matchCount} interest(s): ${matchedInterests.join(', ')}`);
            if (sourceBoost > 0) reasons.push('Preferred source');
            if (recencyBoost > 0) reasons.push('Published recently');
            if (viralityBoost > 0) reasons.push('High virality');
            if (reasons.length === 0) reasons.push('Trending globally');

            scored.push({
                ...trend,
                personalizedScore,
                matchedInterests: matchedInterests.length > 0 ? matchedInterests : [],
                reason: reasons.join(' + ')
            });
        }

        // ── Sort by personalizedScore DESC ──
        scored.sort((a, b) => b.personalizedScore - a.personalizedScore);

        // ── Return top 15 ──
        return scored.slice(0, 15);
    }
}

module.exports = new PersonalizationService();
