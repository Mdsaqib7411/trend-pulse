const Redis = require('ioredis');
const logger = require('../services/loggerService');

// Connect to the local Redis container with robust failover reconnect rules
const redisConnection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn('[Redis] Connection lost. Attempt %d. Reconnecting in %dms...', times, delay);
        return delay;
    }
});

redisConnection.on('error', (err) => {
    logger.error('[Redis] Connection error: %o', { error: err.message, stack: err.stack });
});

redisConnection.on('ready', () => {
    logger.info('[Redis] Connection established successfully.');
});

redisConnection.on('close', () => {
    logger.warn('[Redis] Connection closed.');
});

redisConnection.on('reconnecting', () => {
    logger.info('[Redis] Reconnection attempt initiated.');
});

module.exports = redisConnection;
