/**
 * Geo Profile Service — IP-to-location resolver using geoip-lite.
 * 
 * Layer 1: Automatically resolves coarse geo-data from IP addresses
 * during registration/login without GPS permissions.
 * Captures deviceLocale for secondary languageWeight factor.
 */

const geoip = require('geoip-lite');
const User = require('../models/User');
const logger = require('./loggerService');

// Language weight mapping: boosts trends matching user's primary language
const LOCALE_WEIGHT_MAP = {
    'en': 1.0,
    'hi': 1.2,    // Hindi — boost for regional Indian content
    'ur': 1.15,   // Urdu
    'ar': 1.1,    // Arabic
    'es': 1.1,    // Spanish
    'zh': 1.05,   // Chinese
    'fr': 1.05,   // French
    'de': 1.0,    // German
    'ja': 1.0,    // Japanese
    'pt': 1.05    // Portuguese
};

class GeoProfileService {

    /**
     * Resolve IP address to coarse geo-data and persist to user document.
     * Called during registration and login flows.
     *
     * @param {string} userId — Firebase UID
     * @param {string} ip — Client IP address
     * @param {string} deviceLocale — e.g. 'en-US', 'hi-IN'
     * @returns {Object} Resolved location object
     */
    async resolveAndPersist(userId, ip, deviceLocale = 'en') {
        const location = this.resolveIP(ip);
        const primaryLocale = (deviceLocale || 'en').split('-')[0].toLowerCase();
        const languageWeight = LOCALE_WEIGHT_MAP[primaryLocale] || 1.0;

        try {
            await User.findOneAndUpdate(
                { uid: userId },
                {
                    $set: {
                        location: {
                            ...location,
                            resolvedAt: new Date()
                        },
                        deviceLocale: primaryLocale,
                        languageWeight
                    }
                },
                { upsert: false }
            );
            logger.info(`[GeoProfile] Resolved ${userId}: ${location.city}, ${location.state}, ${location.country} (locale: ${primaryLocale}, weight: ${languageWeight})`);
        } catch (err) {
            logger.error('[GeoProfile] Persist error: %s', err.message);
        }

        return { ...location, deviceLocale: primaryLocale, languageWeight };
    }

    /**
     * Pure IP-to-location resolution. No database writes.
     * Returns coarse geo-data: { country, countryCode, state, city, timezone }
     */
    resolveIP(ip) {
        // Handle localhost / private IPs
        const cleanIp = this.normalizeIP(ip);
        const geo = geoip.lookup(cleanIp);

        if (!geo) {
            return {
                country: 'Unknown',
                countryCode: '',
                state: '',
                city: '',
                timezone: ''
            };
        }

        return {
            country: geo.country || '',
            countryCode: geo.country || '',
            state: geo.region || '',
            city: geo.city || '',
            timezone: geo.timezone || ''
        };
    }

    /**
     * Get a user's cached geo profile from the database.
     */
    async getUserGeoProfile(userId) {
        const user = await User.findOne(
            { uid: userId },
            { location: 1, deviceLocale: 1, languageWeight: 1 }
        ).lean();

        if (!user || !user.location || !user.location.country) {
            return null;
        }

        return {
            country: user.location.country,
            countryCode: user.location.countryCode,
            state: user.location.state,
            city: user.location.city,
            timezone: user.location.timezone,
            deviceLocale: user.deviceLocale || 'en',
            languageWeight: user.languageWeight || 1.0
        };
    }

    /**
     * Normalize IP: strip IPv6 prefix, handle proxied headers.
     */
    normalizeIP(ip) {
        if (!ip) return '0.0.0.0';
        // Strip IPv6-mapped IPv4 prefix
        if (ip.startsWith('::ffff:')) return ip.substring(7);
        // Handle comma-separated proxy chains (X-Forwarded-For)
        if (ip.includes(',')) return ip.split(',')[0].trim();
        return ip;
    }
}

module.exports = new GeoProfileService();
