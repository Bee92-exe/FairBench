/**
 * Supertest Suite: Request Validation Rules
 * Owner: Aranno (A-BE-5, AT-04, AT-07, FR-08)
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Request Validation Suite (FR-08, AT-04, AT-07)', () => {
  it('rejects impossible request where window is shorter than duration (AT-07)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const twoHoursLater = new Date(tomorrow.getTime() + 2 * 3600 * 1000);

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer student-token')
      .send({
        machineId: 'm-microscope',
        durationMin: 180, // 3 hours, but window is only 2 hours
        windowStart: tomorrow.toISOString(),
        windowEnd: twoHoursLater.toISOString(),
        isFixed: false,
        urgency: 3
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'windowEnd')).toBe(true);
  });

  it('rejects duration that is not a multiple of 15 minutes', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const dayAfter = new Date(tomorrow.getTime() + 24 * 3600 * 1000);

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer student-token')
      .send({
        machineId: 'm-microscope',
        durationMin: 40, // Not multiple of 15
        windowStart: tomorrow.toISOString(),
        windowEnd: dayAfter.toISOString(),
        isFixed: false,
        urgency: 3
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'durationMin')).toBe(true);
  });

  it('rejects fixed request missing a justification reason (FR-06)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const dayAfter = new Date(tomorrow.getTime() + 24 * 3600 * 1000);

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer student-token')
      .send({
        machineId: 'm-microscope',
        durationMin: 60,
        windowStart: tomorrow.toISOString(),
        windowEnd: dayAfter.toISOString(),
        isFixed: true,
        reason: '    ', // Empty / whitespace
        urgency: 5
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'reason')).toBe(true);
  });

  it('accepts valid request and returns 201 with placement or unplaced explanation', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const dayAfter = new Date(tomorrow.getTime() + 48 * 3600 * 1000);

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer student-token')
      .send({
        machineId: 'm-microscope',
        durationMin: 60,
        windowStart: tomorrow.toISOString(),
        windowEnd: dayAfter.toISOString(),
        isFixed: false,
        urgency: 3
      });

    expect(res.status).toBe(201);
    expect(res.body.request).toBeDefined();
    expect(res.body.request.id).toBeDefined();
    expect(['scheduled', 'unplaced']).toContain(res.body.request.status);
  });
});
