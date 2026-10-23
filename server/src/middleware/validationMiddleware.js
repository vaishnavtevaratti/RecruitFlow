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

/**
 * True when value is an absolute http(s) URL. Blocks javascript:/data: links
 * that would otherwise be rendered as clickable hrefs in the HR portal.
 */
function isHttpUrl(value) {
    if (typeof value !== 'string' || value.length > 500) return false;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Builds a 400 error for service-level validation failures.
 */
function badRequest(message) {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
}

/**
 * Validates optional/required string fields against max lengths.
 * @param {Object} data - source object
 * @param {Object} rules - { field: { max, required, label } }
 * @throws 400 error describing the first invalid field
 */
function assertStringFields(data, rules) {
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        const label = rule.label || field;
        if (value === undefined || value === null || value === '') {
            if (rule.required) throw badRequest(`${label} is required.`);
            continue;
        }
        if (typeof value !== 'string') throw badRequest(`${label} must be text.`);
        if (rule.required && value.trim() === '') throw badRequest(`${label} is required.`);
        if (value.trim().length > rule.max) {
            throw badRequest(`${label} must be at most ${rule.max} characters.`);
        }
    }
}

module.exports = {
    requireFields,
    isValidEmail,
    validateEmailField,
    validateParamId,
    isHttpUrl,
    badRequest,
    assertStringFields
};
