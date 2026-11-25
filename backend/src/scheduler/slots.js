/**
 * Slot grid, opening intervals and free-block search
 * Owner: Sabbir (S-BE-1, FR-07, FR-11 to FR-13)
 */

import { addLocalDays, parseClock, toDate, zonedParts, zonedTimeToUtc } from './time.js';

const MINUTE = 60 * 1000;

export function gridSettings(request, machine, settings) {
  const slot = Math.max(1, Number(settings?.slotMinutes ?? 15));
  const duration = Number(request.durationMin);
  const bufferMinutes = Math.max(0, Number(machine?.bufferMinutes ?? 0));
  const blockMinutes = Math.ceil(duration / slot) * slot;
  const bufferBlocks = Math.ceil(bufferMinutes / slot);
  return {
    slot,
    slotMs: slot * MINUTE,
    blockMinutes,
    bufferMinutes,
    blockMs: blockMinutes * MINUTE,
    occupiedMs: (blockMinutes + bufferBlocks * slot) * MINUTE
  };
}

/**
 * Busy intervals per machine: kept bookings (occupied range) and outages.
 * Outage time after endedEarlyAt is free again (FR-31).
 */
export function buildBusy({ kept = [], outages = [] } = {}) {
  const byMachine = new Map();
  const push = (machineId, interval) => {
    if (!machineId || interval.end <= interval.start) return;
    if (!byMachine.has(machineId)) byMachine.set(machineId, []);
    byMachine.get(machineId).push(interval);
  };

  for (const item of kept) {
    const booking = item.booking ?? item;
    const start = toDate(booking.startAt ?? booking.start);
    const end = toDate(booking.occupiedUntil ?? booking.end ?? booking.endAt);
    if (!start || !end) continue;
    push(booking.machineId, {
      start: start.getTime(),
      end: end.getTime(),
      type: 'booking',
      ref: item
    });
  }

  for (const outage of outages) {
    const start = toDate(outage.startAt ?? outage.start);
    const end = toDate(outage.endAt ?? outage.end);
    if (!start || !end) continue;
    let endMs = end.getTime();
    const endedEarly = toDate(outage.endedEarlyAt);
    if (endedEarly) endMs = Math.min(endMs, endedEarly.getTime());
    push(outage.machineId, { start: start.getTime(), end: endMs, type: 'outage', ref: outage });
  }

  for (const list of byMachine.values()) {
    list.sort((a, b) => a.start - b.start || a.end - b.end);
  }
  return byMachine;
}

/**
 * Opening intervals inside [max(now, windowStart), windowEnd], one per opening day.
 * A job must start and end inside a single interval (never merged across closing).
 */
export function openingIntervals({ now, windowStart, windowEnd, settings }) {
  const timeZone = settings.timezone;
  const hours = settings.openingHours;
  const start = toDate(windowStart);
  const end = toDate(windowEnd);
  if (!start || !end || end <= start) return [];
  const openFrom = Math.max(start.getTime(), toDate(now)?.getTime() ?? 0);
  if (openFrom >= end.getTime()) return [];

  const days = new Set((hours?.days ?? [0, 1, 2, 3, 4]).map(Number));
  const open = parseClock(hours?.start ?? '09:00');
  const close = parseClock(hours?.end ?? '17:00');

  const keyOf = (parts) => `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const first = zonedParts(new Date(openFrom), timeZone);
  const last = zonedParts(end, timeZone);
  const lastKey = keyOf(last);

  const intervals = [];
  let cursor = { year: first.year, month: first.month, day: first.day };
  for (let guard = 0; guard < 400; guard += 1) {
    const key = keyOf(cursor);
    const weekday = new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day)).getUTCDay();
    if (days.has(weekday)) {
      const dayStart = zonedTimeToUtc({ ...cursor, ...open }, timeZone).getTime();
      const dayEnd = zonedTimeToUtc({ ...cursor, ...close }, timeZone).getTime();
      const from = Math.max(dayStart, openFrom);
      const to = Math.min(dayEnd, end.getTime());
      if (to > from) intervals.push({ start: from, end: to, dayKey: key });
    }
    if (key >= lastKey) break;
    cursor = addLocalDays(cursor, 1);
  }
  return intervals;
}

/** Opening minutes inside a window, used by the tightness score. */
export function availableMinutes({ now, windowStart, windowEnd, settings }) {
  return openingIntervals({ now, windowStart, windowEnd, settings })
    .reduce((sum, interval) => sum + (interval.end - interval.start), 0) / MINUTE;
}

function overlapsAny(startMs, endMs, busy) {
  if (!busy) return false;
  for (const interval of busy) {
    if (interval.start >= endMs) return false; // sorted by start
    if (interval.end > startMs && interval.start < endMs) return true;
  }
  return false;
}

/** First grid-aligned start in an opening interval where duration+buffer fit. */
function firstFitInInterval({ interval, busy, request, settings, grid }) {
  const timeZone = settings.timezone;
  const parts = zonedParts(new Date(interval.start), timeZone);
  const midnight = zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day }, timeZone
  ).getTime();
  const offset = interval.start - midnight;
  let start = interval.start + ((grid.slotMs - (offset % grid.slotMs)) % grid.slotMs);
  const lastJobEnd = Math.min(interval.end, toDate(request.windowEnd).getTime());

  for (let candidate = start; candidate + grid.blockMs <= lastJobEnd; candidate += grid.slotMs) {
    if (!overlapsAny(candidate, candidate + grid.occupiedMs, busy)) return candidate;
  }
  return null;
}

/**
 * Earliest continuous placement for one request. Never splits the job (FR-07).
 * Returns { start, end, occupiedUntil } or null.
 */
export function placeRequest({ request, machine, settings, busy = [], now }) {
  const intervals = openingIntervals({
    now,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    settings
  });
  const grid = gridSettings(request, machine, settings);
  for (const interval of intervals) {
    const start = firstFitInInterval({ interval, busy, request, settings, grid });
    if (start != null) {
      return {
        start: new Date(start),
        end: new Date(start + grid.blockMs),
        occupiedUntil: new Date(start + grid.occupiedMs)
      };
    }
  }
  return null;
}

/** True when the window has no feasible continuous block even on an empty machine. */
export function windowTooSmall({ request, machine, settings, now }) {
  const grid = gridSettings(request, machine, settings);
  const intervals = openingIntervals({
    now,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    settings
  });
  return !intervals.some((interval) => interval.end - interval.start >= grid.blockMs);
}

/** True when every opening minute in the window is covered by an outage. */
export function machineDownForWindow({ request, settings, now, outbreaksForMachine = [] }) {
  const intervals = openingIntervals({
    now,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    settings
  });
  if (intervals.length === 0) return false;
  return intervals.every((interval) =>
    outbreaksForMachine.some((outage) => outage.start <= interval.start && outage.end >= interval.end)
  );
}

export function slackMinutes(request, settings, now) {
  const available = availableMinutes({
    now,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    settings
  });
  return available - Number(request.durationMin);
}
