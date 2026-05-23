/**
 * Distributed Rate Limiter — Redis-backed for multi-instance synchronization.
 * Uses rate-limit-redis store with the centralized ioredis connection.
 * Fallbacks to express-rate-limit's in-memory store if Redis is unavailable or disconnected.
 * Logs blocked IPs via Winston.
 */

const { rateLimit, MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../services/loggerService');
const ApiResponse = require('../utils/apiResponse');

// Dedicated Redis client for rate limiting (separate from BullMQ which needs maxRetriesPerRequest: null)
const rateLimitRedis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn('[RateLimiter Redis] Connection lost. Attempt %d. Reconnecting in %dms...', times, delay);
        return delay;
    }
});

rateLimitRedis.on('error', (err) => {
    logger.error('[RateLimiter] Redis connection error: %o', { error: err.message, stack: err.stack });
});

rateLimitRedis.on('ready', () => {
    logger.info('[RateLimiter] Connected to Redis successfully');
});

rateLimitRedis.on('close', () => {
    logger.warn('[RateLimiter] Connection closed.');
});

/**
 * Failsafe wrapper around Redis sendCommand.
 * Bypasses store and logs warnings if Redis goes offline.
 */
const safeSendCommand = async (...args) => {
    if (rateLimitRedis.status !== 'ready') {
        logger.warn('[RateLimiter] Redis is not ready (status: %s). Bypassing rate limiting store check.', rateLimitRedis.status);
        return null;
    }
    try {
        return await rateLimitRedis.call(...args);
    } catch (err) {
        logger.error('[RateLimiter] redis.call error: %o', { error: err.message });
        return null;
    }
};

/**
 * Robust wrapper store that dynamically switches to MemoryStore if Redis is offline/disconnected.
 */
class FailsafeRedisStore {
    constructor(options) {
        this.options = options;
        this.redisStore = new RedisStore(options);
        this.memoryStore = new MemoryStore();
        this.useMemory = false;
        this.windowMs = 60 * 1000; // fallback default
    }

    async init(options) {
        this.windowMs = options.windowMs;
        try {
            if (rateLimitRedis.status !== 'ready') {
                throw new Error('Redis is not ready');
            }
            await this.redisStore.init(options);
            this.useMemory = false;
        } catch (err) {
            logger.warn('[RateLimiter] Failed to initialize RedisStore: %s. Falling back to in-memory store.', err.message);
            this.useMemory = true;
            await this.memoryStore.init(options);
        }
    }

    async increment(key) {
        if (this.useMemory || rateLimitRedis.status !== 'ready') {
            return this.memoryStore.increment(key);
        }
        try {
            return await this.redisStore.increment(key);
        } catch (err) {
            logger.warn('[RateLimiter] RedisStore increment failed, falling back to in-memory: %s', err.message);
            this.useMemory = true;
            await this.memoryStore.init({ windowMs: this.windowMs });
            return this.memoryStore.increment(key);
        }
    }

    async decrement(key) {
        if (this.useMemory || rateLimitRedis.status !== 'ready') {
            return this.memoryStore.decrement(key);
        }
        try {
            return await this.redisStore.decrement(key);
        } catch (err) {
            return this.memoryStore.decrement(key);
        }
    }

    async resetKey(key) {
        if (this.useMemory || rateLimitRedis.status !== 'ready') {
            return this.memoryStore.resetKey(key);
        }
        try {
            return await this.redisStore.resetKey(key);
        } catch (err) {
            return this.memoryStore.resetKey(key);
        }
    }

    async get(key) {
        if (this.useMemory || rateLimitRedis.status !== 'ready') {
            return this.memoryStore.get(key);
        }
        try {
            return await this.redisStore.get(key);
        } catch (err) {
            return this.memoryStore.get(key);
        }
    }
}

/**
 * Global API limiter: 100 requests per 15 minutes per IP.
 * Synchronized across all server instances via Redis.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new FailsafeRedisStore({
        sendCommand: safeSendCommand,
        prefix: 'trendpulse:rl:api:'
    }),
    message: 'Too many requests from this IP, please try again after 15 minutes',
    handler: (req, res, next, options) => {
        logger.warn('[RateLimiter] API limit exceeded for IP: %s on %s %s', req.ip, req.method, req.path);
        ApiResponse.error(res, options.message, null, options.statusCode);
    }
});

/**
 * Auth limiter: 20 requests per 15 minutes per IP.
 * Tighter throttle for login/register/sync endpoints.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new FailsafeRedisStore({
        sendCommand: safeSendCommand,
        prefix: 'trendpulse:rl:auth:'
    }),
    message: 'Too many authentication attempts, please try again later',
    handler: (req, res, next, options) => {
        logger.warn('[RateLimiter] Auth limit exceeded for IP: %s on %s %s', req.ip, req.method, req.path);
        ApiResponse.error(res, options.message, null, options.statusCode);
    }
});

/**
 * Heavy endpoint limiter: 10 requests per 5 minutes.
 * For AI chat and other compute-intensive routes.
 */
const heavyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new FailsafeRedisStore({
        sendCommand: safeSendCommand,
        prefix: 'trendpulse:rl:heavy:'
    }),
    message: 'Rate limit exceeded for this resource',
    handler: (req, res, next, options) => {
        logger.warn('[RateLimiter] Heavy limit exceeded for IP: %s on %s %s', req.ip, req.method, req.path);
        ApiResponse.error(res, options.message, null, options.statusCode);
    }
});

module.exports = { apiLimiter, authLimiter, heavyLimiter };
