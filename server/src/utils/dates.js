/**
 * RecruitFlow — Date & Time Helpers
 *
 * Time zone strategy:
 * - Calendar dates (deadlines, offer dates) are DATE columns handled as 'YYYY-MM-DD' strings
 *   (see config/db.js). "Today" is the calendar date in APP_TIMEZONE, so deadlines and offer
 *   expiry follow the business's day, not the server's or the database's.
 * - Interview times are stored in UTC (DATETIME, session time zone +00:00, mysql2 timezone 'Z')
 *   and returned to clients as ISO-8601 UTC instants. Clients display them in APP_TIMEZONE.
 * - A date-time sent without an offset ('YYYY-MM-DDTHH:mm', what <input type="datetime-local">
 *   produces) is wall-clock time in APP_TIMEZONE. A value with 'Z' or '+05:30' is used as given.
 */

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n) {
    return String(n).padStart(2, '0');
}

// Throws early on an invalid APP_TIMEZONE instead of failing on the first request
const dateTimeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

/** Wall-clock fields of an instant in APP_TIMEZONE. */
function zonedParts(date) {
    const p = Object.fromEntries(dateTimeParts.formatToParts(date).map((x) => [x.type, x.value]));
    return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}

/** Milliseconds APP_TIMEZONE is ahead of UTC at the given instant. */
function zoneOffsetMs(epochMs) {
    const p = zonedParts(new Date(epochMs));
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(epochMs / 1000) * 1000;
}

/** Instant of a wall-clock time in APP_TIMEZONE (second pass settles DST transitions). */
function zonedWallTimeToDate(y, mo, d, h, mi, s) {
    const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
    let epoch = wallAsUtc - zoneOffsetMs(wallAsUtc);
    epoch = wallAsUtc - zoneOffsetMs(epoch);
    return new Date(epoch);
}

/**
 * Today's calendar date in APP_TIMEZONE as 'YYYY-MM-DD'.
 */
function todayDateOnly(now = new Date()) {
    const p = zonedParts(now);
    return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/**
 * Normalizes a Date (calendar date in APP_TIMEZONE) or 'YYYY-MM-DD...' string to 'YYYY-MM-DD'.
 * Returns null for empty/invalid input.
 */
function toDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return todayDateOnly(value);
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
    const date = new Date(Date.UTC(y, mo - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * True when the calendar date has passed (strictly before today in APP_TIMEZONE).
 */
function isPastDate(value) {
    const d = toDateOnly(value);
    return d !== null && d < todayDateOnly();
}

/**
 * Parses 'YYYY-MM-DDTHH:mm[:ss]' (APP_TIMEZONE wall time) or the same with 'Z' / '±HH:MM'.
 * Returns the UTC 'YYYY-MM-DD HH:mm:ss' string to store in a DATETIME column, or null if invalid.
 */
function normalizeDateTime(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/.exec(value.trim());
    if (!m || !isValidDateOnly(m[1])) return null;
    const [y, mo, d] = m[1].split('-').map(Number);
    const [h, mi, s] = [Number(m[2]), Number(m[3]), Number(m[4] || 0)];
    if (h > 23 || mi > 59 || s > 59) return null;

    let instant;
    if (!m[5]) {
        instant = zonedWallTimeToDate(y, mo, d, h, mi, s);
    } else {
        const offsetMin = m[5] === 'Z' ? 0 : (m[5][0] === '-' ? -1 : 1) * (Number(m[5].slice(1, 3)) * 60 + Number(m[5].slice(4)));
        instant = new Date(Date.UTC(y, mo - 1, d, h, mi, s) - offsetMin * 60000);
    }
    return instant.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Converts a stored UTC DATETIME string ('YYYY-MM-DD HH:mm:ss') to a JS Date.
 */
function dateTimeToDate(utcDateTime) {
    return new Date(`${utcDateTime.replace(' ', 'T')}Z`);
}

module.exports = {
    APP_TIMEZONE,
    todayDateOnly,
    toDateOnly,
    isValidDateOnly,
    isPastDate,
    normalizeDateTime,
    dateTimeToDate
};
