/**
 * Scheduler public API
 * Owner: Sabbir (S-BE-1, S-BE-2, FR-44, FR-45)
 *
 * Pure function: no database, no HTTP, no clock reads. `now` is always passed in.
 * Same inputs always produce the same schedule (determinism tests cover this).
 */

import { buildBusy, machineDownForWindow, placeRequest, windowTooSmall } from './slots.js';
import { computeScore, orderRequests } from './score.js';
import { tryRepair } from './repair.js';
import { movedReason, placedReason, repairedReason, suggestionFor, unplacedReason, deadlineRisk } from './explain.js';
import { toDate } from './time.js';

const DEFAULT_SETTINGS = {
  timezone: 'Asia/Dhaka',
  openingHours: { days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00' },
  slotMinutes: 15,
  quota: { weekly_hours: 10, open_requests: 5 },
  weights: { deadline: 0.4, tightness: 0.25, waiting: 0.15, fairness: 0.2 },
  scoreFeatures: { waiting: false, fairness: false }
};

export function normalizeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    openingHours: { ...DEFAULT_SETTINGS.openingHours, ...(raw.openingHours ?? {}) },
    quota: { ...DEFAULT_SETTINGS.quota, ...(raw.quota ?? {}) },
    weights: { ...DEFAULT_SETTINGS.weights, ...(raw.weights ?? {}) },
    scoreFeatures: { ...DEFAULT_SETTINGS.scoreFeatures, ...(raw.scoreFeatures ?? {}) }
  };
}

export function normalizeRequest(raw) {
  return {
    id: raw.id,
    studentId: raw.studentId ?? raw.student_id,
    studentName: raw.studentName ?? raw.full_name ?? null,
    machineId: raw.machineId ?? raw.machine_id,
    durationMin: Number(raw.durationMin ?? raw.duration_min),
    windowStart: toDate(raw.windowStart ?? raw.window_start),
    windowEnd: toDate(raw.windowEnd ?? raw.window_end),
    isFixed: Boolean(raw.isFixed ?? raw.is_fixed),
    reason: raw.reason ?? null,
    urgency: Number(raw.urgency ?? 3),
    status: raw.status ?? 'pending',
    createdAt: toDate(raw.createdAt ?? raw.created_at) ?? new Date(0)
  };
}

function normalizeKept(kept = []) {
  return kept.map((item) => {
    const booking = item.booking ?? item;
    return {
      ...item,
      request: item.request ? normalizeRequest(item.request) : null,
      booking: {
        ...booking,
        machineId: booking.machineId ?? booking.machine_id,
        startAt: toDate(booking.startAt ?? booking.start_at ?? booking.start),
        endAt: toDate(booking.endAt ?? booking.end_at ?? booking.end),
        occupiedUntil: toDate(booking.occupiedUntil ?? booking.occupied_until),
        pinned: Boolean(booking.pinned),
        startedAt: toDate(booking.startedAt ?? booking.started_at),
        kind: booking.kind ?? 'student'
      }
    };
  });
}

function insertBusy(busy, machineId, interval) {
  const list = busy.get(machineId) ?? [];
  list.push(interval);
  list.sort((a, b) => a.start - b.start || a.end - b.end);
  busy.set(machineId, list);
}

function unplacedEntry({ request, code, machine, settings, outages, scored, nowMs }) {
  const atRisk = deadlineRisk(request, nowMs);
  return {
    requestId: request.id,
    studentId: request.studentId,
    machineId: request.machineId,
    code,
    reason: unplacedReason({ code, request, machine, settings, outage: outages[0] }),
    suggestion: suggestionFor({ code, request }),
    deadlineRisk: atRisk,
    score: scored?.score ?? null,
    scoreBreakdown: scored?.breakdown ?? null
  };
}

export function schedule(input = {}) {
  const now = toDate(input.now) ?? new Date(0);
  const nowMs = now.getTime();
  const settings = normalizeSettings(input.settings);
  const machines = input.machines ?? [];
  const outages = input.outages ?? [];
  const kept = normalizeKept(input.kept);
  const machineById = new Map(machines.map((m) => [String(m.id), m]));
  const busy = buildBusy({ kept, outages });
  const quotaMinutes = Number(settings.quota.weekly_hours ?? 10) * 60;

  const ordered = orderRequests((input.toPlace ?? []).map(normalizeRequest), {
    now,
    settings,
    usage: input.usage ?? {},
    waitingSince: input.waitingSince ?? {},
    quotaMinutes
  });

  const placements = [];
  const unplaced = [];
  const moves = [];
  let repairs = 0;

  for (const { request, scored } of ordered) {
    const machine = machineById.get(String(request.machineId));
    if (!machine || !request.windowStart || !request.windowEnd) {
      unplaced.push(unplacedEntry({ request, code: 'WINDOW_TOO_SMALL', machine, settings, outages: [], scored, nowMs }));
      continue;
    }

    const machineBusy = busy.get(machine.id) ?? [];
    if (windowTooSmall({ request, machine, settings, now })) {
      unplaced.push(unplacedEntry({ request, code: 'WINDOW_TOO_SMALL', machine, settings, outages: [], scored, nowMs }));
      continue;
    }

    const machineOutages = machineBusy.filter((interval) => interval.type === 'outage').map((interval) => interval.ref);
    if (machineDownForWindow({ request, settings, now, outbreaksForMachine: machineBusy.filter((iv) => iv.type === 'outage') })) {
      unplaced.push(unplacedEntry({
        request, code: 'MACHINE_DOWN', machine, settings, outages: machineOutages.filter(Boolean), scored, nowMs
      }));
      continue;
    }

    let placement = placeRequest({ request, machine, settings, busy: machineBusy, now });
    let repair = null;

    if (!placement) {
      repair = tryRepair({ request, machine, settings, busy: machineBusy, kept, now });
      if (repair) {
        placement = repair.placement;
        repairs += 1;
      }
    }

    if (!placement) {
      unplaced.push(unplacedEntry({ request, code: 'NO_FREE_BLOCK', machine, settings, outages: machineOutages.filter(Boolean), scored, nowMs }));
      continue;
    }

    insertBusy(busy, machine.id, {
      start: placement.start.getTime(),
      end: placement.occupiedUntil.getTime(),
      type: 'booking',
      ref: { requestId: request.id, temporary: true }
    });

    placements.push({
      requestId: request.id,
      studentId: request.studentId,
      machineId: machine.id,
      start: placement.start,
      end: placement.end,
      occupiedUntil: placement.occupiedUntil,
      repaired: Boolean(repair),
      reason: repair
        ? repairedReason({ request, placement, settings })
        : placedReason({ request, placement, settings }),
      score: scored.score,
      scoreBreakdown: scored.breakdown
    });

    if (repair) {
      const movedRequest = repair.moved.request;
      const movedScored = computeScore(movedRequest, {
        now, settings, usage: input.usage ?? {}, waitingSince: input.waitingSince ?? {}, quotaMinutes
      });
      const surviving = (busy.get(machine.id) ?? []).filter((iv) => iv.ref !== repair.moved.kept);
      surviving.push({
        start: repair.moved.placement.start.getTime(),
        end: repair.moved.placement.occupiedUntil.getTime(),
        type: 'booking',
        ref: { bookingId: repair.moved.booking.id, moved: true }
      });
      surviving.sort((a, b) => a.start - b.start || a.end - b.end);
      busy.set(machine.id, surviving);

      moves.push({
        bookingId: repair.moved.booking.id,
        requestId: movedRequest.id,
        studentId: movedRequest.studentId,
        machineId: machine.id,
        start: repair.moved.placement.start,
        end: repair.moved.placement.end,
        occupiedUntil: repair.moved.placement.occupiedUntil,
        reason: movedReason({ placement: repair.moved.placement, settings, cause: 'a new request needed that time' }),
        score: movedScored.score,
        scoreBreakdown: movedScored.breakdown
      });
    }
  }

  return {
    placements,
    unplaced,
    moves,
    stats: {
      placed: placements.length,
      unplaced: unplaced.length,
      repairs,
      total: ordered.length
    }
  };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function intervalOfBooking(booking) {
  return [booking.startAt.getTime(), booking.occupiedUntil.getTime()];
}

/**
 * Stable re-plan (FR-39, FR-40): only affected bookings move, started ones are warned.
 * change = { type, machineId, start, end, bookingId?, requestId?, outageId?, recurrence? }
 */
export function replan(input = {}, change = {}) {
  const now = toDate(input.now) ?? new Date(0);
  const settings = normalizeSettings(input.settings);
  const kept = normalizeKept(input.kept);
  const outages = [...(input.outages ?? [])];
  const waiting = (input.waiting ?? []).map(normalizeRequest);
  const type = change.type;

  const start = toDate(change.start);
  const end = toDate(change.end);
  let targetKept = kept;
  let toPlace = [];
  let superseded = [];
  const warnings = [];

  const affected = (machineId, fromMs, toMs, { includeStarted = false } = {}) => {
    const touched = [];
    for (const item of targetKept) {
      if (item.booking.machineId !== machineId) continue;
      if (!item.booking.startAt || !item.booking.occupiedUntil) continue;
      const [from, to] = intervalOfBooking(item.booking);
      if (!overlaps(from, to, fromMs, toMs)) continue;
      if (item.locked) {
        if (includeStarted && item.booking.startedAt) {
          warnings.push({
            code: 'RUNNING_BOOKING',
            bookingId: item.booking.id,
            message: 'A run is in progress and cannot be moved'
          });
        }
        continue;
      }
      touched.push(item);
    }
    return touched;
  };

  if (type === 'pin' || type === 'reserve') {
    if (!start || !end) throw new Error('pin/reserve requires start and end');
    const machine = (input.machines ?? []).find((m) => String(m.id) === String(change.machineId));
    const bufferMin = Number(machine?.bufferMinutes ?? 0);
    const occupiedUntil = new Date(end.getTime() + bufferMin * 60 * 1000);
    const targetBooking = change.bookingId
      ? targetKept.find((item) => String(item.booking.id) === String(change.bookingId))
      : null;
    const pinnedRequestId = change.requestId ?? targetBooking?.request?.id ?? null;

    const block = {
      booking: {
        id: change.bookingId ?? `pin-${change.machineId}-${start.getTime()}`,
        requestId: pinnedRequestId,
        machineId: change.machineId,
        kind: pinnedRequestId ? 'student' : 'pi_reserved',
        startAt: start,
        endAt: end,
        occupiedUntil,
        pinned: true,
        startedAt: null
      },
      request: null,
      locked: true
    };

    const touched = affected(change.machineId, start.getTime(), occupiedUntil.getTime(), { includeStarted: true });
    const replanned = touched.filter((item) => !(pinnedRequestId && item.request?.id === pinnedRequestId));
    superseded = touched.map((item) => item.booking.id);
    toPlace = replanned.map((item) => item.request).filter(Boolean);
    const removed = new Set(touched);
    if (targetBooking) removed.add(targetBooking);
    targetKept = [...targetKept.filter((item) => !removed.has(item)), block];
  } else if (type === 'bump') {
    const item = targetKept.find((k) => String(k.booking.id) === String(change.bookingId));
    if (!item) throw new Error('booking not found for bump');
    if (item.booking.startedAt) {
      warnings.push({
        code: 'BOOKING_STARTED',
        bookingId: item.booking.id,
        message: 'This booking has already started and cannot be bumped'
      });
    } else {
      superseded = [item.booking.id];
      toPlace = [item.request].filter(Boolean);
      targetKept = targetKept.filter((k) => k !== item);
    }
  } else if (type === 'outage') {
    if (!start || !end) throw new Error('outage requires start and end');
    outages.push({
      id: change.outageId ?? `outage-${change.machineId}-${start.getTime()}`,
      machineId: change.machineId,
      startAt: start,
      endAt: end
    });
    const touched = affected(change.machineId, start.getTime(), end.getTime(), { includeStarted: true });
    superseded = touched.map((item) => item.booking.id);
    toPlace = touched.map((item) => item.request).filter(Boolean);
    targetKept = targetKept.filter((item) => !touched.includes(item));
  } else if (type === 'end_outage') {
    const outage = outages.find((o) => String(o.id) === String(change.outageId));
    if (!outage) throw new Error('outage not found');
    outage.endedEarlyAt = toDate(change.at) ?? now;
    toPlace = waiting.filter((request) => request.machineId === outage.machineId);
  } else if (type === 'cancel') {
    const item = targetKept.find((k) => String(k.booking.id) === String(change.bookingId));
    if (!item) throw new Error('booking not found for cancel');
    superseded = [item.booking.id];
    targetKept = targetKept.filter((k) => k !== item);
    toPlace = waiting.filter((request) => request.machineId === item.booking.machineId);
  } else {
    throw new Error(`unknown change type: ${type}`);
  }

  const result = schedule({
    now,
    settings,
    machines: input.machines ?? [],
    outages,
    kept: targetKept,
    toPlace,
    usage: input.usage ?? {},
    waitingSince: input.waitingSince ?? {}
  });

  return { ...result, superseded, warnings };
}

/**
 * Who a proposed change touches, without scheduling.
 * change as in replan(); state = { machines, kept, outages, waiting }.
 */
export function affectedBy(change = {}, state = {}) {
  const kept = normalizeKept(state.kept ?? []);
  const bookings = [];
  const warnings = [];
  const type = change.type;
  const start = toDate(change.start);
  const end = toDate(change.end);

  const collect = (machineId, fromMs, toMs) => {
    for (const item of kept) {
      if (item.booking.machineId !== machineId) continue;
      const [from, to] = intervalOfBooking(item.booking);
      if (!overlaps(from, to, fromMs, toMs)) continue;
      if (item.booking.startedAt) {
        warnings.push({
          code: 'RUNNING_BOOKING',
          bookingId: item.booking.id,
          message: 'A run is in progress and cannot be moved'
        });
        continue;
      }
      if (item.booking.pinned) continue;
      bookings.push(item);
    }
  };

  if (type === 'pin' || type === 'reserve' || type === 'outage') {
    if (start && end) collect(change.machineId, start.getTime(), end.getTime());
  } else if (type === 'bump' || type === 'cancel') {
    const item = kept.find((k) => String(k.booking.id) === String(change.bookingId));
    if (item) {
      if (item.booking.startedAt) {
        warnings.push({ code: 'BOOKING_STARTED', bookingId: item.booking.id, message: 'This booking has already started' });
      } else {
        bookings.push(item);
      }
    }
  }

  return { bookings: bookings.map((item) => item.booking), warnings };
}
