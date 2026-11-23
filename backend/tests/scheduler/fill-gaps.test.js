import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import {
  NOW, settings, machines, at, makeRequest, keptBooking, resetSequence, dim
} from '../fixtures.js';

describe('AT-03 flexible request fills a gap', () => {
  beforeEach(resetSequence);

  it('places a 30-minute centrifuge run in the gap without moving the urgent booking', () => {
    const urgent = makeRequest({
      machineId: 'm-cent',
      durationMin: 120,
      windowStart: at(23, 9),
      windowEnd: at(23, 17)
    });
    const urgentBooking = keptBooking({
      id: 'booking-urgent',
      request: urgent,
      start: at(23, 9),
      end: at(23, 11)
    });
    const flexible = makeRequest({
      machineId: 'm-cent',
      durationMin: 30,
      windowStart: at(23, 9),
      windowEnd: at(23, 17),
      createdAt: new Date(NOW.getTime() - 1000)
    });

    const result = schedule({
      now: NOW,
      settings,
      machines,
      kept: [urgentBooking],
      outages: [],
      toPlace: [flexible]
    });

    expect(result.unplaced).toHaveLength(0);
    const placement = result.placements[0];
    expect(dim(placement.start)).toBeGreaterThanOrEqual(dim(at(23, 11, 15)));
    expect(dim(placement.end)).toBeLessThanOrEqual(dim(at(23, 17)));
    // The kept urgent booking is untouched because it is not in the output.
    expect(result.moves).toHaveLength(0);
  });
});
