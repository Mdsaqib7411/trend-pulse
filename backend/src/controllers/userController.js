const userService = require('../services/userService');
const geoProfileService = require('../services/geoProfileService');
const ApiResponse = require('../utils/apiResponse');

exports.syncUser = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { email, displayName, photoURL, deviceLocale, session } = req.body;
        
        if (!uid || !email) return ApiResponse.error(res, 'UID and email are required', null, 400);
        
        const user = await userService.syncUser({ uid, email, displayName, photoURL, session });

        // Layer 1: Auto-resolve geo location from IP on sync
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const geoResult = await geoProfileService.resolveAndPersist(uid, clientIp, deviceLocale);

        return ApiResponse.success(res, 'User synchronized successfully', user, { geo: geoResult });
    } catch (error) {
        next(error);
    }
};

exports.getProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const user = await userService.getProfile(uid);
        if (!user) return ApiResponse.error(res, 'User not found', null, 404);
        return ApiResponse.success(res, 'Profile retrieved successfully', user);
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { preferences, fcmToken, displayName, photoURL, bio, interests, preferredSources } = req.body;
        
        const updatedUser = await userService.updateProfile(uid, { 
            preferences, fcmToken, displayName, photoURL, bio, interests, preferredSources 
        });
        return ApiResponse.success(res, 'Profile updated successfully', updatedUser);
    } catch (error) {
        next(error);
    }
};

exports.saveTrend = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { trendId } = req.body;
        
        if (!trendId) return ApiResponse.error(res, 'Trend ID is required', null, 400);
        
        await userService.saveTrend(uid, trendId);
        return ApiResponse.success(res, 'Trend saved successfully');
    } catch (error) {
        next(error);
    }
};

exports.unsaveTrend = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { trendId } = req.params;
        
        if (!trendId) return ApiResponse.error(res, 'Trend ID is required', null, 400);
        
        await userService.unsaveTrend(uid, trendId);
        return ApiResponse.success(res, 'Trend removed successfully');
    } catch (error) {
        next(error);
    }
};

exports.getSavedTrends = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        
        const savedTrends = await userService.getSavedTrends(uid);
        return ApiResponse.success(res, 'Saved trends retrieved successfully', savedTrends);
    } catch (error) {
        next(error);
    }
};

// Layer 1: Get user's resolved geo profile
exports.getGeoProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const geoProfile = await geoProfileService.getUserGeoProfile(uid);
        return ApiResponse.success(res, 'User geo profile retrieved successfully', geoProfile || { country: 'Unknown', state: '', city: '' });
    } catch (error) {
        next(error);
    }
};

exports.deleteProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const result = await userService.deleteProfile(uid);
        if (!result) return ApiResponse.error(res, 'User not found', null, 404);
        return ApiResponse.success(res, 'User profile deleted successfully');
    } catch (error) {
        next(error);
    }
};
