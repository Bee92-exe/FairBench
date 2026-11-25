/**
 * Machines Route
 * Owner: Aranno (A-BE-3, FR-34)
 * - GET /api/machines: List machines with status, buffer and active outage
 */

import { Router } from 'express';
import { machines, outages } from './dataStore.js';
import { USE_POSTGRES } from '../config/dataSource.js';
import { withRead } from '../db/pool.js';
import { listMachines } from '../db/queries.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    if (USE_POSTGRES) {
      const list = await withRead((client) => listMachines(client));
      return res.json({
        machines: list.map((m) => ({
          id: m.id,
          name: m.name,
          status: m.currentOutage ? 'out_of_service' : m.status,
          bufferMinutes: m.bufferMinutes,
          reliabilityNote: m.reliabilityNote,
          currentOutage: m.currentOutage
        }))
      });
    }

    const now = new Date();
    const result = machines.map(m => {
      // Find active outage covering now
      const activeOutage = outages.find(o => 
        o.machine_id === m.id && 
        !o.ended_early_at &&
        new Date(o.start_at) <= now && 
        new Date(o.end_at) >= now
      );

      return {
        id: m.id,
        name: m.name,
        status: activeOutage ? 'out_of_service' : m.status,
        bufferMinutes: m.buffer_minutes,
        reliabilityNote: m.reliability_note,
        currentOutage: activeOutage || null
      };
    });

    res.json({ machines: result });
  } catch (err) {
    next(err);
  }
});

export default router;
