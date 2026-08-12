const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');
const logger = require('./loggerService');

class PushNotificationService {
    /**
     * Reusable push notification delivery service via Firebase Admin.
     * Automatically validates token structure, sanitizes payload data,
     * and performs self-cleaning on stale/invalid device tokens.
     * 
     * @param {string} fcmToken Target device token
     * @param {object} payload Notification details
     * @param {string} payload.title Push title
     * @param {string} payload.body Push body message
     * @param {object} [payload.data] Optional key-value metadata payload (string values only)
     * @returns {Promise<boolean>} True if successfully delivered, false otherwise
     */
    async sendPushNotification(fcmToken, payload) {
        if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length < 10) {
            logger.warn('[PushNotificationService] Send skipped: Invalid or missing token format.');
            return false;
        }

        if (!payload || !payload.title || !payload.body) {
            logger.warn('[PushNotificationService] Send skipped: Missing title or body parameters.');
            return false;
        }

        try {
            if (!admin || !admin.apps.length) {
                logger.error('[PushNotificationService] Firebase Admin app is not initialized.');
                return false;
            }

            // Data fields must be strict strings for FCM transport safety
            const stringifiedData = {};
            if (payload.data && typeof payload.data === 'object') {
                for (const [key, val] of Object.entries(payload.data)) {
                    if (val !== undefined && val !== null) {
                        stringifiedData[key] = String(val);
                    }
                }
            }

            await admin.messaging().send({
                token: fcmToken,
                notification: {
                    title: payload.title,
                    body: payload.body
                },
                data: stringifiedData,
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'trendpulse_alerts'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default'
                        }
                    }
                }
            });

            logger.info(`[PushNotificationService] Delivered FCM push to prefix: ${fcmToken.substring(0, 10)}...`);
            return true;
        } catch (error) {
            const errCode = error.code;
            const errMsg = error.message || '';

            logger.warn(`[PushNotificationService] Delivery failure: ${errMsg} [Code: ${errCode}]`);

            // Detect expired, unregistered, or fundamentally invalid tokens
            const isStaleToken = 
                errCode === 'messaging/registration-token-not-registered' || 
                errCode === 'messaging/invalid-argument' || 
                errMsg.includes('registration token is not a valid') ||
                errMsg.includes('not registered') ||
                errMsg.includes('Requested entity was not found');

            if (isStaleToken) {
                try {
                    logger.info('[PushNotificationService] Auto-cleaning stale registration token from database...');
                    await User.updateMany({ fcmToken }, { $unset: { fcmToken: '' } });
                    logger.info('[PushNotificationService] Expired token removed successfully.');
                } catch (dbErr) {
                    logger.error('[PushNotificationService] Database token cleanup error: %s', dbErr.message);
                }
            }

            return false;
        }
    }
}

module.exports = new PushNotificationService();
