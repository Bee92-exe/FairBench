import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, resetSequence } from '../fixtures.js';

describe('AT-13 determinism (FR-45)', () => {
  beforeEach(resetSequence);

  it('the same input produces an identical schedule', () => {
    const requests = [
      makeRequest({ machineId: 'm-micro', durationMin: 180, windowStart: at(24, 9), windowEnd: at(25, 17) }),
      makeRequest({ machineId: 'm-micro', durationMin: 60, windowStart: at(24, 9), windowEnd: at(25, 17) }),
      makeRequest({ machineId: 'm-cent', durationMin: 30, windowStart: at(23, 9), windowEnd: at(25, 17) }),
      makeRequest({
        machineId: 'm-spec',
        durationMin: 120,
        isFixed: true,
        reason: 'Deadline measurement',
        windowStart: at(26, 9),
        windowEnd: at(26, 17)
      })
    ];

    const input = { now: NOW, settings, machines, kept: [], outages: [], toPlace: requests };
    const first = schedule(input);
    const second = schedule(input);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
