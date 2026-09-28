/**
 * RecruitFlow — Input Validation Middleware & Helpers
 */

/**
 * Validates that specified required fields are present and non-empty in req.body.
 * @param {Array<string>} fields
 */
function requireFields(fields) {
    return (req, res, next) => {
        const missing = [];
        for (const field of fields) {
            const val = req.body[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required field(s): ${missing.join(', ')}`
            });
        }
        next();
    };
}

/**
 * Validates email format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

/**
 * Middleware to validate email field in req.body.
 */
function validateEmailField(fieldName = 'email') {
    return (req, res, next) => {
        const email = req.body[fieldName];
        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: `Invalid email address format for '${fieldName}'.`
            });
        }
        next();
    };
}

/**
 * Middleware to validate integer parameter in req.params (e.g. :id).
 */
function validateParamId(paramName = 'id') {
    return (req, res, next) => {
        const id = Number(req.params[paramName]);
        if (!id || isNaN(id) || id <= 0 || !Number.isInteger(id)) {
            return res.status(400).json({
                success: false,
                message: `Invalid identifier parameter '${paramName}'. Must be a positive integer.`
            });
        }
        next();
    };
}

module.exports = {
    requireFields,
    isValidEmail,
    validateEmailField,
    validateParamId
};
