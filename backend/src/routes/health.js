/**
 * Health Route
 * Owner: Sirat (SI-BE-3, Operations)
 * - GET /api/health: Liveness plus a real database ping
 */

import { Router } from 'express';
import { withRead } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  let db = false;
  try {
    // A real round-trip, so a broken pool or a paused Supabase project surfaces
    // here instead of on the first student request.
    await withRead((client) => client.query('select 1'));
    db = true;
  } catch {
    db = false;
  }

  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    db,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default router;
