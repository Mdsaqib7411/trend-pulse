/**
 * Socket.IO Redis Adapter — Horizontal scaling for multi-instance deployments.
 * Ensures WebSocket events broadcast across all server nodes via Redis pub/sub.
 */

const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const logger = require('./loggerService');

function createSocketAdapter() {
    const pubClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error('[SocketAdapter] Pub client error: %s', err.message));
    subClient.on('error', (err) => logger.error('[SocketAdapter] Sub client error: %s', err.message));

    logger.info('[SocketAdapter] Redis pub/sub adapter initialized for horizontal scaling.');
    return createAdapter(pubClient, subClient);
}

module.exports = { createSocketAdapter };
