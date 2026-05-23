const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');

// Expose diagnostic status check endpoint
router.get('/status', SystemController.getSystemStatus);

module.exports = router;
