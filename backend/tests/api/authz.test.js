/**
 * Supertest Suite: Authorization & Role Checks
 * Owner: Aranno (A-BE-5, AT-16, NFR-04)
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Auth & Role Authorization (AT-16)', () => {
  it('rejects unauthenticated requests to protected admin routes with 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects student calls to admin routes with 403 FORBIDDEN (AT-16)', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer student-token');
    
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain("requires role 'admin'");
  });

  it('allows admin calls to admin routes with 200', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer admin-token');
    
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.pendingCount).toBeDefined();
  });

  it('rejects inactive user accounts with 403 ACCOUNT_INACTIVE', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer student-inactive-token');
    
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});
