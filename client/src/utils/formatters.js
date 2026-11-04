/**
 * RecruitFlow — Utility Formatters
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Business time zone. Interview times come from the API as UTC instants and are always shown
 * in this zone, whatever the viewer's device is set to. Calendar dates are shown as-is.
 */
export const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'Asia/Kolkata';

const zonedParts = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

function partsOf(date) {
  const p = Object.fromEntries(zonedParts.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}

function parseInstant(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const m = typeof dateString === 'string' ? DATE_ONLY_RE.exec(dateString) : null;
  // Calendar dates ('YYYY-MM-DD') are not instants: render the same day everywhere
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : parseInstant(dateString);
  if (!d) return dateString;
  return d.toLocaleDateString('en-US', {
    timeZone: m ? 'UTC' : APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = parseInstant(dateString);
  if (!d) return dateString;
  return d.toLocaleString('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = Number(amount);
  if (isNaN(num)) return amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);
}

export function formatSalaryRange(min, max) {
  if ((min === null || min === undefined) && (max === null || max === undefined)) return 'Competitive';
  if (min === null || min === undefined) return `Up to ${formatCurrency(max)}`;
  if (max === null || max === undefined) return `From ${formatCurrency(min)}`;
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Calendar date in APP_TIMEZONE as 'YYYY-MM-DD', optionally offset by a number of days.
 * Suitable for <input type="date"> values and min attributes.
 */
export function dateInputValue(daysFromToday = 0) {
  const p = partsOf(new Date());
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + daysFromToday));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * An instant as APP_TIMEZONE wall time 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">.
 */
export function dateTimeInputValue(value = new Date()) {
  const p = partsOf(parseInstant(value) || new Date());
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/**
 * Instant for a 'YYYY-MM-DDTHH:mm' wall time in APP_TIMEZONE (mirrors the server's parsing).
 */
export function appWallTimeToDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offsetAt = (epoch) => {
    const p = partsOf(new Date(epoch));
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(epoch / 1000) * 1000;
  };
  let epoch = wall - offsetAt(wall);
  epoch = wall - offsetAt(epoch);
  return new Date(epoch);
}

/**
 * Extracts a user-facing message from an Axios error.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (err?.request && !err.response) return 'Cannot reach the RecruitFlow server. Check that the backend is running.';
  return err?.message || fallback;
}

export function splitSkills(skills) {
  if (!skills) return [];
  return String(skills)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
