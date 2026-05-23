/**
 * Database Index Configuration Script.
 * Run at startup to ensure all compound indexes are created.
 * Mongoose auto-creates schema-level indexes, but this script
 * handles verification and logging for operational visibility.
 */

const Trend = require('../models/Trend');
const User = require('../models/User');
const { UserActivity } = require('../models/UserActivity');
const logger = require('../services/loggerService');

async function ensureIndexes() {
    try {
        await Trend.ensureIndexes();
        logger.info('[DBIndexes] Trend indexes verified.');

        await User.ensureIndexes();
        logger.info('[DBIndexes] User indexes verified.');

        await UserActivity.ensureIndexes();
        logger.info('[DBIndexes] UserActivity indexes verified.');

        logger.info('[DBIndexes] All compound indexes created successfully.');
    } catch (err) {
        logger.error('[DBIndexes] Index creation error: %s', err.message);
    }
}

module.exports = { ensureIndexes };
