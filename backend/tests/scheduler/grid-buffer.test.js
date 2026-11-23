import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, resetSequence, dim } from '../fixtures.js';

describe('slot grid and buffers', () => {
  beforeEach(resetSequence);

  it('aligns every start to the slot grid and adds the machine buffer', () => {
    const requests = [
      makeRequest({ machineId: 'm-micro', durationMin: 45, windowStart: at(23, 9), windowEnd: at(23, 17) }),
      makeRequest({ machineId: 'm-spec', durationMin: 45, windowStart: at(23, 9), windowEnd: at(23, 17) })
    ];

    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: requests });

    for (const placement of result.placements) {
      const start = new Date(placement.start);
      expect(start.getUTCMinutes() % settings.slotMinutes).toBe(0);
      const buffer = placement.machineId === 'm-spec' ? 20 : 10;
      const padded = Math.ceil(buffer / settings.slotMinutes) * settings.slotMinutes;
      expect(dim(placement.occupiedUntil) - dim(placement.end)).toBe(padded * 60 * 1000);
    }
  });

  it('keeps every placement inside opening hours and its window', () => {
    const request = makeRequest({
      machineId: 'm-micro',
      durationMin: 120,
      windowStart: at(24, 9),
      windowEnd: at(24, 17)
    });
    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: [request] });
    const placement = result.placements[0];
    expect(dim(placement.start)).toBeGreaterThanOrEqual(dim(at(24, 9)));
    expect(dim(placement.end)).toBeLessThanOrEqual(dim(at(24, 17)));
  });

  it('NFR-02: 100 requests solve in under 3 seconds', () => {
    const requests = [];
    for (let index = 0; index < 100; index += 1) {
      const day = 23 + (index % 5);
      requests.push(makeRequest({
        machineId: machines[index % 3].id,
        durationMin: [30, 60, 90, 120][index % 4],
        windowStart: at(day, 9),
        windowEnd: at(day + (index % 2), 17)
      }));
    }

    const started = performance.now();
    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: requests });
    const elapsed = performance.now() - started;

    expect(result.placements.length + result.unplaced.length).toBe(100);
    expect(elapsed).toBeLessThan(3000);
  });
});
