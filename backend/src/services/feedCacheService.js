/**
 * Phase 3.5 Step 4: Namespaced Advanced Feed Cache Layer & Adaptive Diversity.
 *
 * Provides a highly optimized Redis caching layer for personalized/geo feeds.
 * Uses a multi-tenant key schema and streams for granular cache invalidation.
 * Tracks user interactions to dynamically adjust feed diversity (e.g., reducing
 * global context if a user skips it frequently).
 */

const Redis = require('ioredis');
const logger = require('./loggerService');

// Redis client (handles cluster commands and streams if configured) with robust failover rules
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn('[FeedCacheService Redis] Connection lost. Attempt %d. Reconnecting in %dms...', times, delay);
        return delay;
    }
});

redis.on('error', (err) => {
    logger.error('[FeedCacheService] Redis error: %o', { error: err.message, stack: err.stack });
});

redis.on('ready', () => {
    logger.info('[FeedCacheService] Connected to Redis successfully');
});

redis.on('close', () => {
    logger.warn('[FeedCacheService] Connection closed.');
});

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
        return redis.status === 'ready';
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
            logger.warn('[FeedCacheService] Redis offline. Operating in degraded capacity. Bypassing getCachedFeed for key: %s', key);
            return null;
        }
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('[FeedCacheService] Cache miss/error for key %s: %o', key, { error: error.message, stack: error.stack });
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
            logger.warn('[FeedCacheService] Redis offline. Skipping cache storage for key: %s', key);
            return;
        }
        try {
            await redis.setex(key, this.TTL_SECONDS, JSON.stringify(feedData));
        } catch (error) {
            logger.error('[FeedCacheService] Failed to set cache for key %s: %o', key, { error: error.message, stack: error.stack });
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
        if (!this.isHealthy()) {
            logger.warn('[FeedCacheService] Redis offline. Bypassing invalidateRegionCache for region %s:%s', country, state);
            return;
        }
        const c = (country || '*').toLowerCase().replace(/\s+/g, '_');
        const s = (state || '*').toLowerCase().replace(/\s+/g, '_');
        const matchPattern = `feed:${c}:${s}:*`;

        try {
            const stream = redis.scanStream({
                match: matchPattern,
                count: 100
            });

            stream.on('data', async (keys) => {
                if (keys.length > 0) {
                    try {
                        if (this.isHealthy()) {
                            await redis.del(...keys);
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
            logger.error('[FeedCacheService] Invalidation failed for pattern %s: %o', matchPattern, { error: error.message, stack: error.stack });
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
            logger.warn('[FeedCacheService] Redis offline. Operating in degraded capacity. Bypassing diversity matrix override for user: %s', userId);
            return null;
        }
        try {
            const override = await redis.get(`user:diversity:${userId}`);
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
            logger.warn('[FeedCacheService] Redis offline. Skipping trackUserInteraction for user: %s', userId);
            return;
        }
        try {
            const counterKey = `user:skips:global:${userId}`;
            
            if (eventType === 'skip' && trendScope === 'global') {
                const currentSkips = await redis.incr(counterKey);
                // Set an expiration on the counter so it resets if inactive for an hour
                if (currentSkips === 1) await redis.expire(counterKey, 3600);

                if (currentSkips >= this.SKIP_THRESHOLD) {
                    // Trigger Adaptive Diversity Override: Shift to highly localized 85/10/5 matrix
                    const overridePayload = {
                        localRatio: 0.85,
                        nationalRatio: 0.10,
                        globalRatio: 0.05,
                        triggeredAt: new Date().toISOString()
                    };

                    const diversityKey = `user:diversity:${userId}`;
                    await redis.setex(diversityKey, this.DIVERSITY_TTL_SECONDS, JSON.stringify(overridePayload));
                    
                    logger.info('[FeedCacheService] Adaptive diversity triggered for %s. Shifted to 85/10/5 matrix.', userId);
                    
                    // Reset counter after triggering
                    await redis.del(counterKey);
                }
            } else if (['click', 'like', 'share', 'bookmark'].includes(eventType)) {
                // Any positive engagement resets the skip penalty counter
                await redis.del(counterKey);
            }
        } catch (error) {
            logger.error('[FeedCacheService] Error tracking interaction for user %s: %o', userId, { error: error.message, stack: error.stack });
        }
    }
}

module.exports = new FeedCacheService();
