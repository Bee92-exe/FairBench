import { describe, it, expect, beforeEach } from 'vitest';
import { schedule } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, keptBooking, resetSequence, dim } from '../fixtures.js';

describe('AT-14 a fixed deadline is never silently pushed past its window', () => {
  beforeEach(resetSequence);

  it('leaves an impossible fixed request unplaced with a risk flag', () => {
    const busy = [[24, 9], [24, 13], [25, 9], [25, 13]].map(([day, hour], index) => {
      const request = makeRequest({
        machineId: 'm-micro',
        durationMin: 240,
        windowStart: at(day, 9),
        windowEnd: at(day, 17)
      });
      return keptBooking({
        id: `busy-${index}`,
        request,
        start: at(day, hour),
        end: at(day, hour + 4)
      });
    });

    const expiring = makeRequest({
      machineId: 'm-micro',
      durationMin: 180,
      isFixed: true,
      reason: 'Samples expire Thursday',
      windowStart: at(24, 9),
      windowEnd: at(25, 17)
    });

    const result = schedule({
      now: NOW, settings, machines, kept: busy, outages: [], toPlace: [expiring]
    });

    expect(result.placements).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0].deadlineRisk).toBe(true);
    expect(result.unplaced[0].reason).toMatch(/Dr\. Haque needs to decide/i);
    expect(result.unplaced[0].suggestion).toMatch(/widen|ask dr\. haque/i);
  });

  it('reports a window that is shorter than the run', () => {
    const request = makeRequest({
      machineId: 'm-micro',
      durationMin: 240,
      windowStart: at(24, 9),
      windowEnd: at(24, 11)
    });
    const result = schedule({ now: NOW, settings, machines, kept: [], outages: [], toPlace: [request] });
    expect(result.unplaced[0].code).toBe('WINDOW_TOO_SMALL');
  });

  it('marks the machine down when an outage covers the whole window', () => {
    const request = makeRequest({
      machineId: 'm-cent',
      durationMin: 60,
      windowStart: at(24, 9),
      windowEnd: at(24, 17)
    });
    const result = schedule({
      now: NOW,
      settings,
      machines,
      kept: [],
      outages: [{ id: 'o1', machineId: 'm-cent', startAt: at(24, 9), endAt: at(24, 17) }],
      toPlace: [request]
    });
    expect(result.unplaced[0].code).toBe('MACHINE_DOWN');
    expect(result.unplaced[0].reason).toMatch(/out of service until/i);
  });
});
