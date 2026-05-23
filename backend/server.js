require('dotenv').config(); // Must be FIRST — loads .env before anything else reads process.env
const http = require('http');
const app = require('./src/app');
const mongoose = require('mongoose');
const socketService = require('./src/services/socketService');
const redisConnection = require('./src/config/redis');
const cron = require('node-cron');
const { ensureIndexes } = require('./src/config/dbIndexes');
const geoTrendEngine = require('./src/services/geoTrendEngine');
const logger = require('./src/services/loggerService');

const PORT = process.env.PORT || 5000;

// Create HTTP server (required for Socket.IO attachment)
const server = http.createServer(app);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
    logger.info('[Server] MongoDB connected successfully.');

    // Verify compound indexes
    await ensureIndexes();

    server.listen(PORT, () => {
        logger.info(`[Server] Server running on port ${PORT}`);

        // Initialize WebSocket server
        socketService.init(server);
        
        // Start autonomous background tasks
        const backgroundWorker = require('./src/services/backgroundWorker');
        backgroundWorker.start();

        // Start Queue Workers
        require('./src/queues/workers/aiEnrichmentWorker');
        require('./src/queues/workers/trendWorker');
        require('./src/jobs/trendAggregatorJob');

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
    });
})
.catch((err) => {
    logger.error('[Server] MongoDB connection error: %o', { error: err.message, stack: err.stack });
    process.exit(1);
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
