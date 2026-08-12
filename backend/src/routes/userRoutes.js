const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { syncUserSchema, updateProfileSchema, saveTrendSchema } = require('../validators/userValidators');

router.post('/sync', verifyToken, validate(syncUserSchema), userController.syncUser);
router.post('/continuity/sync', verifyToken, userController.syncContinuity);
router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, validate(updateProfileSchema), userController.updateProfile);
router.delete('/profile', verifyToken, userController.deleteProfile);

// Saved Trends Routes
router.post('/save', verifyToken, validate(saveTrendSchema), userController.saveTrend);
router.get('/saved', verifyToken, userController.getSavedTrends);
router.delete('/save/:trendId', verifyToken, userController.unsaveTrend);

// Geo Profile (Layer 1)
router.get('/geo-profile', verifyToken, userController.getGeoProfile);

// FCM Token Registration
router.post('/fcm-token', verifyToken, userController.updateFcmToken);

module.exports = router;
