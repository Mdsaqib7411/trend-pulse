const mongoose = require('mongoose');
const redisConnection = require('../config/redis');
const { aiEnrichmentQueue, trendQueue } = require('../config/queue');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../services/loggerService');
const predictionValidationWorker = require('../services/predictionValidationWorker');

/**
 * Controller for system health diagnostics and telemetry.
 */
class SystemController {
    /**
     * Get system status and database/service connectivity metrics.
     * @param {Object} req Express request object
     * @param {Object} res Express response object
     */
    static async getSystemStatus(req, res) {
        try {
            // Uptime & memory metrics
            const systemMetrics = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
            };

            // MongoDB connection state check
            const mongoState = mongoose.connection.readyState;
            const mongoConnected = mongoState === 1;
            const mongoStatusText = {
                0: 'disconnected',
                1: 'connected',
                2: 'connecting',
                3: 'disconnecting'
            }[mongoState] || 'unknown';

            // Redis connection check
            const redisConnected = redisConnection.status === 'ready';
            const redisStatus = redisConnection.status;

            // BullMQ Queue Statuses
            const queueTelemetry = {};
            
            // Query AI Enrichment Queue
            try {
                if (redisConnected) {
                    const aiJobCounts = await aiEnrichmentQueue.getJobCounts();
                    queueTelemetry.aiEnrichment = {
                        status: 'active',
                        jobCounts: aiJobCounts
                    };
                } else {
                    queueTelemetry.aiEnrichment = { status: 'offline', error: 'Redis connection offline' };
                }
            } catch (err) {
                logger.error('[System Health] Error getting AI Enrichment Queue job counts: %o', { error: err.message });
                queueTelemetry.aiEnrichment = { status: 'error', error: err.message };
            }

            // Query Trend Fetching Queue
            try {
                if (redisConnected) {
                    const trendJobCounts = await trendQueue.getJobCounts();
                    queueTelemetry.trendFetching = {
                        status: 'active',
                        jobCounts: trendJobCounts
                    };
                } else {
                    queueTelemetry.trendFetching = { status: 'offline', error: 'Redis connection offline' };
                }
            } catch (err) {
                logger.error('[System Health] Error getting Trend Fetching Queue job counts: %o', { error: err.message });
                queueTelemetry.trendFetching = { status: 'error', error: err.message };
            }

            const aiTelemetryService = require('../services/aiTelemetryService');
            const telemetry = aiTelemetryService.getTelemetry();
            const dashboardData = aiTelemetryService.getDashboardStatus();

            // AI Key configurations availability check
            const aiKeysConfigured = {
                gemini: !!process.env.GEMINI_API_KEY,
                openai: !!process.env.OPENAI_API_KEY,
                openrouter: !!process.env.OPENROUTER_API_KEY,
                youtube: !!process.env.YOUTUBE_API_KEY,
                news: !!process.env.NEWS_API_KEY,
                gnews: !!process.env.GNEWS_API_KEY,
                mediastack: !!process.env.MEDIASTACK_API_KEY
            };

            const data = {
                system: systemMetrics,
                databases: {
                    mongodb: {
                        connected: mongoConnected,
                        status: mongoStatusText,
                        readyState: mongoState
                    },
                    redis: {
                        connected: redisConnected,
                        status: redisStatus
                    }
                },
                queues: queueTelemetry,
                aiConfiguration: aiKeysConfigured,
                aiTelemetryDashboard: dashboardData,
                aiTelemetry: telemetry
            };

            return ApiResponse.success(res, 'System diagnostics retrieved successfully', data);
        } catch (error) {
            logger.error('[System Health] Error gathering health diagnostics: %o', { error: error.message, stack: error.stack });
            return ApiResponse.error(res, 'Failed to retrieve system status', error.message, 500);
        }
    }

    /**
     * Get aggregated system intelligence stats for the admin dashboard.
     */
    static async getIntelligenceStats(req, res) {
        try {
            const Trend = require('../models/Trend');
            const User = require('../models/User');
            const Notification = require('../models/Notification');

            // 1. Active viral trends count
            const viralCount = await Trend.countDocuments({ trendScore: { $gte: 80 } });

            // 2. Prediction Lifecycle Summaries
            const lifecycleAgg = await Trend.aggregate([
                { $group: { _id: '$predictions.lifecycleState', count: { $sum: 1 } } }
            ]);
            const predictions = {
                emerging: 0,
                accelerating: 0,
                viral: 0,
                declining: 0,
                dead: 0
            };
            lifecycleAgg.forEach(item => {
                const state = item._id || 'emerging';
                if (predictions[state] !== undefined) {
                    predictions[state] = item.count;
                }
            });

            // 3. Push notification delivery counts (total persisted in notifications db)
            const totalPushes = await Notification.countDocuments({});

            // 4. Recommendation activity metrics (number of active preference nodes)
            const preferencesCount = await User.countDocuments({ preferences: { $exists: true, $not: { $size: 0 } } });
            const savedTrendsCount = await User.aggregate([
                { $project: { count: { $size: { $ifNull: ['$savedTrends', []] } } } },
                { $group: { _id: null, total: { $sum: '$count' } } }
            ]);

            const recommendationMetrics = {
                personalizedUsers: preferencesCount,
                totalBookmarks: savedTrendsCount[0]?.total || 0
            };

            // 5. Realtime Trend Growth Indicators (average score of top 5 trends)
            const topTrends = await Trend.find({})
                .sort({ trendScore: -1 })
                .limit(5)
                .select('title category trendScore')
                .lean();

            const avgTopScore = topTrends.length > 0
                ? Math.round(topTrends.reduce((sum, t) => sum + t.trendScore, 0) / topTrends.length)
                : 0;

            const data = {
                viralTrendsCount: viralCount,
                predictionSummaries: predictions,
                schedulerStatus: {
                    active: true,
                    nextSpikeScan: 'Within 10 minutes',
                    nextPushTrigger: 'Within 15 minutes'
                },
                pushDeliveryCount: totalPushes,
                recommendationMetrics,
                growthIndicators: {
                    averageTopScore: avgTopScore,
                    topTrends: topTrends.map(t => ({
                        title: t.title,
                        category: t.category,
                        score: t.trendScore
                    }))
                }
            };

            return ApiResponse.success(res, 'Intelligence statistics retrieved successfully', data);
        } catch (error) {
            logger.error('[System Stats] Error gathering intelligence stats: %o', { error: error.message });
            return ApiResponse.error(res, 'Failed to retrieve intelligence stats', error.message, 500);
        }
    }
    /**
     * GET /api/system/prediction-accuracy
     *
     * Returns aggregated prediction accuracy statistics across all evaluated
     * PredictionHistory records.
     *
     * Query params:
     *   ?days=30       — lookback window in days (default 30, max 90)
     *   ?category=AI   — filter to a specific trend category (optional)
     */
    static async getPredictionAccuracyStats(req, res) {
        try {
            const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
            const category = req.query.category || null;

            const stats = await predictionValidationWorker.getAccuracyStats({ days, category });

            return ApiResponse.success(
                res,
                'Prediction accuracy statistics retrieved successfully',
                stats
            );
        } catch (error) {
            logger.error('[System] Prediction accuracy stats failed: %s', error.message);
            return ApiResponse.error(res, 'Failed to retrieve prediction accuracy stats', error.message, 500);
        }
    }
}

module.exports = SystemController;
