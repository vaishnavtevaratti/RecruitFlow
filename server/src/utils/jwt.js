/**
 * RecruitFlow — JWT Utility Functions
 */

const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN = '24h';

/**
 * Reads the signing secret lazily so it is always taken from server/.env.
 * There is deliberately no hardcoded fallback secret.
 */
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured. Set it in server/.env.');
    }
    return secret;
}

/**
 * Generate a JWT token for an authenticated user.
 * @param {Object} payload - User object (id, email, role, name)
 * @returns {string} Signed JWT token
 */
function generateToken(payload) {
    return jwt.sign(
        {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            name: payload.name
        },
        getSecret(),
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = {
    generateToken,
    verifyToken
};
