/**
 * RecruitFlow — Minimal in-memory brute-force limiter for authentication endpoints.
 * Only failed responses (4xx/5xx) count, so normal sign-ins are never throttled.
 * shortcut: per-process memory, so limits reset on restart and are not shared across
 * multiple server instances; move to a shared store if the API is scaled horizontally.
 */

function rateLimit({ windowMs = 15 * 60 * 1000, max = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10 } = {}) {
    const failures = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip;
        let entry = failures.get(key);
        if (entry && now > entry.resetAt) {
            failures.delete(key);
            entry = null;
        }

        if (entry && entry.count >= max) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({
                success: false,
                message: 'Too many failed attempts. Please wait a few minutes and try again.'
            });
        }

        res.on('finish', () => {
            if (res.statusCode < 400) return;
            const e = failures.get(key);
            if (e && Date.now() <= e.resetAt) e.count += 1;
            else failures.set(key, { count: 1, resetAt: Date.now() + windowMs });
            if (failures.size > 10000) {
                for (const [k, v] of failures) if (Date.now() > v.resetAt) failures.delete(k);
            }
        });
        next();
    };
}

module.exports = { rateLimit };
