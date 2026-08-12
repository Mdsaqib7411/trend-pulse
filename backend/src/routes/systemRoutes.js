const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');

// Expose diagnostic status check endpoint
router.get('/status', SystemController.getSystemStatus);

// Expose aggregated intelligence telemetry for the Admin Dashboard
router.get('/intelligence-stats', SystemController.getIntelligenceStats);

// Phase 4B: Prediction accuracy statistics (lifecycle accuracy, Brier score, geo F1)
// Query params: ?days=30&category=AI
router.get('/prediction-accuracy', SystemController.getPredictionAccuracyStats);

module.exports = router;
