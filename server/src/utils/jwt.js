/**
 * RecruitFlow — JWT Utility Functions
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'RecruitFlow_Local_Secret_Fallback';
const JWT_EXPIRES_IN = '24h';

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
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = {
    generateToken,
    verifyToken
};
