/**
 * What-If dry run (AF-01, AF-02)
 * Owner: Sabbir (S-BE-7)
 *
 * A preview runs the scheduler on an in-memory copy of the schedule.
 * Nothing is written until the admin confirms.
 */

import crypto from 'node:crypto';
import { listMachines, loadSchedulingState, loadSettings } from '../db/queries.js';
import { replan } from '../scheduler/index.js';

export async function loadChangeContext(client, { now }) {
  const settings = await loadSettings(client);
  const machines = await listMachines(client);
  const state = await loadSchedulingState(client, { machineId: null, settings });
  return { now, settings, machines, ...state };
}

/** Cheap fingerprint of the schedule, used to reject stale confirmations. */
export function stateHash(context) {
  const parts = [
    ...context.kept.map((item) =>
      `b:${item.booking.id}:${new Date(item.booking.startAt).toISOString()}:${item.booking.pinned ? 1 : 0}`
    ),
    ...context.outages.map((outage) => `o:${outage.id}:${new Date(outage.startAt).toISOString()}`)
  ].sort();
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function machineName(machines, machineId) {
  return machines.find((machine) => String(machine.id) === String(machineId))?.name ?? null;
}

/** Run one change against the loaded state and describe the diff. */
export function simulate(context, change) {
  const result = replan({
    now: context.now,
    settings: context.settings,
    machines: context.machines,
    outages: context.outages,
    kept: context.kept,
    waiting: context.openRequests,
    usage: context.usage,
    waitingSince: {}
  }, change);

  const beforeByRequest = new Map();
  for (const item of context.kept) {
    if (item.request) beforeByRequest.set(item.request.id, item);
  }

  const changes = [];

  for (const placement of result.placements) {
    const before = beforeByRequest.get(placement.requestId);
    changes.push({
      requestId: placement.requestId,
      studentId: before?.request?.studentId ?? placement.studentId ?? null,
      studentName: before?.studentName ?? null,
      machine: machineName(context.machines, placement.machineId),
      before: before ? { start: before.booking.startAt, end: before.booking.endAt } : null,
      after: { start: placement.start, end: placement.end },
      outcome: before ? 'moved' : 'placed',
      risk: Boolean(before?.request?.isFixed),
      reason: placement.reason
    });
  }

  for (const move of result.moves ?? []) {
    const before = context.kept.find((item) => item.booking.id === move.bookingId);
    if (!before) continue;
    changes.push({
      requestId: move.requestId,
      studentId: move.studentId,
      studentName: before.studentName ?? null,
      machine: machineName(context.machines, move.machineId),
      before: { start: before.booking.startAt, end: before.booking.endAt },
      after: { start: move.start, end: move.end },
      outcome: 'moved',
      risk: Boolean(before.request?.isFixed),
      reason: move.reason
    });
  }

  for (const item of result.unplaced) {
    const before = beforeByRequest.get(item.requestId);
    changes.push({
      requestId: item.requestId,
      studentId: item.studentId ?? before?.request?.studentId ?? null,
      studentName: before?.studentName ?? null,
      machine: machineName(context.machines, item.machineId),
      before: before ? { start: before.booking.startAt, end: before.booking.endAt } : null,
      after: null,
      outcome: 'unplaced',
      risk: Boolean(item.deadlineRisk),
      reason: `${item.reason} ${item.suggestion}`
    });
  }

  const summary = {
    affected: changes.length,
    moved: changes.filter((item) => item.outcome === 'moved').length,
    placed: changes.filter((item) => item.outcome === 'placed').length,
    unplaced: changes.filter((item) => item.outcome === 'unplaced').length,
    atRisk: changes.filter((item) => item.risk).length
  };

  return {
    summary,
    changes,
    warnings: result.warnings ?? [],
    result
  };
}
