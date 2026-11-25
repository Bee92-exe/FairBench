/**
 * Admin override: pin, bump, PI reservation, outage, end outage
 * Owner: Sabbir (S-BE-5, S-BE-6, FR-21 to FR-31, FR-39, FR-40)
 */

import { withRead, withTransaction } from '../db/pool.js';
import {
  endOutageRow,
  getAttentionList,
  insertBookingRow,
  insertOutage,
  setMachineStatus,
  setRequestScheduled,
  supersedeBooking
} from '../db/queries.js';
import { applyPlacements } from './bookingService.js';
import { AppError, runWithRetry } from './errors.js';
import { notifyAdmins, notifyGrouped } from './notificationService.js';
import * as auditService from './auditService.js';
import { loadChangeContext, simulate, stateHash } from './previewService.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function assertAdmin(admin) {
  if (!admin || admin.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Only the lab administrator can do this', [], 403);
  }
}

export async function preview(admin, change, { now = new Date() } = {}) {
  assertAdmin(admin);
  return withRead(async (client) => {
    const context = await loadChangeContext(client, { now });
    const run = simulate(context, change);
    return {
      summary: run.summary,
      changes: run.changes,
      warnings: run.warnings,
      previewHash: stateHash(context)
    };
  });
}

/** Persist the change itself, before the re-planned bookings are written. */
async function persistChange(client, admin, change, context, note, now) {
  if (change.type === 'outage') {
    const outage = await insertOutage(client, {
      machineId: change.machineId,
      start: change.start,
      end: change.end,
      note: note ?? change.note ?? null,
      createdBy: admin.id
    });
    const start = new Date(change.start).getTime();
    const end = new Date(change.end).getTime();
    if (start <= now.getTime() && now.getTime() < end) {
      await setMachineStatus(client, change.machineId, 'out_of_service');
    }
    return { entityId: outage.id, action: 'outage' };
  }

  if (change.type === 'end_outage') {
    const outage = await endOutageRow(client, change.outageId, now);
    if (!outage) throw new AppError('NOT_FOUND', 'Outage not found or already ended', [], 404);
    await setMachineStatus(client, outage.machine_id, 'working');
    return { entityId: outage.id, action: 'end_outage' };
  }

  if (change.type === 'pin' || change.type === 'reserve') {
    const target = change.bookingId
      ? context.kept.find((item) => String(item.booking.id) === String(change.bookingId))
      : null;
    const pinnedRequestId = change.requestId ?? target?.request?.id ?? null;
    const machine = context.machines.find((item) => String(item.id) === String(change.machineId));
    const bufferMs = Number(machine?.bufferMinutes ?? 0) * 60 * 1000;
    const count = change.type === 'reserve' && change.recurrence?.freq === 'weekly'
      ? Math.min(Math.max(1, Number(change.recurrence.count ?? 1)), 26)
      : 1;

    const startBase = new Date(change.start).getTime();
    const endBase = new Date(change.end).getTime();
    let createdId = null;

    for (let index = 0; index < count; index += 1) {
      const start = new Date(startBase + index * WEEK_MS);
      const end = new Date(endBase + index * WEEK_MS);
      const booking = await insertBookingRow(client, {
        requestId: pinnedRequestId,
        machineId: change.machineId,
        kind: pinnedRequestId ? 'student' : 'pi_reserved',
        start,
        end,
        occupiedUntil: new Date(end.getTime() + bufferMs),
        pinned: true,
        setBy: 'admin',
        reason: change.type === 'reserve' ? 'PI reserved' : 'Pinned by Dr. Haque',
        note,
        createdBy: admin.id
      });
      if (!createdId) createdId = booking.id;
    }

    if (pinnedRequestId) {
      await setRequestScheduled(client, pinnedRequestId, { score: null, scoreBreakdown: null });
    }

    return { entityId: createdId, action: change.type };
  }

  if (change.type === 'bump') {
    const target = context.kept.find((item) => String(item.booking.id) === String(change.bookingId));
    if (target?.booking.startedAt) {
      throw new AppError('BOOKING_STARTED', 'A run that has already started cannot be bumped', [], 409);
    }
    return { entityId: change.bookingId, action: 'bump' };
  }

  throw new AppError('VALIDATION_ERROR', `Unknown change type: ${change.type}`);
}

export async function apply(admin, change, note = null, previewHash = null, { now = new Date() } = {}) {
  assertAdmin(admin);
  return runWithRetry(() => withTransaction(async (client) => {
    const context = await loadChangeContext(client, { now });

    if (previewHash && stateHash(context) !== previewHash) {
      const fresh = simulate(context, change);
      throw new AppError(
        'PREVIEW_STALE',
        'The schedule changed since the preview. Review the new impact and confirm again.',
        [fresh],
        409
      );
    }

    const run = simulate(context, change);

    // Old rows first, so the pinned block can never collide with the row it replaces.
    for (const bookingId of run.result.superseded ?? []) {
      await supersedeBooking(client, bookingId);
    }

    const persisted = await persistChange(client, admin, change, context, note, now);

    await applyPlacements(client, {
      placements: run.result.placements,
      moves: run.result.moves,
      unplaced: run.result.unplaced,
      supersededBookingIds: run.result.superseded,
      setBy: 'admin',
      actorId: admin.id
    });

    const entries = run.changes
      .filter((item) => item.studentId)
      .filter((item) => item.outcome !== 'placed' || item.before !== null)
      .map((item) => ({
        userId: item.studentId,
        type: item.outcome === 'unplaced'
          ? 'request_unplaced'
          : item.outcome === 'moved' ? 'booking_moved' : 'booking_created',
        message: `${item.reason}${note ? ` Note from Dr. Haque: ${note}` : ''}`,
        data: { requestId: item.requestId, machine: item.machine, before: item.before, after: item.after }
      }));
    await notifyGrouped(client, entries);

    if (run.summary.unplaced > 0 || run.summary.atRisk > 0) {
      await notifyAdmins(client, {
        type: 'admin_outage_impact',
        message: `${persisted.action} affected ${run.summary.affected} booking(s); ${run.summary.unplaced} could not be placed.`,
        data: { summary: run.summary }
      });
    }

    const auditId = await auditService.log(client, {
      actorId: admin.id,
      action: persisted.action,
      entityType: change.type === 'end_outage' ? 'outage' : change.type === 'outage' ? 'outage' : 'booking',
      entityId: persisted.entityId,
      details: { change: sanitizeChange(change), summary: run.summary, changes: run.changes },
      note
    });

    return { applied: true, summary: run.summary, auditId };
  }));
}

function sanitizeChange(change) {
  return JSON.parse(JSON.stringify(change, (_key, value) => value));
}

export async function listAttention(now = new Date()) {
  return withRead((client) => getAttentionList(client, now));
}
