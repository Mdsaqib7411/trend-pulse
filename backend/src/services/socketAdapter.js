/**
 * Socket.IO Redis Adapter — Horizontal scaling for multi-instance deployments.
 * Ensures WebSocket events broadcast across all server nodes via Redis pub/sub.
 */

const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { isRedisAvailable } = require('../config/redis');
const logger = require('./loggerService');

function createSocketAdapter() {
    if (!isRedisAvailable()) {
        logger.warn('[SocketAdapter] Redis offline. Bypassing Socket.IO Redis adapter initialization (memory fallback active).');
        return null;
    }

    try {
        const pubClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false, // Prevents memory accumulation if disconnected
            connectTimeout: 2000,
            retryStrategy(times) {
                // If it fails to connect, stop retrying for socket adapter to prevent log flooding
                if (times > 3) {
                    logger.warn('[SocketAdapter] Redis connection failed after 3 attempts. Operating in single-instance mode.');
                    return null; // Stop retrying
                }
                return Math.min(times * 100, 1000);
            }
        });
        const subClient = pubClient.duplicate();

        pubClient.on('error', (err) => logger.debug('[SocketAdapter] Pub client offline state error: %s', err.message));
        subClient.on('error', (err) => logger.debug('[SocketAdapter] Sub client offline state error: %s', err.message));

        logger.info('[SocketAdapter] Redis pub/sub adapter initialized successfully.');
        return createAdapter(pubClient, subClient);
    } catch (err) {
        logger.error('[SocketAdapter] Failed to initialize Redis Socket adapter: %s', err.message);
        return null;
    }
}

module.exports = { createSocketAdapter };

