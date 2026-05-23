/**
 * UserActivity — Micro-interaction tracking for the "For You" recommendation engine.
 * 
 * System weights:
 *   Click: 1 | Like: 2 | Bookmark: 5 | Share: 7
 * 
 * A rolling 7-day window is enforced at query time via aggregation pipeline.
 */

const mongoose = require('mongoose');

const INTERACTION_WEIGHTS = {
    click: 1,
    like: 2,
    bookmark: 5,
    share: 7
};

const userActivitySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    trendId: {
        type: String,
        required: true
    },
    interactionType: {
        type: String,
        enum: ['click', 'like', 'bookmark', 'share'],
        required: true
    },
    weight: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        default: 'General'
    },
    keywords: [{
        type: String
    }]
}, { timestamps: true });

// Compound index for fast per-user aggregation queries
userActivitySchema.index({ userId: 1, createdAt: -1 });
// Compound index for deduplication checks
userActivitySchema.index({ userId: 1, trendId: 1, interactionType: 1 });
// TTL index: auto-delete interactions older than 30 days to bound collection growth
userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/**
 * Static helper: Record an interaction with automatic weight assignment.
 */
userActivitySchema.statics.recordInteraction = async function(userId, trendId, interactionType, category, keywords) {
    const weight = INTERACTION_WEIGHTS[interactionType] || 1;

    // Upsert to avoid duplicate click/like records per trend
    return this.findOneAndUpdate(
        { userId, trendId, interactionType },
        {
            $set: { weight, category, keywords },
            $setOnInsert: { userId, trendId, interactionType }
        },
        { upsert: true, new: true, maxTimeMS: 2000 }
    );
};

/**
 * Static helper: Build the user's weighted category preference map over a rolling 7-day window.
 * Returns: [{ _id: "AI", totalWeight: 42 }, { _id: "Cricket", totalWeight: 18 }, ...]
 */
userActivitySchema.statics.getUserWeightMap = function(userId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.aggregate([
        {
            $match: {
                userId,
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $group: {
                _id: '$category',
                totalWeight: { $sum: '$weight' },
                interactionCount: { $sum: 1 },
                keywords: { $addToSet: { $arrayElemAt: ['$keywords', 0] } }
            }
        },
        { $sort: { totalWeight: -1 } }
    ]).option({ maxTimeMS: 2000 });
};

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

module.exports = { UserActivity, INTERACTION_WEIGHTS };
