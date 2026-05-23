const admin = require('../utils/firebaseAdmin');
const logger = require('../services/loggerService');
const ApiResponse = require('../utils/apiResponse');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('[AuthMiddleware] No valid Authorization Bearer header found for path: %s', req.path);
            return ApiResponse.error(res, 'Unauthorized: No token provided', null, 401);
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        // Verify the ID token using Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Attach the decoded token (which includes the uid) to the request object
        req.user = decodedToken;
        
        next();
    } catch (error) {
        logger.warn('[AuthMiddleware] Token verification failed for path: %s. Error: %s', req.path, error.message);
        return ApiResponse.error(res, 'Unauthorized: Invalid or expired token', null, 401);
    }
};

module.exports = { verifyToken };
