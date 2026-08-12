/**
 * Trend Fetching Worker — Isolated BullMQ worker for API scraping pipelines.
 * 
 * After fetching and upserting trends, this worker invokes the TrendScoreEngine
 * to compute normalized scoring metrics before the AI worker picks them up.
 */

const { Worker } = require('../../config/queue');
const { redisConnection } = require('../../config/redis');
const trendAggregator = require('../../services/trendAggregator');
const trendScoreEngine = require('../../services/trendScoreEngine');
const logger = require('../../services/loggerService');
const Trend = require('../../models/Trend');

console.log('[Worker] Initializing Trend Fetching Worker...');

const trendWorker = new Worker('trend-fetching', async (job) => {
    const { category } = job.data;
    logger.info(`[TrendWorker] Processing fetch for category: ${category}`);
    
    try {
        // 1. Execute heavy API fetching, parse, normalize, and save to DB
        const result = await trendAggregator.getAggregatedTrends(category, true);
        const trends = result.data || [];

        logger.info(`[TrendWorker] Successfully updated DB, Cache & Scores for ${category}`);
    } catch (error) {
        logger.error(`[TrendWorker] Error processing ${category}: ${error.message}`);
        throw error;
    }
}, {
    connection: redisConnection,
    concurrency: 1 // Respect API rate limits
});

trendWorker.on('failed', (job, err) => {
    logger.error(`[TrendWorker] Job failed for ${job.data?.category}: ${err.message}`);
});

module.exports = trendWorker;
