/**
 * TrendPulse — WebSocket Service
 * 
 * Strictly transactional emissions only:
 *   1. ai:status:completed — When an AI enrichment job finishes, patch the live mobile UI.
 *   2. alert:push — Priority push alert signals (velocity spike > 50%).
 * 
 * DOES NOT continuously broadcast global score deltas.
 */

const { Server } = require('socket.io');
const { createSocketAdapter } = require('./socketAdapter');
const logger = require('./loggerService');

let io = null;

/**
 * Initialize Socket.IO server with Redis adapter for horizontal scaling.
 */
function init(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        pingInterval: 25000,
        pingTimeout: 60000
    });

    // Attach Redis adapter for multi-instance broadcast consistency
    try {
        io.adapter(createSocketAdapter());
        logger.info('[WS] Redis adapter attached for horizontal scaling.');
    } catch (err) {
        logger.warn('[WS] Redis adapter failed, running single-instance: %s', err.message);
    }

    io.on('connection', (socket) => {
        logger.info(`[WS] Client connected: ${socket.id}`);

        socket.on('join', (userId) => {
            if (userId && typeof userId === 'string') {
                socket.join(`user:${userId}`);
                logger.info(`[WS] ${socket.id} joined room user:${userId}`);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`[WS] Client disconnected: ${socket.id}`);
        });
    });

    logger.info('[WS] WebSocket server initialized.');
    return io;
}

/**
 * Emit when an AI enrichment job completes for a specific trend.
 * This allows the mobile client to patch the UI node in real-time
 * without polling the REST API.
 */
function emitAICompleted(trendId, analysisPayload) {
    if (!io) return;
    io.emit('ai:status:completed', {
        trendId,
        analysis: analysisPayload,
        timestamp: new Date().toISOString()
    });
}

/**
 * Emit a priority push alert to a specific user room.
 */
function emitAlertToUser(userId, alertPayload) {
    if (!io) return;
    io.to(`user:${userId}`).emit('alert:push', {
        ...alertPayload,
        timestamp: new Date().toISOString()
    });
}

/**
 * Broadcast a priority alert to all connected clients.
 */
function emitAlertGlobal(alertPayload) {
    if (!io) return;
    io.emit('alert:push', {
        ...alertPayload,
        timestamp: new Date().toISOString()
    });
}

/**
 * Get the Socket.IO instance (for use in other services).
 */
function getIO() {
    return io;
}

module.exports = {
    init,
    getIO,
    emitAICompleted,
    emitAlertToUser,
    emitAlertGlobal
};
