const aiService = require('../services/aiService');
const logger = require('../services/loggerService');
const ApiResponse = require('../utils/apiResponse');
const features = require('../config/features');

exports.chat = async (req, res, next) => {
    // 1. Feature Flag Protection
    if (!features.ENABLE_AI_CHAT) {
        logger.warn('[AIChatController] Blocked request because ENABLE_AI_CHAT is disabled');
        return ApiResponse.error(res, 'AI Chat assistant is temporarily disabled.', null, 503);
    }

    try {
        const { message, trendContext, history } = req.body;
        
        // 2. 15-second Request Timeout Protection
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI processing timed out (15s limit exceeded)')), 15000);
        });

        const chatPromise = aiService.chatWithAI(message, trendContext, history);

        // Race AI service call against timeout trigger
        const response = await Promise.race([chatPromise, timeoutPromise]);
        
        return ApiResponse.success(res, 'Chat response processed successfully', response);
    } catch (error) {
        logger.error('[AIChatController] Chat processing failed: %o', { 
            error: error.message, 
            stack: error.stack, 
            requestId: req.requestId 
        });
        
        const statusCode = error.message.includes('timed out') ? 504 : 500;
        return ApiResponse.error(res, error.message || 'Failed to process chat', null, statusCode);
    }
};
