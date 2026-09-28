/**
 * RecruitFlow — Authentication & Role Authorization Middleware
 */

const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to ensure request has a valid JWT Bearer token.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. No authorization token provided.'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            message: 'Malformed authorization token. Expected Bearer <token>.'
        });
    }

    const token = parts[1];
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token. Please log in again.'
        });
    }
}

/**
 * Optional token authentication.
 * Attaches req.user if a valid token is provided, but does not block unauthenticated requests.
 */
function optionalAuthenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = verifyToken(token);
            req.user = decoded;
        } catch {
            // Token is invalid/expired; continue as unauthenticated
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
}

/**
 * Middleware to restrict access based on user role.
 * @param  {...string} roles - e.g. 'HR', 'ADMIN', 'INTERVIEWER'
 */
function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden. Role '${req.user.role}' lacks permission for this action.`
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    optionalAuthenticate,
    authorizeRoles
};
