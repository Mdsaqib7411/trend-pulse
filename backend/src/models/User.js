const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String },
    photoURL: { type: String },
    bio: { type: String, default: '' },
    fcmToken: { type: String },
    session: {
        deviceName: { type: String, default: '' },
        platform: { type: String, default: '' },
        lastLoginAt: { type: Date }
    },
    preferences: [{ type: String }], // e.g. ['AI Tech', 'Healthcare']
    interests: [{ type: String }],   // Granular keywords: ['GPT', 'robotics', 'NVIDIA']
    preferredSources: [{ type: String }], // e.g. ['YouTube', 'Reddit']
    savedTrends: [{ type: String }], // Array of trendIds (Strings)

    // Geo-Intelligence Layer 1
    location: {
        country: { type: String, default: '' },
        countryCode: { type: String, default: '' },
        state: { type: String, default: '' },
        city: { type: String, default: '' },
        timezone: { type: String, default: '' },
        resolvedAt: { type: Date }
    },
    deviceLocale: { type: String, default: 'en' },
    languageWeight: { type: Number, default: 1.0, min: 0, max: 2.0 },

    // Geo-Alert throttle (Layer 3)
    geoAlertCount: { type: Number, default: 0 },
    geoAlertResetAt: { type: Date }
}, { timestamps: true });

// Geo index for user location queries
userSchema.index({ 'location.country': 1, 'location.state': 1 });

module.exports = mongoose.model('User', userSchema);
