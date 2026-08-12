const { redisConnection, isRedisAvailable } = require('../config/redis');
const logger = require('./loggerService');

/**
 * In-Memory cache storage to act as transparent fallback when Redis is offline.
 * Implements Time-To-Live (TTL) expiration and periodic automatic cleanup.
 */
class MemoryCache {
    constructor() {
        this.cache = new Map();
        // Periodically run cleanup every 60 seconds
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
            this.cache.delete(key);
            return null;
        }
        return record.value;
    }

    del(key) {
        this.cache.delete(key);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.cache.entries()) {
            if (now > record.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}

const memoryCache = new MemoryCache();

class FeedCacheService {
    constructor() {
        this.TTL_SECONDS = 600; // 10 minutes strict cache
        this.DIVERSITY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
        this.SKIP_THRESHOLD = 5; // 5 consecutive skips triggers override
    }

    /**
     * Check if cache client is ready
     * @returns {boolean}
     */
    isHealthy() {
        return isRedisAvailable();
    }

    /**
     * Generate a strict multi-tenant cache key.
     * Schema: feed:{country}:{state}:{scope}:{locale}
     */
    generateCacheKey(country, state, scope, locale = 'en') {
        const c = (country || 'Global').toLowerCase().replace(/\s+/g, '_');
        const s = (state || 'all').toLowerCase().replace(/\s+/g, '_');
        const sc = (scope || 'auto').toLowerCase();
        const loc = (locale || 'en').toLowerCase();
        return `feed:${c}:${s}:${sc}:${loc}`;
    }

    /**
     * Fetch feed from cache.
     * @param {string} key
     * @returns {Array|null}
     */
    async getCachedFeed(key) {
        if (!this.isHealthy()) {
            const localFeed = memoryCache.get(key);
            if (localFeed) {
                logger.info('[FeedCacheService] Serving from Memory Cache fallback for key: %s', key);
                return localFeed;
            }
            logger.debug('[FeedCacheService] Redis offline. Cache miss in memory fallback for key: %s', key);
            return null;
        }
        try {
            const data = await redisConnection.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('[FeedCacheService] Cache miss/error for key %s: %o', key, { error: error.message });
            return null;
        }
    }

    /**
     * Save feed to cache with 600s TTL.
     * @param {string} key
     * @param {Array} feedData
     */
    async setCachedFeed(key, feedData) {
        if (!this.isHealthy()) {
            logger.debug('[FeedCacheService] Redis offline. Storing feed in Memory Cache fallback for key: %s', key);
            memoryCache.set(key, feedData, this.TTL_SECONDS);
            return;
        }
        try {
            await redisConnection.setex(key, this.TTL_SECONDS, JSON.stringify(feedData));
        } catch (error) {
            logger.error('[FeedCacheService] Failed to set cache for key %s: %o', key, { error: error.message });
        }
    }

    /**
     * Granular invalidation routine using Redis SCAN streams.
     * Safely purges keys belonging only to a specific geographic boundary.
     * Triggered during local trend spikes or quarantine events.
     *
     * @param {string} country
     * @param {string} state
     */
    async invalidateRegionCache(country, state = '*') {
        const c = (country || '*').toLowerCase().replace(/\s+/g, '_');
        const s = (state || '*').toLowerCase().replace(/\s+/g, '_');
        const matchPattern = `feed:${c}:${s}:*`;

        // Always invalidate in local memory cache first
        const regexPattern = new RegExp(`^feed:${c.replace(/\*/g, '.*')}:${s.replace(/\*/g, '.*')}:.*$`);
        let localClearedCount = 0;
        for (const key of memoryCache.cache.keys()) {
            if (regexPattern.test(key)) {
                memoryCache.del(key);
                localClearedCount++;
            }
        }
        if (localClearedCount > 0) {
            logger.info('[FeedCacheService] Invalidated %d cache keys in Memory Cache for region %s:%s', localClearedCount, country, state);
        }

        if (!this.isHealthy()) {
            logger.warn('[FeedCacheService] Redis offline. Skipping Redis invalidateRegionCache for region %s:%s', country, state);
            return;
        }

        try {
            const stream = redisConnection.scanStream({
                match: matchPattern,
                count: 100
            });

            stream.on('data', async (keys) => {
                if (keys.length > 0) {
                    try {
                        if (this.isHealthy()) {
                            await redisConnection.del(...keys);
                            logger.info('[FeedCacheService] Invalidated %d cache keys for region %s:%s', keys.length, country, state);
                        }
                    } catch (delError) {
                        logger.error('[FeedCacheService] Delete error during stream invalidation: %o', { error: delError.message });
                    }
                }
            });

            stream.on('end', () => {
                logger.info('[FeedCacheService] Invalidation stream completed for pattern: %s', matchPattern);
            });

            stream.on('error', (err) => {
                logger.error('[FeedCacheService] Invalidation stream error for pattern %s: %o', matchPattern, { error: err.message });
            });
        } catch (error) {
            logger.error('[FeedCacheService] Invalidation failed for pattern %s: %o', matchPattern, { error: error.message });
        }
    }

    // ─── Adaptive Diversity Matrix ──────────────────────────────────────────

    /**
     * Fetch the user's current personalized interleaving matrix override.
     * Returns the 85/10/5 override if active, otherwise returns null.
     *
     * @param {string} userId
     * @returns {Object|null}
     */
    async getDiversityMatrixOverride(userId) {
        if (!this.isHealthy()) {
            const localMatrix = memoryCache.get(`user:diversity:${userId}`);
            if (localMatrix) {
                logger.info('[FeedCacheService] Serving diversity override from Memory Cache for user: %s', userId);
                return localMatrix;
            }
            return null;
        }
        try {
            const override = await redisConnection.get(`user:diversity:${userId}`);
            return override ? JSON.parse(override) : null;
        } catch (error) {
            logger.error('[FeedCacheService] Diversity matrix get error for user %s: %o', userId, { error: error.message });
            return null;
        }
    }

    /**
     * Tracks user interaction signals passed from the frontend.
     * Dynamically shifts interleaving feed matrix if user skips global context.
     *
     * @param {string} userId
     * @param {string} eventType - e.g., 'skip', 'click', 'like'
     * @param {string} trendScope - e.g., 'global', 'local', 'national'
     */
    async trackUserInteraction(userId, eventType, trendScope) {
        if (!this.isHealthy()) {
            const counterKey = `user:skips:global:${userId}`;
            if (eventType === 'skip' && trendScope === 'global') {
                const currentRecord = memoryCache.get(counterKey) || { skips: 0 };
                const currentSkips = currentRecord.skips + 1;
                memoryCache.set(counterKey, { skips: currentSkips }, 3600); // 1 hour TTL

                if (currentSkips >= this.SKIP_THRESHOLD) {
                    const overridePayload = {
                        localRatio: 0.85,
                        nationalRatio: 0.10,
                        globalRatio: 0.05,
                        triggeredAt: new Date().toISOString()
                    };
                    const diversityKey = `user:diversity:${userId}`;
                    memoryCache.set(diversityKey, overridePayload, this.DIVERSITY_TTL_SECONDS);
                    logger.info('[FeedCacheService] (Memory) Adaptive diversity triggered for %s. Shifted to 85/10/5 matrix.', userId);
                    memoryCache.del(counterKey);
                }
            } else if (['click', 'like', 'share', 'bookmark'].includes(eventType)) {
                memoryCache.del(counterKey);
            }
            return;
        }
        try {
            const counterKey = `user:skips:global:${userId}`;
            
            if (eventType === 'skip' && trendScope === 'global') {
                const currentSkips = await redisConnection.incr(counterKey);
                // Set an expiration on the counter so it resets if inactive for an hour
                if (currentSkips === 1) await redisConnection.expire(counterKey, 3600);

                if (currentSkips >= this.SKIP_THRESHOLD) {
                    // Trigger Adaptive Diversity Override: Shift to highly localized 85/10/5 matrix
                    const overridePayload = {
                        localRatio: 0.85,
                        nationalRatio: 0.10,
                        globalRatio: 0.05,
                        triggeredAt: new Date().toISOString()
                    };

                    const diversityKey = `user:diversity:${userId}`;
                    await redisConnection.setex(diversityKey, this.DIVERSITY_TTL_SECONDS, JSON.stringify(overridePayload));
                    
                    logger.info('[FeedCacheService] Adaptive diversity triggered for %s. Shifted to 85/10/5 matrix.', userId);
                    
                    // Reset counter after triggering
                    await redisConnection.del(counterKey);
                }
            } else if (['click', 'like', 'share', 'bookmark'].includes(eventType)) {
                // Any positive engagement resets the skip penalty counter
                await redisConnection.del(counterKey);
            }
        } catch (error) {
            logger.error('[FeedCacheService] Error tracking interaction for user %s: %o', userId, { error: error.message });
        }
    }
}

module.exports = new FeedCacheService();
