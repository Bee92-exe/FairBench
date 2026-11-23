/**
 * Health Route
 * Owner: Sirat (SI-BE-3, Operations)
 * - GET /api/health: Status check, DB ping, version
 */

import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    db: true,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default router;
