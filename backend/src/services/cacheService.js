const { redisConnection, isRedisAvailable } = require('../config/redis');
const logger = require('./loggerService');

/**
 * In-Memory cache storage to act as transparent fallback when Redis is offline.
 * Implements Time-To-Live (TTL) expiration and periodic automatic cleanup to prevent memory leaks.
 */
class MemoryCache {
    constructor() {
        this.cache = new Map();
        // Periodically run cleanup every 60 seconds to purge expired entries
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref(); // Prevent blocking Node process from exiting
        }
    }

    set(key, value, ttlSeconds) {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { value, expiresAt });
    }

    get(key) {
        const record = this.cache.get(key);
        if (!record) return null;
        if (Date.now() > record.expiresAt) {
            this.cache.delete(key); // Lazy deletion on expired read
            return null;
        }
        return record.value;
    }

    del(key) {
        this.cache.delete(key);
    }

    cleanup() {
        const now = Date.now();
        let purgedCount = 0;
        for (const [key, record] of this.cache.entries()) {
            if (now > record.expiresAt) {
                this.cache.delete(key);
                purgedCount++;
            }
        }
        if (purgedCount > 0) {
            logger.debug('[CacheService MemoryCache] Auto-purged %d expired entries.', purgedCount);
        }
    }
}

const memoryCache = new MemoryCache();

class CacheService {
    /**
     * Check if Redis cache client is ready
     * @returns {boolean}
     */
    isHealthy() {
        return isRedisAvailable();
    }

    /**
     * Get data from cache
     * @param {string} key 
     * @returns {Object|null}
     */
    async get(key) {
        if (!this.isHealthy()) {
            const localData = memoryCache.get(key);
            if (localData) {
                logger.info('[CacheService] Serving from Memory Cache fallback for key: %s', key);
                return localData;
            }
            logger.debug('[CacheService] Redis offline, cache miss in memory fallback for key: %s', key);
            return null;
        }
        try {
            const data = await redisConnection.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('[CacheService] Get error for key %s: %o', key, { error: error.message });
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
            logger.debug('[CacheService] Redis offline. Storing in Memory Cache fallback for key: %s (TTL: %ds)', key, ttlSeconds);
            memoryCache.set(key, value, ttlSeconds);
            return;
        }
        try {
            await redisConnection.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            logger.error('[CacheService] Setex error for key %s: %o', key, { error: error.message });
        }
    }

    /**
     * Delete a specific key from cache
     * @param {string} key 
     */
    async del(key) {
        memoryCache.del(key);
        if (!this.isHealthy()) {
            logger.debug('[CacheService] Redis offline. Bypassed Redis delete for key: %s', key);
            return;
        }
        try {
            await redisConnection.del(key);
            logger.info('[CacheService] Cache busted for key: %s', key);
        } catch (error) {
            logger.error('[CacheService] Delete error for key %s: %o', key, { error: error.message });
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

