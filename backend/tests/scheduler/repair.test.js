import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, keptBooking, resetSequence, dim } from '../fixtures.js';

describe('AT-11 one-move repair', () => {
  beforeEach(resetSequence);

  it('moves one flexible booking and places both requests', () => {
    const flexible = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      windowStart: at(23, 9),
      windowEnd: at(23, 17),
      studentId: 'stu-flex',
      createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000)
    });
    const flexibleBooking = keptBooking({
      id: 'booking-flex',
      request: flexible,
      start: at(23, 9),
      end: at(23, 11)
    });
    const urgent = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      isFixed: true,
      reason: 'Samples expire today',
      windowStart: at(23, 9),
      windowEnd: at(23, 11)
    });

    const result = schedule({
      now: NOW, settings, machines, kept: [flexibleBooking], outages: [], toPlace: [urgent]
    });

    expect(result.stats.repairs).toBe(1);
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].requestId).toBe(urgent.id);
    expect(result.placements[0].start).toEqual(at(23, 9));
    expect(result.placements[0].repaired).toBe(true);

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].bookingId).toBe('booking-flex');
    expect(dim(result.moves[0].start)).toBeGreaterThanOrEqual(dim(at(23, 11)));
    expect(result.unplaced).toHaveLength(0);

    // The urgent block and the moved flexible block never overlap.
    expect(dim(result.moves[0].start)).toBeGreaterThanOrEqual(dim(result.placements[0].occupiedUntil));
  });

  it('does not move a booking that cannot fit anywhere else', () => {
    const flexible = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      windowStart: at(23, 9),
      windowEnd: at(23, 11) // no room once the urgent request takes the window
    });
    const flexibleBooking = keptBooking({
      id: 'booking-flex-tight',
      request: flexible,
      start: at(23, 9),
      end: at(23, 11)
    });
    const urgent = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      isFixed: true,
      reason: 'Samples expire today',
      windowStart: at(23, 9),
      windowEnd: at(23, 11)
    });

    const result = schedule({
      now: NOW, settings, machines, kept: [flexibleBooking], outages: [], toPlace: [urgent]
    });

    expect(result.placements).toHaveLength(0);
    expect(result.moves).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0].deadlineRisk).toBe(true);
  });

  it('never moves a started booking (AT-12)', () => {
    const running = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      windowStart: at(23, 9),
      windowEnd: at(23, 17)
    });
    const runningBooking = keptBooking({
      id: 'booking-running',
      request: running,
      start: at(23, 9),
      end: at(23, 11),
      startedAt: at(23, 9)
    });
    const urgent = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      isFixed: true,
      reason: 'Sample expires today',
      windowStart: at(23, 9),
      windowEnd: at(23, 11)
    });

    const result = schedule({
      now: NOW, settings, machines, kept: [runningBooking], outages: [], toPlace: [urgent]
    });

    expect(result.placements).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.moves).toHaveLength(0);
  });
});
