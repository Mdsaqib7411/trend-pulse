/**
 * Recommendation Engine — Geo-Personalized "For You" Feed.
 *
 * Layer 2: Enforces the global interleaving ratio:
 *   Pool A (70%): Local/Regional trends matching user's state.
 *   Pool B (20%): National trends (same country, different state).
 *   Pool C (10%): Global discovery (highest composite worldwide).
 *
 * Supports scope override via query param: ?scope=local|national|global
 * Applies languageWeight multiplier for locale-matched trends.
 */

const { UserActivity } = require('../models/UserActivity');
const Trend = require('../models/Trend');
const geoProfileService = require('./geoProfileService');
const feedCacheService = require('./feedCacheService');
const logger = require('./loggerService');

class RecommendationEngine {

    /**
     * Generate a geo-personalized "For You" feed.
     *
     * @param {string} userId
     * @param {Object} options — { limit, scope, geoProfile }
     * @returns {Array} Ranked trend documents
     */
    async getForYouFeed(userId, options = {}) {
        const limit = options.limit || 20;
        const scope = options.scope || null; // local | national | global | null (auto)
        
        // 1. Resolve user geo profile
        const geoProfile = options.geoProfile || await geoProfileService.getUserGeoProfile(userId);
        
        // 2. Namespaced Redis Feed Cache Check
        const country = geoProfile?.country || 'Global';
        const state = geoProfile?.state || 'all';
        const locale = geoProfile?.deviceLocale || 'en';
        
        const cacheKey = feedCacheService.generateCacheKey(country, state, scope || 'auto', locale);
        const cachedFeed = await feedCacheService.getCachedFeed(cacheKey);
        
        if (cachedFeed) {
            logger.info('[RecommendationEngine] Serving personalized feed from Redis cache for key: %s', cacheKey);
            return cachedFeed.slice(0, limit);
        }

        // 3. Get user's weighted category preference map
        const weightMap = await UserActivity.getUserWeightMap(userId);
        const { affinityMap, allKeywords } = this.buildAffinityVector(weightMap);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const baseFilter = { createdAt: { $gte: sevenDaysAgo }, trendScore: { $gt: 0 } };

        // 4. Handle explicit scope override from frontend selector
        if (scope) {
            const scopedFeed = await this.getScopedFeed(scope, geoProfile, baseFilter, affinityMap, allKeywords, limit);
            await feedCacheService.setCachedFeed(cacheKey, scopedFeed);
            return scopedFeed;
        }

        // 5. Auto-interleave: 70% local, 20% national, 10% global
        const hasGeo = geoProfile && geoProfile.country;
        if (!hasGeo) {
            // No geo data — serve global feed with affinity ranking
            const globalFeed = await this.getAffinityRankedFeed(baseFilter, affinityMap, allKeywords, geoProfile, limit);
            await feedCacheService.setCachedFeed(cacheKey, globalFeed);
            return globalFeed;
        }

        const localCount = Math.ceil(limit * 0.7);
        const nationalCount = Math.ceil(limit * 0.2);
        const globalCount = limit - localCount - nationalCount;

        // Pool A: Local/Regional (same state)
        const localPool = await this.fetchPool({
            ...baseFilter,
            'geography.state': geoProfile.state,
            'geography.country': geoProfile.country
        }, 50);

        // Pool B: National (same country, different state)
        const nationalPool = await this.fetchPool({
            ...baseFilter,
            'geography.country': geoProfile.country,
            'geography.state': { $ne: geoProfile.state }
        }, 30);

        // Pool C: Global discovery (top worldwide, exclude user's country)
        const globalPool = await this.fetchPool({
            ...baseFilter,
            'geography.country': { $ne: geoProfile.country }
        }, 20);

        // 6. Rank each pool with affinity + language boost
        const rankedLocal = this.rankPool(localPool, affinityMap, allKeywords, geoProfile, '📍 Trending in your area');
        const rankedNational = this.rankPool(nationalPool, affinityMap, allKeywords, geoProfile, `🇵🇰 Trending in ${geoProfile.country}`);
        const rankedGlobal = this.rankPool(globalPool, affinityMap, allKeywords, geoProfile, '🌍 Trending worldwide');

        // 7. Interleave according to ratio
        const merged = this.interleave(
            rankedLocal.slice(0, localCount),
            rankedNational.slice(0, nationalCount),
            rankedGlobal.slice(0, globalCount)
        );

        // 8. If merged is short, backfill from global
        if (merged.length < limit) {
            const backfill = await this.getGlobalTopFeed(limit - merged.length);
            merged.push(...backfill.map(t => ({ ...t, matchReason: '🌍 Global trend' })));
        }

        const finalFeed = merged.slice(0, limit);
        
        // Cache final feed result
        await feedCacheService.setCachedFeed(cacheKey, finalFeed);

        return finalFeed;
    }

    /**
     * Explicit scope override: return only one pool type.
     */
    async getScopedFeed(scope, geoProfile, baseFilter, affinityMap, allKeywords, limit) {
        let filter = { ...baseFilter };
        let label = '🌍 Global trend';

        switch (scope) {
            case 'local':
                if (geoProfile?.state) {
                    filter['geography.state'] = geoProfile.state;
                    filter['geography.country'] = geoProfile.country;
                    label = '📍 Local trend';
                }
                break;
            case 'national':
                if (geoProfile?.country) {
                    filter['geography.country'] = geoProfile.country;
                    label = `🇵🇰 National trend`;
                }
                break;
            case 'global':
            default:
                // No additional geo filter
                label = '🌍 Global trend';
                break;
        }

        const pool = await this.fetchPool(filter, limit * 3);
        const ranked = this.rankPool(pool, affinityMap, allKeywords, geoProfile, label);
        return ranked.slice(0, limit);
    }

    /**
     * Fetch a pool of trends with sorting and limit.
     */
    async fetchPool(filter, poolLimit) {
        return Trend.find(filter)
            .sort({ trendScore: -1 })
            .limit(poolLimit)
            .maxTimeMS(3000)
            .lean();
    }

    /**
     * Rank a pool of trends using affinity + keyword boost + language weight.
     */
    rankPool(trends, affinityMap, allKeywords, geoProfile, matchLabel) {
        const languageWeight = geoProfile?.languageWeight || 1.0;
        const userLocale = geoProfile?.deviceLocale || 'en';

        return trends.map(trend => {
            const category = trend.category || 'General';
            const categoryAffinity = affinityMap[category] || 0;

            // Keyword boost
            let keywordBoost = 1.0;
            if (trend.analysis?.keywords && allKeywords.length > 0) {
                const trendKeywords = new Set(trend.analysis.keywords.map(k => k.toLowerCase()));
                const userKeywords = new Set(allKeywords.map(k => k.toLowerCase()));
                const intersection = [...trendKeywords].filter(k => userKeywords.has(k));
                keywordBoost = 1 + (intersection.length * 0.15);
            }

            // Language weight: boost trends matching user's language
            const langBoost = (trend.language === userLocale) ? languageWeight : 1.0;

            // Viral component
            const viralComponent = (trend.scoring?.viralScore || 0) / 100;

            // Emerging boost: 20% bonus for locally emerging trends
            const emergingBoost = trend.isEmerging ? 1.2 : 1.0;

            const recommendationScore =
                (trend.trendScore || 0) *
                (1 + categoryAffinity) *
                keywordBoost *
                langBoost *
                emergingBoost *
                (1 + viralComponent * 0.2);

            return {
                ...trend,
                recommendationScore: Math.round(recommendationScore * 100) / 100,
                matchReason: trend.isEmerging ? '🚀 Emerging in your area' : (categoryAffinity > 0 ? `Based on your interest in ${category}` : matchLabel)
            };
        }).sort((a, b) => b.recommendationScore - a.recommendationScore);
    }

    /**
     * Build affinity vector from user activity weight map.
     */
    buildAffinityVector(weightMap) {
        if (!weightMap || weightMap.length === 0) {
            return { affinityMap: {}, allKeywords: [] };
        }

        const totalWeight = weightMap.reduce((sum, entry) => sum + entry.totalWeight, 0);
        const affinityMap = {};
        const allKeywords = [];

        for (const entry of weightMap) {
            affinityMap[entry._id] = entry.totalWeight / totalWeight;
            if (entry.keywords) allKeywords.push(...entry.keywords.filter(Boolean));
        }

        return { affinityMap, allKeywords };
    }

    /**
     * Interleave three pools maintaining their relative ordering.
     * Enforces strict 70% Local, 20% National, and 10% Global interleaving slot cycles.
     */
    interleave(local, national, global) {
        const result = [];
        let lIdx = 0, nIdx = 0, gIdx = 0;
        
        // Exact 10-slot cycle respecting 7:2:1 ratio
        const pattern = ['L', 'L', 'N', 'L', 'L', 'N', 'L', 'L', 'L', 'G'];
        
        while (lIdx < local.length || nIdx < national.length || gIdx < global.length) {
            let itemAdded = false;
            for (const type of pattern) {
                if (type === 'L' && lIdx < local.length) {
                    result.push(local[lIdx++]);
                    itemAdded = true;
                } else if (type === 'N' && nIdx < national.length) {
                    result.push(national[nIdx++]);
                    itemAdded = true;
                } else if (type === 'G' && gIdx < global.length) {
                    result.push(global[gIdx++]);
                    itemAdded = true;
                }
            }
            if (!itemAdded) break;
        }

        // Sweep any leftovers
        while (lIdx < local.length) result.push(local[lIdx++]);
        while (nIdx < national.length) result.push(national[nIdx++]);
        while (gIdx < global.length) result.push(global[gIdx++]);

        // Deduplicate by trendId
        const seen = new Set();
        return result.filter(t => {
            if (seen.has(t.trendId)) return false;
            seen.add(t.trendId);
            return true;
        });
    }

    /**
     * Affinity-ranked feed (no geo data available).
     */
    async getAffinityRankedFeed(baseFilter, affinityMap, allKeywords, geoProfile, limit) {
        const trends = await this.fetchPool(baseFilter, 100);
        if (trends.length === 0) return this.getGlobalTopFeed(limit);
        const ranked = this.rankPool(trends, affinityMap, allKeywords, geoProfile, 'Trending globally');
        return ranked.slice(0, limit);
    }

    /**
     * Fallback: Global top trends.
     */
    async getGlobalTopFeed(limit = 20) {
        return Trend.find({ trendScore: { $gt: 0 } })
            .sort({ trendScore: -1 })
            .limit(limit)
            .maxTimeMS(3000)
            .lean();
    }
}

module.exports = new RecommendationEngine();
