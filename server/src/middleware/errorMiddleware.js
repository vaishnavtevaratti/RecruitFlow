/**
 * RecruitFlow — Centralized Error Handling Middleware
 */

/**
 * 404 Route Handler
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Endpoint '${req.method} ${req.originalUrl}' not found.`
    });
}

/**
 * Global Error Handler
 */
function globalErrorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

    // Sanitize any password or secret before logging
    const dbPassword = process.env.DB_PASSWORD || '';
    const jwtSecret = process.env.JWT_SECRET || '';
    let sanitizedMessage = err.message || 'Internal server error';

    if (dbPassword) {
        sanitizedMessage = sanitizedMessage.replace(new RegExp(dbPassword, 'g'), '*****');
    }
    if (jwtSecret) {
        sanitizedMessage = sanitizedMessage.replace(new RegExp(jwtSecret, 'g'), '*****');
    }

    if (statusCode >= 500) {
        console.error(`[SERVER ERROR ${statusCode}]`, sanitizedMessage);
    }

    res.status(statusCode).json({
        success: false,
        message: sanitizedMessage
    });
}

module.exports = {
    notFoundHandler,
    globalErrorHandler
};
