import { describe, it, expect, beforeEach } from 'vitest';
import { replan } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, keptBooking, resetSequence, dim } from '../fixtures.js';

describe('FR-39 stable re-plan', () => {
  beforeEach(resetSequence);

  it('AT-05: a pin re-plans only the overlapping student booking', () => {
    const tuesday = makeRequest({
      machineId: 'm-micro', durationMin: 120, windowStart: at(23, 9), windowEnd: at(23, 17)
    });
    const tuesdayBooking = keptBooking({ id: 'b-tue', request: tuesday, start: at(23, 9), end: at(23, 11) });
    const wednesday = makeRequest({
      machineId: 'm-micro', durationMin: 60, windowStart: at(24, 9), windowEnd: at(24, 17)
    });
    const wednesdayBooking = keptBooking({ id: 'b-wed', request: wednesday, start: at(24, 9), end: at(24, 10) });

    const result = replan(
      { now: NOW, settings, machines, kept: [tuesdayBooking, wednesdayBooking], outages: [], waiting: [] },
      { type: 'pin', machineId: 'm-micro', start: at(23, 10), end: at(23, 12) }
    );

    expect(result.superseded).toEqual(['b-tue']);
    const moved = result.placements.find((placement) => placement.requestId === tuesday.id);
    expect(moved).toBeDefined();
    expect(dim(moved.start)).toBeGreaterThanOrEqual(dim(at(23, 12, 15)));
    expect(dim(moved.end)).toBeLessThanOrEqual(dim(at(23, 17)));
    expect(result.placements.some((placement) => placement.requestId === wednesday.id)).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('AT-06: an outage moves only affected bookings and keeps the rest identical', () => {
    const tuesday = makeRequest({
      machineId: 'm-cent', durationMin: 120, windowStart: at(23, 9), windowEnd: at(25, 17)
    });
    const tuesdayBooking = keptBooking({ id: 'b-cent-tue', request: tuesday, start: at(23, 10), end: at(23, 12) });
    const wednesday = makeRequest({
      machineId: 'm-cent', durationMin: 60, windowStart: at(24, 9), windowEnd: at(24, 17)
    });
    const wednesdayBooking = keptBooking({ id: 'b-cent-wed', request: wednesday, start: at(24, 10), end: at(24, 11) });

    const result = replan(
      { now: NOW, settings, machines, kept: [tuesdayBooking, wednesdayBooking], outages: [], waiting: [] },
      { type: 'outage', machineId: 'm-cent', start: at(23, 9), end: at(23, 17) }
    );

    expect(result.superseded).toEqual(['b-cent-tue']);
    const moved = result.placements.find((placement) => placement.requestId === tuesday.id);
    expect(moved).toBeDefined();
    expect(dim(moved.start)).toBeGreaterThanOrEqual(dim(at(23, 17)));
    expect(result.placements.some((placement) => placement.requestId === wednesday.id)).toBe(false);
  });

  it('AT-12: a running booking inside an outage is warned, never moved', () => {
    const running = makeRequest({
      machineId: 'm-cent', durationMin: 120, windowStart: at(23, 9), windowEnd: at(23, 17)
    });
    const runningBooking = keptBooking({
      id: 'b-running', request: running, start: at(23, 9), end: at(23, 11), startedAt: at(23, 9)
    });

    const result = replan(
      { now: NOW, settings, machines, kept: [runningBooking], outages: [], waiting: [] },
      { type: 'outage', machineId: 'm-cent', start: at(23, 9), end: at(23, 17) }
    );

    expect(result.superseded).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'RUNNING_BOOKING', bookingId: 'b-running' })
    ]);
  });
});
