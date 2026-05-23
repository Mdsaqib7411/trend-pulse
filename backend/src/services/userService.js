const User = require('../models/User');
const Trend = require('../models/Trend');

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
}

module.exports = new UserService();
