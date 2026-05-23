/**
 * Centralized Feature Flags configuration for subsystems.
 * Supports phased rollouts and safe engine deactivations without full backend re-deployments or crashes.
 */
const features = {
    ENABLE_AI_CHAT: process.env.ENABLE_AI_CHAT !== 'false',
    ENABLE_PREDICTIONS: process.env.ENABLE_PREDICTIONS !== 'false',
    ENABLE_GRAPH_ENGINE: process.env.ENABLE_GRAPH_ENGINE !== 'false',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
    ENABLE_PERSONALIZATION: process.env.ENABLE_PERSONALIZATION !== 'false',
};

// Log loaded feature flags
const logger = require('../services/loggerService');
logger.info('Feature Flags initialized: %o', features);

module.exports = features;
