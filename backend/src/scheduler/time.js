/**
 * Scheduler time helpers
 * Owner: Sabbir (S-BE-1)
 * Pure: no Date.now(), no database. All conversions are explicit.
 * NFR-07: instants are UTC, lab rules are in the lab time zone.
 */

const formatterCache = new Map();

function formatter(timeZone) {
  let cached = formatterCache.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatterCache.set(timeZone, cached);
  }
  return cached;
}

const pad = (n) => String(n).padStart(2, '0');

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date, timeZone) {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') % 24;
  const minute = get('minute');
  const second = get('second');
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, second, weekday };
}

/** Offset of the zone at that instant, in milliseconds (wall - utc). */
export function offsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in the lab zone to a UTC instant. */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

export function addLocalDays({ year, month, day }, days) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function parseClock(text) {
  const [hour, minute] = String(text ?? '00:00').split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

export function localDateKey(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function startOfLocalDay(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, timeZone);
}

export function formatInZone(date, timeZone, options = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(date);
}

export function formatDayTime(date, timeZone) {
  const weekday = formatInZone(date, timeZone, { weekday: 'long' });
  const time = formatInZone(date, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${weekday} ${time}`;
}

export function formatDate(date, timeZone) {
  return formatInZone(date, timeZone, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toDate(value) {
  if (value instanceof Date) return value;
  if (value == null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
