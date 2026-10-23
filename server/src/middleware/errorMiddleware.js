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

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Removes configured secrets from a message before it is logged.
 */
function sanitize(message) {
    let sanitized = message || 'Internal server error';
    for (const secret of [process.env.DB_PASSWORD, process.env.JWT_SECRET, process.env.AI_API_KEY]) {
        if (secret) {
            sanitized = sanitized.replace(new RegExp(escapeRegExp(secret), 'g'), '*****');
        }
    }
    return sanitized;
}

// MySQL errors caused by bad client input rather than a server fault
const MYSQL_CLIENT_ERRORS = {
    ER_DUP_ENTRY: { status: 409, message: 'A record with these details already exists.' },
    ER_TRUNCATED_WRONG_VALUE: { status: 400, message: 'One or more fields contain an invalid value.' },
    ER_WRONG_VALUE: { status: 400, message: 'One or more fields contain an invalid value.' },
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: { status: 400, message: 'One or more fields contain an invalid value.' },
    ER_DATA_TOO_LONG: { status: 400, message: 'One or more fields exceed the maximum allowed length.' },
    ER_WARN_DATA_OUT_OF_RANGE: { status: 400, message: 'A numeric field is out of the allowed range.' },
    ER_NO_REFERENCED_ROW_2: { status: 400, message: 'A referenced record does not exist.' }
};

/**
 * Global Error Handler
 * Business errors (err.statusCode set by services) are returned as-is.
 * Unexpected errors return a generic message so SQL or stack details never reach clients.
 */
function globalErrorHandler(err, req, res, next) {
    // express.json() parse failures carry err.status / err.type
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Request body contains invalid JSON.' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body is too large.' });
    }

    if (err.code && MYSQL_CLIENT_ERRORS[err.code]) {
        const mapped = MYSQL_CLIENT_ERRORS[err.code];
        return res.status(mapped.status).json({ success: false, message: mapped.message });
    }

    const statusCode = err.statusCode || err.status || 500;

    if (statusCode >= 500) {
        console.error(`[SERVER ERROR ${statusCode}]`, sanitize(err.message), err.code ? `(code: ${err.code})` : '');
        return res.status(statusCode).json({
            success: false,
            message: 'An unexpected server error occurred. Please try again.'
        });
    }

    res.status(statusCode).json({
        success: false,
        message: sanitize(err.message)
    });
}

module.exports = {
    notFoundHandler,
    globalErrorHandler
};
