/**
 * RecruitFlow — Utility Formatters
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses API dates. Calendar dates ('YYYY-MM-DD') are interpreted in local time so
 * deadlines and offer dates never shift by a day across timezones.
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = DATE_ONLY_RE.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = parseDate(dateString);
  if (!d) return dateString;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = parseDate(dateString);
  if (!d) return dateString;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
 * Local calendar date as 'YYYY-MM-DD', optionally offset by a number of days.
 * Suitable for <input type="date"> values and min attributes.
 */
export function dateInputValue(daysFromToday = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local date-time as 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">.
 */
export function dateTimeInputValue(value = new Date()) {
  const d = parseDate(value) || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
