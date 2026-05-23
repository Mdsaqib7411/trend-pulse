const express = require('express');
const router = express.Router();
const trendController = require('../controllers/trendController');
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { 
    trendCategorySchema, trendSearchSchema, trendLocationSchema, 
    trendCompareSchema, idParamSchema, trendForYouSchema,
    trendEmergingSchema, trendHeatmapSchema, trendInteractSchema,
    trendBookmarkSchema
} = require('../validators/trendValidators');

// Public feed routes
router.get('/home', trendController.getHomeTrends);
router.get('/explore', trendController.exploreTrends);
router.get('/category', validate(trendCategorySchema), trendController.getCategory);
router.get('/search', validate(trendSearchSchema), trendController.search);
router.get('/location', validate(trendLocationSchema), trendController.byLocation);
router.get('/compare', validate(trendCompareSchema), trendController.compare);

// Geo-Intelligence Layer 3: Public heatmap endpoint
router.get('/heatmap', validate(trendHeatmapSchema), trendController.getHeatmap);

// Authenticated feed routes
router.get('/personalized', verifyToken, trendController.getPersonalized);
router.get('/foryou', verifyToken, validate(trendForYouSchema), trendController.getForYouFeed); // ?scope=local|national|global
router.get('/emerging', verifyToken, validate(trendEmergingSchema), trendController.getEmerging);

// Interaction tracking
router.post('/interact', verifyToken, validate(trendInteractSchema), trendController.recordInteraction);

// Bookmark toggle
router.post('/bookmark', verifyToken, validate(trendBookmarkSchema), trendController.toggleBookmark);

// Trend detail routes
router.get('/:id', validate(idParamSchema), trendController.getById);
router.get('/:id/stats', validate(idParamSchema), trendController.getStats);
router.get('/:id/analytics', validate(idParamSchema), trendController.getAnalytics);
router.get('/:id/history', validate(idParamSchema), trendController.getHistory);

// AI route for specific trend
router.get('/:id/analysis', validate(idParamSchema), aiController.getAnalysis);

// Phase 3.5: Trend relationship graph
router.get('/:id/graph', validate(idParamSchema), trendController.getGraph);

// Phase 3.5 Step 2: Viral spread prediction
router.get('/:id/prediction', validate(idParamSchema), trendController.getPrediction);

module.exports = router;
