const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { heavyLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { aiChatSchema } = require('../validators/aiValidators');

router.post('/chat', verifyToken, heavyLimiter, validate(aiChatSchema), aiChatController.chat);

module.exports = router;
