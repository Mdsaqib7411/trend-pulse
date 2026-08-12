const User = require('../models/User');
const Trend = require('../models/Trend');
const { UserActivity } = require('../models/UserActivity');

class UserService {
    async syncUser(userData) {
        let user = await User.findOne({ uid: userData.uid });
        if (!user) {
            user = await User.create(userData);
        } else {
            // Update email/photo if changed
            user.email = userData.email || user.email;
            user.displayName = userData.displayName || user.displayName;
            user.photoURL = userData.photoURL || user.photoURL;
            if (userData.session) {
                user.session = userData.session;
            }
            await user.save();
        }
        return user;
    }

    async updateProfile(uid, profileData) {
        return await User.findOneAndUpdate(
            { uid },
            { $set: profileData },
            { new: true }
        );
    }

    async getProfile(uid) {
        return await User.findOne({ uid });
    }

    async deleteProfile(uid) {
        return await User.findOneAndDelete({ uid });
    }

    async saveTrend(uid, trendId) {
        return await User.findOneAndUpdate(
            { uid },
            { $addToSet: { savedTrends: trendId } },
            { new: true, upsert: true }
        );
    }

    async unsaveTrend(uid, trendId) {
        return await User.findOneAndUpdate(
            { uid },
            { $pull: { savedTrends: trendId } },
            { new: true, upsert: true }
        );
    }

    async getSavedTrends(uid) {
        const user = await User.findOne({ uid });
        if (!user || !user.savedTrends || user.savedTrends.length === 0) {
            return [];
        }
        // Fetch full trend details for all saved trendIds
        const trends = await Trend.find({ trendId: { $in: user.savedTrends } });
        return trends;
    }

    async updateFcmToken(uid, fcmToken, platform) {
        return await User.findOneAndUpdate(
            { uid },
            { 
                $set: { 
                    fcmToken,
                    'session.platform': platform || 'unknown'
                } 
            },
            { new: true }
        );
    }

    async syncContinuity(uid, syncData) {
        const user = await User.findOne({ uid });
        if (!user) {
            throw new Error('User not found');
        }

        // 1. Merge saved trends safely
        const localSavedTrends = Array.isArray(syncData.savedTrends) ? syncData.savedTrends : [];
        const dbSavedTrends = Array.isArray(user.savedTrends) ? user.savedTrends : [];
        const mergedSavedTrends = [...new Set([...localSavedTrends, ...dbSavedTrends])];

        // 2. Merge preferences & interests (Manual AI Memory configuration signals)
        const localPref = Array.isArray(syncData.preferences) ? syncData.preferences : [];
        const dbPref = Array.isArray(user.preferences) ? user.preferences : [];
        const mergedPref = [...new Set([...localPref, ...dbPref])];

        const localInt = Array.isArray(syncData.interests) ? syncData.interests : [];
        const dbInt = Array.isArray(user.interests) ? user.interests : [];
        const mergedInt = [...new Set([...localInt, ...dbInt])];

        // 3. Merge recent searches safely (bounded to 15 entries for performance)
        const localSearches = Array.isArray(syncData.recentSearches) ? syncData.recentSearches : [];
        const dbSearches = Array.isArray(user.recentSearches) ? user.recentSearches : [];
        const mergedRecentSearches = [...new Set([...localSearches, ...dbSearches])].slice(0, 15);

        // 4. Record offline dynamic user interaction/affinity logs
        const pendingActs = Array.isArray(syncData.pendingActivities) ? syncData.pendingActivities : [];
        if (pendingActs.length > 0) {
            await Promise.all(
                pendingActs.map(async (act) => {
                    try {
                        await UserActivity.recordInteraction(
                            uid,
                            act.trendId,
                            act.interactionType,
                            act.category || 'General',
                            act.keywords || []
                        );
                    } catch (err) {
                        console.error('[UserService] Failed to record offline interaction:', err.message);
                    }
                })
            );
        }

        // 5. Update user state
        user.savedTrends = mergedSavedTrends;
        user.preferences = mergedPref;
        user.interests = mergedInt;
        user.recentSearches = mergedRecentSearches;
        await user.save();

        return {
            savedTrends: user.savedTrends,
            preferences: user.preferences,
            interests: user.interests,
            recentSearches: user.recentSearches
        };
    }
}

module.exports = new UserService();
