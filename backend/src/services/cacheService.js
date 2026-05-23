const Redis = require('ioredis');
const logger = require('./loggerService');

// Connect to Redis with robust failover reconnect rules
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn('[CacheService Redis] Connection lost. Attempt %d. Reconnecting in %dms...', times, delay);
        return delay;
    }
});

redis.on('error', (err) => {
    logger.error('[CacheService] Redis connection error: %o', { error: err.message, stack: err.stack });
});

redis.on('ready', () => {
    logger.info('[CacheService] Connected to Redis successfully');
});

redis.on('close', () => {
    logger.warn('[CacheService] Connection closed.');
});

class CacheService {
    /**
     * Check if cache client is ready
     * @returns {boolean}
     */
    isHealthy() {
        return redis.status === 'ready';
    }

    /**
     * Get data from cache
     * @param {string} key 
     * @returns {Object|null}
     */
    async get(key) {
        if (!this.isHealthy()) {
            logger.warn('[CacheService] Redis offline. Operating in degraded capacity. Falling back to DB query for key: %s', key);
            return null;
        }
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('[CacheService] Get error for key %s: %o', key, { error: error.message, stack: error.stack });
            return null; // Fallback to fetching fresh data if cache fails
        }
    }

    /**
     * Set data in cache with an expiration time
     * @param {string} key 
     * @param {Object} value 
     * @param {number} ttlSeconds - Time to live in seconds
     */
    async setex(key, ttlSeconds, value) {
        if (!this.isHealthy()) {
            logger.warn('[CacheService] Redis offline. Skipping cache setex for key: %s', key);
            return;
        }
        try {
            await redis.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            logger.error('[CacheService] Setex error for key %s: %o', key, { error: error.message, stack: error.stack });
        }
    }

    /**
     * Delete a specific key from cache
     * @param {string} key 
     */
    async del(key) {
        if (!this.isHealthy()) {
            logger.warn('[CacheService] Redis offline. Skipping cache delete for key: %s', key);
            return;
        }
        try {
            await redis.del(key);
            logger.info('[CacheService] Cache busted for key: %s', key);
        } catch (error) {
            logger.error('[CacheService] Delete error for key %s: %o', key, { error: error.message, stack: error.stack });
        }
    }

    /**
     * Bust cache for a specific category
     * @param {string} category 
     */
    async bustCategoryCache(category) {
        if (!category) return;
        const key = `trendpulse:trends:${category.toLowerCase().replace(/\s+/g, '_')}`;
        await this.del(key);
    }
}

module.exports = new CacheService();
