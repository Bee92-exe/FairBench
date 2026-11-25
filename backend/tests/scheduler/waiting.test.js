import { describe, it, expect, beforeEach } from 'vitest';
import { schedule, normalizeSettings } from '../../src/scheduler/index.js';
import { NOW, settings, machines, at, makeRequest, resetSequence } from '../fixtures.js';

const waitingSettings = normalizeSettings({
  ...settings,
  scoreFeatures: { waiting: true, fairness: false }
});

describe('AT-10 waiting time raises priority', () => {
  beforeEach(resetSequence);

  it('places the request that has waited longer when only one slot fits', () => {
    const older = makeRequest({
      machineId: 'm-cent',
      durationMin: 240,
      windowStart: at(23, 9),
      windowEnd: at(23, 17),
      createdAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000)
    });
    const newer = makeRequest({
      machineId: 'm-cent',
      durationMin: 240,
      windowStart: at(23, 9),
      windowEnd: at(23, 17),
      createdAt: NOW
    });

    const result = schedule({
      now: NOW,
      settings: waitingSettings,
      machines,
      kept: [],
      outages: [],
      toPlace: [newer, older]
    });

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].requestId).toBe(older.id);
    expect(result.unplaced[0].requestId).toBe(newer.id);
  });

  it('scores the older request higher', () => {
    const older = makeRequest({
      durationMin: 60,
      createdAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000)
    });
    const newer = makeRequest({ durationMin: 60, createdAt: NOW });
    const result = schedule({
      now: NOW, settings: waitingSettings, machines, kept: [], outages: [], toPlace: [older, newer]
    });
    expect(result.placements[0].score).toBeGreaterThan(result.placements[1].score);
  });
});
