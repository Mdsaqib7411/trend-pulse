require('dotenv').config(); // Must be FIRST — loads .env before anything else reads process.env
const logger = require('./src/services/loggerService');

// --- Strict Production Environment Variable Validation ---
const requiredEnvVars = ['MONGO_URI'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
    logger.error('[Server] CRITICAL STARTUP FAILURE: Missing required environment variables: %o', missingVars);
    process.exit(1);
}

if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    logger.error('[Server] CRITICAL STARTUP FAILURE: PORT env variable must be a valid number. Value received: %s', process.env.PORT);
    process.exit(1);
}

const http = require('http');
const app = require('./src/app');
const mongoose = require('mongoose');
const socketService = require('./src/services/socketService');
const { redisConnection, isRedisAvailable } = require('./src/config/redis');
const cron = require('node-cron');
const { ensureIndexes } = require('./src/config/dbIndexes');
const geoTrendEngine = require('./src/services/geoTrendEngine');

const PORT = process.env.PORT || 5000;

// Create HTTP server (required for Socket.IO attachment)
const server = http.createServer(app);

// Start listening immediately on PORT so cloud platforms (Railway) detect the open port right away
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Server] Server running on port ${PORT}`);

    // Initialize WebSocket server
    socketService.init(server);
});

// Connect to MongoDB asynchronously in background
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
    logger.info('[Server] MongoDB connected successfully.');

    // Verify compound indexes
    await ensureIndexes();
    
    // Start autonomous background tasks
    const backgroundWorker = require('./src/services/backgroundWorker');
    backgroundWorker.start();

    // Start Queue Workers
    require('./src/queues/workers/aiEnrichmentWorker');
    require('./src/queues/workers/trendWorker');
    require('./src/jobs/trendAggregatorJob');
    require('./src/jobs/intelligenceScheduler');

    // Layer 3: Hourly geo trend emerging scan
    cron.schedule('0 * * * *', async () => {
        logger.info('[Cron] Starting hourly geo trend scan...');
        try {
            const count = await geoTrendEngine.scanForEmergingTrends();
            logger.info(`[Cron] Geo scan complete. ${count} emerging trends flagged.`);
        } catch (err) {
            logger.error('[Cron] Geo scan failed: %o', { error: err.message, stack: err.stack });
        }
    });
    logger.info('[Cron] Geo trend scan scheduled (hourly).');

    // Run startup diagnostics after 1.5 seconds to let connections settle
    setTimeout(() => {
        const mongoConnected = mongoose.connection.readyState === 1;
        const redisConnected = isRedisAvailable();
        const geminiConfigured = !!process.env.GEMINI_API_KEY;
        const newsConfigured = !!process.env.NEWS_API_KEY;
        const youtubeConfigured = !!process.env.YOUTUBE_API_KEY;

        console.log('\n======================================================');
        console.log('         TRENDPULSE - STARTUP DIAGNOSTICS REPORT      ');
        console.log('======================================================');
        console.log(`  MongoDB:    ${mongoConnected ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`  Redis:      ${redisConnected ? '✅ Connected (High-Performance Active)' : '⚠️ Offline (Memory Fallback Active)'}`);
        console.log(`  Gemini:     ${geminiConfigured ? '✅ Configured (Chat/Analysis Active)' : '❌ Missing API Key'}`);
        console.log(`  NewsAPI:    ${newsConfigured ? '✅ Configured (News Fetch Active)' : '❌ Missing API Key'}`);
        console.log(`  YouTube:    ${youtubeConfigured ? '✅ Configured (Video Fetch Active)' : '❌ Missing API Key'}`);
        console.log('======================================================\n');
    }, 1500);
})
.catch((err) => {
    logger.error('[Server] MongoDB connection error: %o', { error: err.message, stack: err.stack });
});

// Process-Level Exception and Rejection Protections
process.on('uncaughtException', (error) => {
    logger.error('[Process] CRITICAL: Uncaught Exception caught: %o', { 
        message: error.message, 
        stack: error.stack 
    });
    // Give the logger a moment to write out logs before exiting
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Process] CRITICAL: Unhandled Promise Rejection at: %o, reason: %o', promise, reason);
});

// Graceful Shutdown Management
const gracefulShutdown = (signal) => {
    logger.warn(`[Process] Received ${signal}. Initiating graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
        logger.info('[Process] HTTP server closed.');

        try {
            // Close Mongoose connection
            if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close();
                logger.info('[Process] MongoDB connection closed.');
            }

            // Close Redis connection
            if (redisConnection && redisConnection.status !== 'end') {
                await redisConnection.quit();
                logger.info('[Process] Redis connection closed.');
            }

            logger.info('[Process] Graceful shutdown completed. Exiting.');
            process.exit(0);
        } catch (err) {
            logger.error('[Process] Error during graceful shutdown: %o', { error: err.message, stack: err.stack });
            process.exit(1);
        }
    });

    // Forced shutdown fallback if graceful shutdown hangs
    setTimeout(() => {
        logger.error('[Process] Forced shutdown initiated due to timeout.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
