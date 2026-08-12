const { z } = require('zod');
const logger = require('../services/loggerService');
const ApiResponse = require('../utils/apiResponse');

const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        return next();
    } catch (error) {
        logger.warn('Validation Failed: %o', { path: req.path, errors: error.errors || error.issues });
        const errorIssues = error.errors || error.issues || [];
        const errorArray = errorIssues.map(err => ({ field: err.path.join('.'), message: err.message }));
        return ApiResponse.validation(res, 'Validation failed', errorArray);
    }
};

module.exports = validate;
