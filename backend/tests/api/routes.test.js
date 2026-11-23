/**
 * Supertest Suite: Core API Routes & Admin Preview / Apply
 * Owner: Aranno (A-BE-5, AF-01, AF-02, FR-34)
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Core Routes & Admin Operations', () => {
  it('GET /api/health returns status ok without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe(true);
  });

  it('GET /api/machines returns list of machines', async () => {
    const res = await request(app).get('/api/machines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.machines)).toBe(true);
    expect(res.body.machines.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/schedule returns calendar blocks and outages', async () => {
    const res = await request(app).get('/api/schedule?machineId=m-microscope');
    expect(res.status).toBe(200);
    expect(res.body.blocks).toBeDefined();
    expect(res.body.outages).toBeDefined();
  });

  it('POST /api/admin/changes/preview simulates changes without applying (AF-01)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const threeHoursLater = new Date(tomorrow.getTime() + 3 * 3600 * 1000);

    const res = await request(app)
      .post('/api/admin/changes/preview')
      .set('Authorization', 'Bearer admin-token')
      .send({
        type: 'outage',
        machineId: 'm-microscope',
        start: tomorrow.toISOString(),
        end: threeHoursLater.toISOString(),
        note: 'Emergency laser realignment'
      });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.affected).toBeDefined();
    expect(Array.isArray(res.body.changes)).toBe(true);
    expect(res.body.previewHash).toBeDefined();
  });

  it('POST /api/admin/changes/apply applies an override and writes audit log (FR-21, FR-25)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const threeHoursLater = new Date(tomorrow.getTime() + 3 * 3600 * 1000);

    const res = await request(app)
      .post('/api/admin/changes/apply')
      .set('Authorization', 'Bearer admin-token')
      .send({
        change: {
          type: 'reserve',
          machineId: 'm-microscope',
          start: tomorrow.toISOString(),
          end: threeHoursLater.toISOString()
        },
        note: 'PI research run for grant renewal'
      });

    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(true);
    expect(res.body.auditId).toBeDefined();

    // Verify audit log has new record
    const auditRes = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', 'Bearer admin-token');
    
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.auditLogs[0].note).toBe('PI research run for grant renewal');
  });
});
