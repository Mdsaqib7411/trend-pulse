const Redis = require('ioredis');
const logger = require('../services/loggerService');

const redisUrl = process.env.REDIS_URL;
let redisConnection;

// Dedicated connect options with robust failover reconnect rules
const redisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times) {
        // Backoff dynamically up to 10 seconds
        const delay = Math.min(times * 1000, 10000);
        if (times <= 3) {
            logger.warn('[Redis] Connection attempt %d failed. Reconnecting in %dms...', times, delay);
        } else if (times % 10 === 0) {
            // Log less frequently (every 10 attempts) to prevent log flooding during long offline periods
            logger.warn('[Redis] Still offline after %d attempts. Retrying in background... (Memory Fallback Active)', times);
        }
        return delay;
    }
};

if (redisUrl) {
    redisConnection = new Redis(redisUrl, redisOptions);
} else {
    redisConnection = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        ...redisOptions
    });
}

redisConnection.on('error', (err) => {
    // Only log actual connection failures as warning in retry phase to avoid terminal spam
    if (redisConnection.status !== 'ready') {
        logger.debug('[Redis] Offline state error: %s', err.message);
    } else {
        logger.error('[Redis] Connection error: %o', { error: err.message });
    }
});

redisConnection.on('ready', () => {
    logger.info('[Redis] Connection established successfully. (High-Performance Active)');
});

redisConnection.on('close', () => {
    logger.warn('[Redis] Connection closed.');
});

redisConnection.on('reconnecting', () => {
    logger.info('[Redis] Reconnection attempt initiated.');
});

/**
 * Checks if Redis is currently connected and ready.
 * @returns {boolean}
 */
function isRedisAvailable() {
    return redisConnection && redisConnection.status === 'ready';
}

module.exports = {
    redisConnection,
    isRedisAvailable
};

