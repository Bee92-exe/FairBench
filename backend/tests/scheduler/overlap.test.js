import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import {
  NOW, settings, machines, at, makeRequest, resetSequence, assertNoOverlap
} from '../fixtures.js';

describe('AT-01 overlapping requests', () => {
  beforeEach(resetSequence);

  it('never places two overlapping blocks on one machine', () => {
    const first = makeRequest({
      machineId: 'm-micro',
      durationMin: 180,
      windowStart: at(23, 9),
      windowEnd: at(23, 17)
    });
    const second = makeRequest({
      machineId: 'm-micro',
      durationMin: 180,
      windowStart: at(23, 12),
      windowEnd: at(24, 17)
    });

    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: [first, second] });

    expect(result.placements).toHaveLength(2);
    expect(result.unplaced).toHaveLength(0);
    assertNoOverlap(result.placements);

    for (const placement of result.placements) {
      expect(new Date(placement.end) - new Date(placement.start)).toBe(180 * 60 * 1000);
    }
  });

  it('keeps the buffer between two back-to-back runs', () => {
    const first = makeRequest({ machineId: 'm-micro', durationMin: 60, windowStart: at(23, 9), windowEnd: at(23, 17) });
    const second = makeRequest({ machineId: 'm-micro', durationMin: 60, windowStart: at(23, 9), windowEnd: at(23, 17) });

    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: [first, second] });
    const [a, b] = result.placements.sort((x, y) => new Date(x.start) - new Date(y.start));
    const gap = new Date(b.start) - new Date(a.end);
    expect(gap).toBeGreaterThanOrEqual(10 * 60 * 1000);
  });
});
