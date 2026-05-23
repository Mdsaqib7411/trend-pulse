const trendService = require('../services/trendService');
const trendAggregator = require('../services/trendAggregator');
const personalizationService = require('../services/personalizationService');
const aiTrendEnhancer = require('../services/aiTrendEnhancer');
const analyticsService = require('../services/analyticsService');
const recommendationEngine = require('../services/recommendationEngine');
const geoTrendEngine = require('../services/geoTrendEngine');
const geoProfileService = require('../services/geoProfileService');
const graphEngine = require('../services/graphEngine');
const trendPredictionEngine = require('../services/trendPredictionEngine');
const feedCacheService = require('../services/feedCacheService');
const { UserActivity, INTERACTION_WEIGHTS } = require('../models/UserActivity');
const Trend = require('../models/Trend');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

exports.getHomeTrends = async (req, res, next) => {
    try {
        const result = await trendAggregator.getAggregatedTrends('Home');
        return ApiResponse.success(res, 'Home trends retrieved successfully', result.data, {
            isStale: result.isStale,
            fetchedAt: result.fetchedAt
        });
    } catch (error) {
        next(error);
    }
};

exports.exploreTrends = async (req, res, next) => {
    try {
        const result = await trendAggregator.getAggregatedTrends('All');
        return ApiResponse.success(res, 'All trends retrieved successfully', result.data, {
            isStale: result.isStale,
            fetchedAt: result.fetchedAt
        });
    } catch (error) {
        next(error);
    }
};

exports.getCategory = async (req, res, next) => {
    try {
        const { type } = req.query;
        if (!type) return ApiResponse.error(res, 'Type query param is required', null, 400);
        const result = await trendAggregator.getAggregatedTrends(type);
        return ApiResponse.success(res, `Trends for ${type} retrieved successfully`, result.data, {
            isStale: result.isStale,
            fetchedAt: result.fetchedAt
        });
    } catch (error) {
        next(error);
    }
};

exports.search = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return ApiResponse.error(res, 'Query param "q" is required', null, 400);
        const trends = await trendService.searchTrends(q);
        return ApiResponse.success(res, 'Search results retrieved successfully', trends);
    } catch (error) {
        next(error);
    }
};

exports.byLocation = async (req, res, next) => {
    try {
        const { country } = req.query;
        if (!country) return ApiResponse.error(res, 'Country query param is required', null, 400);
        const trends = await trendService.getByLocation(country);
        return ApiResponse.success(res, `Trends for location ${country} retrieved successfully`, trends);
    } catch (error) {
        next(error);
    }
};

exports.compare = async (req, res, next) => {
    try {
        const { id1, id2 } = req.query;
        if (!id1 || !id2) return ApiResponse.error(res, 'Both id1 and id2 are required', null, 400);
        
        const result = await trendService.compareTrends(id1, id2);
        if (!result) return ApiResponse.error(res, 'One or both trends not found', null, 404);
        
        return ApiResponse.success(res, 'Trend comparison computed successfully', result);
    } catch (error) {
        next(error);
    }
};

exports.getById = async (req, res, next) => {
    try {
        const trend = await trendService.getTrendById(req.params.id);
        if (!trend) return ApiResponse.error(res, 'Trend not found', null, 404);
        return ApiResponse.success(res, 'Trend retrieved successfully', trend);
    } catch (error) {
        next(error);
    }
};

exports.getAnalytics = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        if (!trendId) return ApiResponse.error(res, 'Trend ID is required', null, 400);

        const analytics = await analyticsService.getTrendAnalytics(trendId);
        
        return ApiResponse.success(res, 'Trend analytics retrieved successfully', analytics);
    } catch (error) {
        next(error);
    }
};

exports.getHistory = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        if (!trendId) return ApiResponse.error(res, 'Trend ID is required', null, 400);

        const history = await analyticsService.getTrendHistory(trendId);
        
        return ApiResponse.success(res, 'Trend history retrieved successfully', history);
    } catch (error) {
        next(error);
    }
};

// Backward compatibility for existing frontend route /stats
exports.getStats = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        if (!trendId) return ApiResponse.error(res, 'Trend ID is required', null, 400);

        const analytics = await analyticsService.getTrendAnalytics(trendId);
        
        // Map to old format so frontend doesn't crash until updated
        const mappedData = {
            chartData: analytics.graphData,
            metrics: {
                peakVolume: `${(analytics.highestScore || 0).toFixed(1)}k`,
                dailyEngagers: `${(analytics.currentScore || 0).toFixed(1)}k`,
                topRegion: 'Global',
                shareRate: `${analytics.growthRate > 0 ? analytics.growthRate : 5}%`
            }
        };

        return ApiResponse.success(res, 'Trend stats retrieved successfully', mappedData);
    } catch (error) {
        next(error);
    }
};

exports.getPersonalized = async (req, res, next) => {
    try {
        // 1. Extract userId from verified token
        const userId = req.user.uid;

        // 2. Fetch user from DB
        const User = require('../models/User');
        const user = await User.findOne({ uid: userId }).maxTimeMS(2000).lean();

        // 3. Fetch trends using existing aggregator
        const result = await trendAggregator.getAggregatedTrends('All');
        const trends = result.data || [];

        // FALLBACK: If user not found OR no interests → return normal trending feed
        if (!user || (!user.interests?.length && !user.preferredSources?.length && !user.preferences?.length)) {
            return ApiResponse.success(res, 'Personalized trends retrieved successfully (fallback)', trends.slice(0, 15), {
                personalized: false,
                isStale: result.isStale,
                fetchedAt: result.fetchedAt
            });
        }

        // Merge preferences into interests for backward compatibility
        const mergedUser = {
            ...user,
            interests: [...new Set([
                ...(user.interests || []),
                ...(user.preferences || [])
            ])]
        };

        // 4. Call personalizeTrends(trends, user)
        const personalizedData = personalizationService.personalizeTrends(trends, mergedUser);

        // 5. Return JSON response
        return ApiResponse.success(res, 'Personalized trends retrieved successfully', personalizedData, {
            personalized: true,
            isStale: result.isStale,
            fetchedAt: result.fetchedAt
        });
    } catch (error) {
        const logger = require('../services/loggerService');
        logger.error('[Personalization] Error: %s', error.message);
        return ApiResponse.error(res, 'Failed to fetch personalized trends', error, 500);
    }
};

// Phase 3.5 Step 4: Geo-Personalized Feed with Advanced Caching & Adaptive Diversity
exports.getGeoPersonalizedFeed = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 20;
        const scope = req.query.scope || 'auto'; // local | national | global
        const locale = req.query.locale || 'en';

        // 1. Fetch User Geo-Profile to construct strict multi-tenant cache key
        const geoProfile = await geoProfileService.getUserGeoProfile(userId);
        const country = geoProfile?.country || 'Global';
        const state = geoProfile?.state || 'all';

        // 2. Check Redis Namespaced Cache
        const cacheKey = feedCacheService.generateCacheKey(country, state, scope, locale);
        const cachedFeed = await feedCacheService.getCachedFeed(cacheKey);

        if (cachedFeed) {
            return ApiResponse.success(res, 'Geo-personalized feed retrieved successfully (from cache)', cachedFeed, {
                personalized: true,
                fromCache: true,
                scope,
                fetchedAt: new Date().toISOString()
            });
        }

        // 3. Adaptive Diversity Matrix Overrides (check for skip penalties)
        const diversityOverride = await feedCacheService.getDiversityMatrixOverride(userId);

        // 4. Generate Feed (Heavy DB Hit)
        const feed = await recommendationEngine.getForYouFeed(userId, { 
            limit, 
            scope,
            diversityMatrix: diversityOverride // Pass the 85/10/5 override if active
        });

        // 5. Store in Redis Cache (600s TTL)
        await feedCacheService.setCachedFeed(cacheKey, feed);

        return ApiResponse.success(res, 'Geo-personalized feed retrieved successfully', feed, {
            personalized: true,
            fromCache: false,
            scope,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};

// Aliased for backward compatibility if routes use the old name
exports.getForYouFeed = exports.getGeoPersonalizedFeed;

// Layer 3: Heatmap payload endpoint
exports.getHeatmap = async (req, res, next) => {
    try {
        const heatmapData = await geoTrendEngine.getHeatmapPayload();
        return ApiResponse.success(res, 'Heatmap payload retrieved successfully', heatmapData, {
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};

// Layer 3: Get emerging trends for user's region
exports.getEmerging = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const geoProfile = await geoProfileService.getUserGeoProfile(userId);
        const limit = parseInt(req.query.limit) || 10;

        const emerging = await geoTrendEngine.getEmergingByRegion(
            geoProfile?.state,
            geoProfile?.country,
            limit
        );

        return ApiResponse.success(res, 'Emerging trends retrieved successfully', emerging, {
            region: geoProfile?.state || geoProfile?.country || 'Global',
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};

// Task 3: Record user interaction (click, like, bookmark, share, skip)
exports.recordInteraction = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { trendId, interactionType, trendScope } = req.body;

        if (!trendId || !interactionType) {
            return ApiResponse.error(res, 'trendId and interactionType are required', null, 400);
        }
        
        // Extended INTERACTION_WEIGHTS support for 'skip' natively or bypass validation if skip
        if (interactionType !== 'skip' && !INTERACTION_WEIGHTS[interactionType]) {
            return ApiResponse.error(res, 'Invalid interactionType. Use: click, like, bookmark, share, skip', null, 400);
        }

        // Fetch category and keywords from the trend for recommendation context
        const trend = await Trend.findOne({ trendId }, { category: 1, 'analysis.keywords': 1 }).maxTimeMS(2000).lean();
        const category = trend?.category || 'General';
        const keywords = trend?.analysis?.keywords || [];

        // Track user interaction for Adaptive Diversity Matrix (Phase 3.5 Step 4)
        await feedCacheService.trackUserInteraction(userId, interactionType, trendScope || 'global');

        // Skip events don't need to be heavily recorded in UserActivity DB, just in cache
        if (interactionType === 'skip') {
            return ApiResponse.success(res, 'Skip interaction recorded for diversity adaptation');
        }

        const activity = await UserActivity.recordInteraction(userId, trendId, interactionType, category, keywords);

        // If interaction is bookmark, also add to user's savedTrends
        if (interactionType === 'bookmark') {
            await User.findOneAndUpdate(
                { uid: userId },
                { $addToSet: { savedTrends: trendId } }
            ).maxTimeMS(2000);
        }

        return ApiResponse.success(res, 'Interaction recorded successfully', activity);
    } catch (error) {
        next(error);
    }
};

// Toggle bookmark (save/unsave)
exports.toggleBookmark = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { trendId } = req.body;

        if (!trendId) {
            return ApiResponse.error(res, 'trendId is required', null, 400);
        }

        const user = await User.findOne({ uid: userId }).maxTimeMS(2000);
        if (!user) return ApiResponse.error(res, 'User not found', null, 404);

        const isBookmarked = user.savedTrends?.includes(trendId);

        if (isBookmarked) {
            await User.findOneAndUpdate({ uid: userId }, { $pull: { savedTrends: trendId } }).maxTimeMS(2000);
        } else {
            await User.findOneAndUpdate({ uid: userId }, { $addToSet: { savedTrends: trendId } }).maxTimeMS(2000);
            // Record as bookmark interaction for recommendation engine
            const trend = await Trend.findOne({ trendId }, { category: 1, 'analysis.keywords': 1 }).maxTimeMS(2000).lean();
            await UserActivity.recordInteraction(userId, trendId, 'bookmark', trend?.category || 'General', trend?.analysis?.keywords || []);
        }

        return ApiResponse.success(res, isBookmarked ? 'Bookmark removed' : 'Bookmark added', null, {
            bookmarked: !isBookmarked
        });
    } catch (error) {
        next(error);
    }
};

// Phase 3.5: Hydrated trend relationship graph
exports.getGraph = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        const result = await graphEngine.getHydratedGraph(trendId);

        if (!result) {
            return ApiResponse.error(res, 'Trend not found', null, 404);
        }

        return ApiResponse.success(res, 'Trend relationship graph retrieved successfully', result.relatedTrends, {
            trend: result.trend,
            graphSize: result.graphSize,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};

// Phase 3.5 Step 2: Viral Spread Prediction
exports.getPrediction = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        const prediction = await trendPredictionEngine.predictForTrend(trendId);

        if (!prediction) {
            return ApiResponse.error(res, 'Trend not found', null, 404);
        }

        return ApiResponse.success(res, 'Viral spread prediction retrieved successfully', prediction, {
            trendId,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};
