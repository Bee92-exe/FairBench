/**
 * Shared test fixtures (TESTING.md section 3)
 * Fixed clock: Sunday 22 Nov 2026, 09:00 Asia/Dhaka. Tests never read the real clock.
 */

import { normalizeSettings } from '../src/scheduler/index.js';
import { zonedTimeToUtc } from '../src/scheduler/time.js';

export const TZ = 'Asia/Dhaka';

export const settings = normalizeSettings({
  timezone: TZ,
  openingHours: { days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00' },
  slotMinutes: 15,
  quota: { weekly_hours: 10, open_requests: 5 },
  weights: { deadline: 0.4, tightness: 0.25, waiting: 0.15, fairness: 0.2 },
  scoreFeatures: { waiting: false, fairness: false }
});

export const machines = [
  { id: 'm-micro', name: 'Microscope', bufferMinutes: 10 },
  { id: 'm-cent', name: 'Centrifuge', bufferMinutes: 10 },
  { id: 'm-spec', name: 'Spectrophotometer', bufferMinutes: 20 }
];

/** 22 Nov 2026 is a Sunday. Nov 27/28 are Friday/Saturday (closed). */
export function at(day, hour = 9, minute = 0) {
  return zonedTimeToUtc({ year: 2026, month: 11, day, hour, minute }, TZ);
}

export const NOW = at(22, 9);

let sequence = 0;
export function resetSequence() {
  sequence = 0;
}

export function makeRequest(overrides = {}) {
  sequence += 1;
  return {
    id: `req-${String(sequence).padStart(4, '0')}`,
    studentId: `stu-${((sequence - 1) % 5) + 1}`,
    studentName: `Student ${((sequence - 1) % 5) + 1}`,
    machineId: 'm-micro',
    durationMin: 60,
    windowStart: at(23, 9),
    windowEnd: at(23, 17),
    isFixed: false,
    reason: null,
    urgency: 3,
    createdAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
    ...overrides
  };
}

export function keptBooking({
  id,
  request,
  start,
  end,
  bufferMinutes = 10,
  pinned = false,
  startedAt = null,
  kind = 'student'
}) {
  return {
    booking: {
      id,
      requestId: request?.id ?? null,
      machineId: request?.machineId ?? 'm-micro',
      kind,
      startAt: start,
      endAt: end,
      occupiedUntil: new Date(end.getTime() + bufferMinutes * 60 * 1000),
      pinned,
      startedAt
    },
    request: request ?? null,
    locked: pinned || Boolean(startedAt) || kind === 'pi_reserved'
  };
}

export function overlaps(first, second) {
  return first.start < second.end && second.start < first.end;
}

export function assertNoOverlap(placements) {
  const byMachine = new Map();
  for (const placement of placements) {
    if (!byMachine.has(placement.machineId)) byMachine.set(placement.machineId, []);
    byMachine.get(placement.machineId).push(placement);
  }
  for (const list of byMachine.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = { start: new Date(list[i].start).getTime(), end: new Date(list[i].occupiedUntil).getTime() };
        const b = { start: new Date(list[j].start).getTime(), end: new Date(list[j].occupiedUntil).getTime() };
        if (overlaps(a, b)) {
          throw new Error(`overlap on ${list[i].machineId}: ${new Date(a.start).toISOString()} and ${new Date(b.start).toISOString()}`);
        }
      }
    }
  }
}

export const dim = (date) => new Date(date).getTime();
