/**
 * Unit tests: request validation and quota rules (FR-08, FR-10)
 * Owner: Sabbir (S-BE-4)
 *
 * These are the rules a request must pass before the scheduler sees it. They
 * are pure functions, so they need no database and run in milliseconds.
 */

import { describe, it, expect } from 'vitest';
import { validateRequestInput, assertWithinQuota } from '../../src/services/validation.js';

// Monday 23 Nov 2026, 08:00 in Asia/Dhaka.
const NOW = new Date('2026-11-23T02:00:00Z');

const settings = {
  timezone: 'Asia/Dhaka',
  openingHours: { days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00' },
  slotMinutes: 15,
  quota: { weekly_hours: 10, open_requests: 5 },
  bookingHorizonDays: 28,
  weights: { deadline: 0.4, tightness: 0.25, waiting: 0.15, fairness: 0.2 },
  scoreFeatures: { waiting: false, fairness: false }
};

const machine = { id: 'm1', name: 'Microscope', bufferMinutes: 10 };

// Tuesday 24 Nov, 09:00-17:00 Dhaka
const validInput = {
  machineId: 'm1',
  durationMin: 60,
  windowStart: '2026-11-24T03:00:00Z',
  windowEnd: '2026-11-24T11:00:00Z',
  isFixed: false,
  urgency: 3
};

function capture(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

const validate = (input, overrides = {}) =>
  capture(() => validateRequestInput(input, { settings, machine, now: NOW, ...overrides }));

describe('validateRequestInput', () => {
  it('accepts a well formed request', () => {
    expect(validate(validInput)).toBeNull();
  });

  it('rejects a duration that is not a multiple of the slot size', () => {
    const error = validate({ ...validInput, durationMin: 50 });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details[0].field).toBe('durationMin');
  });

  it('rejects a window that ends before it starts', () => {
    const error = validate({
      ...validInput,
      windowStart: '2026-11-24T11:00:00Z',
      windowEnd: '2026-11-24T03:00:00Z'
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'windowEnd')).toBe(true);
  });

  it('rejects a window that starts in the past', () => {
    const error = validate({
      ...validInput,
      windowStart: '2026-11-20T03:00:00Z',
      windowEnd: '2026-11-20T11:00:00Z'
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'windowStart')).toBe(true);
  });

  it('rejects a window beyond the booking horizon', () => {
    const error = validate({
      ...validInput,
      windowStart: '2027-01-20T03:00:00Z',
      windowEnd: '2027-01-20T11:00:00Z'
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.message.includes('days ahead'))).toBe(true);
  });

  it('rejects a fixed request without a usable reason', () => {
    const error = validate({ ...validInput, isFixed: true, reason: 'x' });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'reason')).toBe(true);
  });

  it('accepts a fixed request with a reason', () => {
    expect(validate({ ...validInput, isFixed: true, reason: 'Samples expire Thursday' })).toBeNull();
  });

  it('rejects an unknown machine', () => {
    const error = validate(validInput, { machine: null });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'machineId')).toBe(true);
  });

  it('rejects urgency outside 1..5', () => {
    const error = validate({ ...validInput, urgency: 9 });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'urgency')).toBe(true);
  });

  it('rejects a window with no opening-hours block', () => {
    // 22:00-23:00 in Dhaka, outside 09:00-17:00
    const error = validate({
      ...validInput,
      windowStart: '2026-11-24T16:00:00Z',
      windowEnd: '2026-11-24T17:00:00Z'
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.field === 'windowEnd')).toBe(true);
  });

  it('rejects a run longer than one opening day', () => {
    const error = validate({ ...validInput, durationMin: 600 });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.some((d) => d.message.includes('one opening day'))).toBe(true);
  });
});

describe('assertWithinQuota', () => {
  it('passes when both limits have room', () => {
    expect(capture(() => assertWithinQuota({
      settings,
      openRequests: 1,
      scheduledMinutes: 60,
      durationMin: 60
    }))).toBeNull();
  });

  it('rejects when the open-request limit is reached', () => {
    const error = capture(() => assertWithinQuota({
      settings,
      openRequests: 5,
      scheduledMinutes: 0,
      durationMin: 60
    }));
    expect(error.code).toBe('QUOTA_EXCEEDED');
    expect(error.status).toBe(422);
  });

  it('rejects when the weekly minutes would be exceeded', () => {
    const error = capture(() => assertWithinQuota({
      settings,
      openRequests: 0,
      scheduledMinutes: 570,
      durationMin: 60
    }));
    expect(error.code).toBe('QUOTA_EXCEEDED');
    expect(error.status).toBe(422);
  });
});
