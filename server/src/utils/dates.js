/**
 * RecruitFlow — Calendar Date Helpers
 * DATE columns are handled as 'YYYY-MM-DD' strings (see config/db.js) and compared
 * lexicographically against the server's local calendar date, which avoids timezone drift.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n) {
    return String(n).padStart(2, '0');
}

/**
 * Today's local calendar date as 'YYYY-MM-DD'.
 */
function todayDateOnly() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Normalizes a Date or 'YYYY-MM-DD...' string to 'YYYY-MM-DD' (local calendar date).
 * Returns null for empty/invalid input.
 */
function toDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const str = String(value).slice(0, 10);
    return isValidDateOnly(str) ? str : null;
}

/**
 * True when value is a real calendar date in strict 'YYYY-MM-DD' form.
 */
function isValidDateOnly(value) {
    if (typeof value !== 'string') return false;
    const m = DATE_ONLY_RE.exec(value);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/**
 * True when the calendar date has passed (strictly before today).
 */
function isPastDate(value) {
    const d = toDateOnly(value);
    return d !== null && d < todayDateOnly();
}

/**
 * Parses 'YYYY-MM-DDTHH:mm[:ss]' or 'YYYY-MM-DD HH:mm[:ss]' (local time).
 * Returns a normalized 'YYYY-MM-DD HH:mm:ss' string for MySQL DATETIME, or null if invalid.
 */
function normalizeDateTime(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!m || !isValidDateOnly(m[1])) return null;
    const [h, min, s] = [Number(m[2]), Number(m[3]), Number(m[4] || 0)];
    if (h > 23 || min > 59 || s > 59) return null;
    return `${m[1]} ${pad(h)}:${pad(min)}:${pad(s)}`;
}

/**
 * Converts a normalized local DATETIME string to a JS Date.
 */
function dateTimeToDate(normalized) {
    const [datePart, timePart] = normalized.split(' ');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi, s] = timePart.split(':').map(Number);
    return new Date(y, mo - 1, d, h, mi, s);
}

module.exports = {
    todayDateOnly,
    toDateOnly,
    isValidDateOnly,
    isPastDate,
    normalizeDateTime,
    dateTimeToDate
};
