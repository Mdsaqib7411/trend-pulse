const aiService = require('../services/aiService');
const logger = require('../services/loggerService');
const ApiResponse = require('../utils/apiResponse');
const features = require('../config/features');
const Trend = require('../models/Trend');

exports.chat = async (req, res, next) => {
    // 1. Feature Flag Protection
    if (!features.ENABLE_AI_CHAT) {
        logger.warn('[AIChatController] Blocked request because ENABLE_AI_CHAT is disabled');
        return ApiResponse.error(res, 'AI Chat assistant is temporarily disabled.', null, 503);
    }

    try {
        const { message, trendId, trendContext, history } = req.body;
        
        let verifiedContext = null;
        const targetId = trendId || (trendContext && (trendContext.trendId || trendContext.id));

        if (targetId && targetId !== 'general') {
            // Load verified, read-only trend data from MongoDB to prevent client spoofing
            const trend = await Trend.findOne({ 
                $or: [
                    { trendId: targetId },
                    { url: targetId }
                ]
            }).lean();

            if (trend) {
                verifiedContext = {
                    title: trend.title,
                    description: trend.description || trend.content,
                    category: trend.category,
                    trendScore: trend.trendScore,
                    scoring: trend.scoring,
                    predictions: trend.predictions
                };
                logger.info(`[AIChatController] Securely loaded verified trendContext from MongoDB for targetId: ${targetId}`);
            } else {
                logger.warn(`[AIChatController] Target Trend ID not found in database: ${targetId}`);
            }
        }

        // 2. 15-second Request Timeout Protection
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI processing timed out (15s limit exceeded)')), 15000);
        });

        // Pass 100% database-verified context to the AI service
        const chatPromise = aiService.chatWithAI(message, verifiedContext, history, req.user?.uid);

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

