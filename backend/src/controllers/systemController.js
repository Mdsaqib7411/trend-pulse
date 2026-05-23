const mongoose = require('mongoose');
const redisConnection = require('../config/redis');
const { aiEnrichmentQueue, trendQueue } = require('../config/queue');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../services/loggerService');

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
                aiConfiguration: aiKeysConfigured
            };

            return ApiResponse.success(res, 'System diagnostics retrieved successfully', data);
        } catch (error) {
            logger.error('[System Health] Error gathering health diagnostics: %o', { error: error.message, stack: error.stack });
            return ApiResponse.error(res, 'Failed to retrieve system status', error.message, 500);
        }
    }
}

module.exports = SystemController;
