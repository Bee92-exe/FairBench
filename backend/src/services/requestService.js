/**
 * Student request workflow
 * Owner: Sabbir (S-BE-4, FR-09, FR-10, FR-17)
 */

import { withRead, withTransaction } from '../db/pool.js';
import {
  cancelBooking,
  countOpenRequests,
  findActiveBookingForRequest,
  getRequestRow,
  getRequestWithBooking,
  insertRequest,
  listMachines,
  listRequestsForStudent,
  loadSchedulingState,
  loadSettings,
  mapRequestRow,
  minutesThisWeek,
  supersedeBooking,
  updateRequestFields
} from '../db/queries.js';
import { schedule } from '../scheduler/index.js';
import { AppError, runWithRetry } from './errors.js';
import { validateRequestInput, assertWithinQuota } from './validation.js';
import { applyPlacements } from './bookingService.js';
import { notifyAdmins, notifyGrouped } from './notificationService.js';

function notificationEntries(result, { createdRequestId = null } = {}) {
  const entries = [];
  for (const placement of result.placements) {
    entries.push({
      userId: placement.studentId,
      type: placement.requestId === createdRequestId ? 'booking_created' : 'booking_moved',
      message: placement.reason,
      data: {
        requestId: placement.requestId,
        machineId: placement.machineId,
        start: placement.start,
        end: placement.end
      }
    });
  }
  for (const move of result.moves ?? []) {
    entries.push({
      userId: move.studentId,
      type: 'booking_moved',
      message: move.reason,
      data: { requestId: move.requestId, machineId: move.machineId, start: move.start, end: move.end }
    });
  }
  for (const item of result.unplaced) {
    entries.push({
      userId: item.studentId,
      type: 'request_unplaced',
      message: `${item.reason} ${item.suggestion}`,
      data: { requestId: item.requestId, code: item.code }
    });
  }
  return entries.filter((entry) => entry.userId);
}

async function alertAdmins(client, result) {
  const unplaced = result.unplaced ?? [];
  if (unplaced.length === 0) return;
  const atRisk = unplaced.filter((item) => item.deadlineRisk);
  if (atRisk.length === 0) return;
  await notifyAdmins(client, {
    type: 'admin_deadline_risk',
    message: `${atRisk.length} request(s) could not be placed and a deadline is at risk. Review the needs-attention list.`,
    data: { requestIds: atRisk.map((item) => item.requestId) }
  });
}

function scheduleInput({ now, settings, machines, state, toPlace }) {
  return {
    now,
    settings,
    machines,
    outages: state.outages,
    kept: state.kept,
    toPlace,
    usage: state.usage,
    waitingSince: {}
  };
}

export async function submit(user, input, { now = new Date() } = {}) {
  return runWithRetry(() => withTransaction(async (client) => {
    const settings = await loadSettings(client);
    const machines = await listMachines(client);
    const machine = machines.find((item) => String(item.id) === String(input.machineId));
    validateRequestInput(input, { settings, machine, now });

    const openRequests = await countOpenRequests(client, user.id);
    const scheduledMinutes = await minutesThisWeek(client, user.id, settings.timezone);
    assertWithinQuota({
      settings,
      openRequests,
      scheduledMinutes,
      durationMin: Number(input.durationMin)
    });

    const row = await insertRequest(client, {
      studentId: user.id,
      machineId: input.machineId,
      durationMin: Number(input.durationMin),
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      isFixed: Boolean(input.isFixed),
      reason: input.reason ?? null,
      urgency: Number(input.urgency ?? 3)
    }, 'pending');

    const created = mapRequestRow({ ...row, full_name: user.name ?? null });
    const state = await loadSchedulingState(client, { machineId: created.machineId, settings });
    const toPlace = [...state.openRequests, created];

    const result = schedule(scheduleInput({ now, settings, machines, state, toPlace }));
    await applyPlacements(client, {
      placements: result.placements,
      moves: result.moves,
      unplaced: result.unplaced,
      setBy: 'system'
    });

    await notifyGrouped(client, notificationEntries(result, { createdRequestId: created.id }));
    await alertAdmins(client, result);

    return getRequestWithBooking(client, created.id);
  }));
}

export async function update(user, requestId, patch, { now = new Date() } = {}) {
  return runWithRetry(() => withTransaction(async (client) => {
    const existing = await getRequestRow(client, requestId);
    if (!existing) throw new AppError('NOT_FOUND', 'Request not found', [], 404);
    if (existing.student_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You can only edit your own requests', [], 403);
    }
    if (['cancelled', 'completed'].includes(existing.status)) {
      throw new AppError('VALIDATION_ERROR', `A ${existing.status} request cannot be edited`);
    }

    const booking = await findActiveBookingForRequest(client, requestId);
    if (booking?.started_at) {
      throw new AppError('BOOKING_STARTED', 'A run that has already started cannot be edited', [], 409);
    }

    const settings = await loadSettings(client);
    const machines = await listMachines(client);
    const merged = {
      machineId: patch.machineId ?? existing.machine_id,
      durationMin: patch.durationMin ?? existing.duration_min,
      windowStart: patch.windowStart ?? existing.window_start,
      windowEnd: patch.windowEnd ?? existing.window_end,
      isFixed: patch.isFixed ?? existing.is_fixed,
      reason: patch.reason ?? existing.reason,
      urgency: patch.urgency ?? existing.urgency
    };
    const machine = machines.find((item) => String(item.id) === String(merged.machineId));
    validateRequestInput(merged, { settings, machine, now });

    if (booking) await supersedeBooking(client, booking.id);

    await updateRequestFields(client, requestId, {
      machine_id: merged.machineId,
      duration_min: Number(merged.durationMin),
      window_start: merged.windowStart,
      window_end: merged.windowEnd,
      is_fixed: Boolean(merged.isFixed),
      reason: merged.reason ?? null,
      urgency: Number(merged.urgency)
    });

    const row = await getRequestRow(client, requestId);
    const updated = mapRequestRow(row);
    const state = await loadSchedulingState(client, { machineId: updated.machineId, settings });
    const toPlace = [
      updated,
      ...state.openRequests.filter((item) => item.id !== requestId)
    ];

    const result = schedule(scheduleInput({ now, settings, machines, state, toPlace }));
    await applyPlacements(client, {
      placements: result.placements,
      moves: result.moves,
      unplaced: result.unplaced,
      setBy: user.role === 'admin' ? 'admin' : 'system',
      actorId: user.id
    });

    await notifyGrouped(client, notificationEntries(result));
    await alertAdmins(client, result);

    return getRequestWithBooking(client, requestId);
  }));
}

export async function cancel(user, requestId, { now = new Date() } = {}) {
  return runWithRetry(() => withTransaction(async (client) => {
    const existing = await getRequestRow(client, requestId);
    if (!existing) throw new AppError('NOT_FOUND', 'Request not found', [], 404);
    if (existing.student_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You can only cancel your own requests', [], 403);
    }
    if (existing.status === 'completed') {
      throw new AppError('VALIDATION_ERROR', 'A completed request cannot be cancelled');
    }

    const booking = await findActiveBookingForRequest(client, requestId);
    if (booking?.started_at) {
      throw new AppError(
        'BOOKING_STARTED',
        'This run has already started. Ask Dr. Haque to handle it.',
        [],
        409
      );
    }
    if (booking) await cancelBooking(client, booking.id);

    const settings = await loadSettings(client);
    const machines = await listMachines(client);
    const { rows } = await client.query(
      "update requests set status = 'cancelled' where id = $1 returning *",
      [requestId]
    );
    const request = mapRequestRow(rows[0]);

    // Offer the freed time to waiting and unplaced requests (FR-09).
    const state = await loadSchedulingState(client, { machineId: existing.machine_id, settings });
    const toPlace = state.openRequests.filter((item) => item.id !== requestId);
    if (toPlace.length > 0) {
      const result = schedule(scheduleInput({ now, settings, machines, state, toPlace }));
      await applyPlacements(client, {
        placements: result.placements,
        moves: result.moves,
        unplaced: result.unplaced,
        setBy: 'system'
      });
      await notifyGrouped(client, notificationEntries(result));
      await alertAdmins(client, result);
    }

    return { request };
  }));
}

export async function listMine(user) {
  return withRead((client) => listRequestsForStudent(client, user.id));
}
