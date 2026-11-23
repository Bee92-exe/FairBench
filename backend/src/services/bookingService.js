/**
 * Booking writes for one scheduling run
 * Owner: Sabbir (S-BE-3, FR-11, NFR-03, NFR-05)
 *
 * The caller opens the transaction and holds the advisory lock. This module
 * supersedes first, then inserts, so no temporary overlap is ever visible.
 */

import {
  insertBookingRow,
  setRequestScheduled,
  setRequestUnplaced,
  supersedeBooking
} from '../db/queries.js';

async function insertPlacement(client, placement, { setBy, actorId }) {
  return insertBookingRow(client, {
    requestId: placement.requestId,
    machineId: placement.machineId,
    start: placement.start,
    end: placement.end,
    occupiedUntil: placement.occupiedUntil,
    reason: placement.reason,
    setBy,
    createdBy: actorId
  });
}

/**
 * Persist placements, moved bookings and unplaced outcomes.
 * A moved booking is superseded and replaced, never updated in place.
 */
export async function applyPlacements(client, {
  placements = [],
  moves = [],
  unplaced = [],
  supersededBookingIds = [],
  setBy = 'system',
  actorId = null
} = {}) {
  const toSupersede = new Set([
    ...(supersededBookingIds ?? []),
    ...moves.map((move) => move.bookingId)
  ]);
  for (const bookingId of toSupersede) {
    if (bookingId) await supersedeBooking(client, bookingId);
  }

  const bookingsByRequest = new Map();

  for (const placement of placements) {
    const booking = await insertPlacement(client, placement, { setBy, actorId });
    await setRequestScheduled(client, placement.requestId, {
      score: placement.score,
      scoreBreakdown: placement.scoreBreakdown
    });
    bookingsByRequest.set(placement.requestId, booking);
  }

  for (const move of moves) {
    const booking = await insertPlacement(client, move, { setBy, actorId });
    await setRequestScheduled(client, move.requestId, {
      score: move.score,
      scoreBreakdown: move.scoreBreakdown
    });
    bookingsByRequest.set(move.requestId, booking);
  }

  for (const item of unplaced) {
    await setRequestUnplaced(client, item.requestId, {
      reason: item.reason,
      suggestion: item.suggestion,
      score: item.score,
      scoreBreakdown: item.scoreBreakdown
    });
  }

  return { bookingsByRequest };
}
