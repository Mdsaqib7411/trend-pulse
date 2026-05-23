/**
 * Centralized API response utility for standardizing Express JSON outputs.
 */
class ApiResponse {
    /**
     * Standard success response
     * @param {Object} res Express response object
     * @param {string} message Description message
     * @param {*} data Data payload
     * @param {Object} [meta] Pagination or additional metadata
     * @param {number} [statusCode=200] HTTP status code
     */
    static success(res, message, data = null, meta = undefined, statusCode = 200) {
        const responsePayload = {
            success: true,
            message,
            data
        };
        if (meta !== undefined) {
            responsePayload.meta = meta;
            if (typeof meta === 'object' && meta !== null) {
                // Dynamically copy meta properties to the root to ensure 100% frontend backward compatibility
                Object.keys(meta).forEach(key => {
                    if (responsePayload[key] === undefined) {
                        responsePayload[key] = meta[key];
                    }
                });
            }
        }
        return res.status(statusCode).json(responsePayload);
    }

    /**
     * Standard error response
     * @param {Object} res Express response object
     * @param {string} message Error description message
     * @param {string|Error} [error] Technical error details or stack (masked in production)
     * @param {number} [statusCode=500] HTTP status code
     */
    static error(res, message, error = null, statusCode = 500) {
        const isDev = process.env.NODE_ENV === 'development';
        let errorDetails = null;

        if (error) {
            if (error instanceof Error) {
                errorDetails = isDev ? error.stack : error.message;
            } else {
                errorDetails = error;
            }
        }

        return res.status(statusCode).json({
            success: false,
            message,
            error: errorDetails
        });
    }

    /**
     * Standard validation error response
     * @param {Object} res Express response object
     * @param {string} message Validation failure message
     * @param {Array<Object>} errors Array of validation issue objects
     * @param {number} [statusCode=400] HTTP status code
     */
    static validation(res, message = 'Validation Failed', errors = [], statusCode = 400) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors
        });
    }

    /**
     * Standard paginated response
     * @param {Object} res Express response object
     * @param {string} message Description message
     * @param {Array} data Array data payload
     * @param {number} page Current page number
     * @param {number} limit Items per page limit
     * @param {number} total Total number of items across all pages
     * @param {number} [statusCode=200] HTTP status code
     */
    static pagination(res, message, data, page, limit, total, statusCode = 200) {
        const pages = Math.ceil(total / limit) || 0;
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            meta: {
                page: Number(page),
                limit: Number(limit),
                total: Number(total),
                pages
            }
        });
    }
}

module.exports = ApiResponse;
