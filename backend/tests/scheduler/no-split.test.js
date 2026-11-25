import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, keptBooking, resetSequence } from '../fixtures.js';

describe('AT-08 a 3-hour job is never split across 1-hour gaps', () => {
  beforeEach(resetSequence);

  it('reports the request as unplaced with a suggestion', () => {
    const busy = [
      [9, 0, 10, 0], [10, 15, 11, 15], [11, 30, 12, 30],
      [12, 45, 13, 45], [14, 0, 15, 0], [15, 15, 16, 15]
    ].map(([startHour, startMinute, endHour, endMinute], index) => {
      const request = makeRequest({
        durationMin: 60,
        windowStart: at(23, 9),
        windowEnd: at(23, 17)
      });
      return keptBooking({
        id: `busy-${index}`,
        request,
        start: at(23, startHour, startMinute),
        end: at(23, endHour, endMinute)
      });
    });

    const request = makeRequest({
      machineId: 'm-micro',
      durationMin: 180,
      windowStart: at(23, 9),
      windowEnd: at(23, 17)
    });

    const result = schedule({
      now: NOW, settings, machines, kept: busy, outages: [], toPlace: [request]
    });

    expect(result.placements).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0].code).toBe('NO_FREE_BLOCK');
    expect(result.unplaced[0].suggestion).toBeTruthy();
  });
});
