const crypto = require('crypto');
const logger = require('../services/loggerService');

/**
 * Enterprise-grade structured HTTP logging middleware.
 * Assigns X-Request-ID correlation headers and logs route performance metrics.
 */
const loggingMiddleware = (req, res, next) => {
    // Generate or extract request ID
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startTime = process.hrtime();

    // Log completion event
    res.on('finish', () => {
        const diff = process.hrtime(startTime);
        const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        const userId = req.user ? req.user.uid : 'anonymous';

        const telemetry = {
            requestId,
            userId,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection.remoteAddress,
            statusCode: res.statusCode,
            durationMs: parseFloat(durationMs),
            userAgent: req.headers['user-agent']
        };

        if (res.statusCode >= 500) {
            logger.error('[HTTP ERROR] %s %s | Status: %d | Time: %dms | RequestID: %s', 
                req.method, req.path, res.statusCode, durationMs, requestId, telemetry);
        } else if (res.statusCode >= 400) {
            logger.warn('[HTTP WARN] %s %s | Status: %d | Time: %dms | RequestID: %s', 
                req.method, req.path, res.statusCode, durationMs, requestId, telemetry);
        } else {
            logger.info('[HTTP INFO] %s %s | Status: %d | Time: %dms | RequestID: %s', 
                req.method, req.path, res.statusCode, durationMs, requestId, telemetry);
        }
    });

    next();
};

module.exports = loggingMiddleware;
