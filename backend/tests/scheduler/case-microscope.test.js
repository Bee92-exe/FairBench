import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, resetSequence, dim } from '../fixtures.js';

describe('AT-02 microscope Tuesday or Wednesday, 3 hours, expires Thursday', () => {
  beforeEach(resetSequence);

  it('places one continuous 3-hour block before Thursday', () => {
    const request = makeRequest({
      machineId: 'm-micro',
      durationMin: 180,
      isFixed: true,
      reason: 'Samples expire Thursday',
      windowStart: at(24, 9),
      windowEnd: at(25, 17)
    });

    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: [request] });

    expect(result.unplaced).toHaveLength(0);
    const placement = result.placements[0];
    expect(placement).toBeDefined();
    expect(dim(placement.end) - dim(placement.start)).toBe(180 * 60 * 1000);
    expect(dim(placement.start)).toBeGreaterThanOrEqual(dim(at(24, 9)));
    expect(dim(placement.end)).toBeLessThanOrEqual(dim(at(25, 17)));
    expect(dim(placement.end)).toBeLessThan(dim(at(26, 0)));
    expect(placement.reason).toMatch(/earliest free slot inside your window/i);
  });
});
