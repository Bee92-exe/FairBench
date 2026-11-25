/**
 * One-move repair (FR-42, AT-11)
 * Owner: Sabbir (S-BE-2)
 *
 * If a request does not fit, try moving one flexible, unstarted booking to
 * another slot inside its own window, then place both. At most one move.
 */

import { placeRequest, slackMinutes } from './slots.js';
import { toDate } from './time.js';

function movable(k) {
  return Boolean(
    k &&
    k.booking &&
    !k.locked &&
    k.request &&
    !k.request.isFixed &&
    !k.booking.startedAt &&
    !k.booking.pinned
  );
}

export function tryRepair({ request, machine, settings, busy, kept = [], now, excludeBookingIds = new Set() }) {
  const candidates = kept
    .filter(movable)
    .filter((k) => !excludeBookingIds.has(k.booking.id))
    .filter((k) => (k.booking.machineId ?? k.booking.machine_id) === request.machineId)
    .map((k) => ({ k, slack: slackMinutes(k.request, settings, now) }))
    .sort((a, b) => {
      if (b.slack !== a.slack) return b.slack - a.slack;
      const startA = toDate(a.k.booking.startAt)?.getTime() ?? 0;
      const startB = toDate(b.k.booking.startAt)?.getTime() ?? 0;
      if (startB !== startA) return startB - startA;
      return String(a.k.booking.id).localeCompare(String(b.k.booking.id));
    });

  for (const { k } of candidates) {
    const withoutCandidate = busy.filter((interval) => interval.ref !== k);
    const requestPlacement = placeRequest({
      request, machine, settings, busy: withoutCandidate, now
    });
    if (!requestPlacement) continue;

    const withNewBlock = [
      ...withoutCandidate,
      {
        start: requestPlacement.start.getTime(),
        end: requestPlacement.occupiedUntil.getTime(),
        type: 'booking',
        ref: null
      }
    ].sort((a, b) => a.start - b.start);

    const movedPlacement = placeRequest({
      request: k.request, machine, settings, busy: withNewBlock, now
    });
    if (!movedPlacement) continue;

    return {
      placement: requestPlacement,
      moved: { kept: k, booking: k.booking, request: k.request, placement: movedPlacement }
    };
  }

  return null;
}
