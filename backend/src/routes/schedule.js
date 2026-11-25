/**
 * Schedule Route
 * Owner: Aranno (A-BE-3, FR-20, FR-34)
 * - GET /api/schedule?machineId=&from=&to=: Returns calendar blocks & outages for machine
 * - Hides student names if show_names=false and caller is not admin
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { bookings, outages } from './dataStore.js';

const router = Router();

router.get('/', authenticate, (req, res, next) => {
  try {
    const { machineId, from, to } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const showNames = true; // By default true, settings can override

    let filteredBookings = bookings.filter(b => b.status === 'active');
    if (machineId) {
      filteredBookings = filteredBookings.filter(b => b.machine_id === machineId);
    }
    if (from) {
      filteredBookings = filteredBookings.filter(b => new Date(b.end_at) >= new Date(from));
    }
    if (to) {
      filteredBookings = filteredBookings.filter(b => new Date(b.start_at) <= new Date(to));
    }

    const blocks = filteredBookings.map(b => {
      let label = b.student_name;
      if (b.kind === 'pi_reserved') {
        label = 'PI reserved';
      } else if (!showNames && !isAdmin) {
        label = null;
      }

      return {
        id: b.id,
        kind: b.kind,
        label,
        start: b.start_at,
        end: b.end_at,
        occupiedUntil: b.occupied_until,
        pinned: b.pinned,
        reason: b.reason
      };
    });

    let filteredOutages = outages.filter(o => !o.ended_early_at);
    if (machineId) {
      filteredOutages = filteredOutages.filter(o => o.machine_id === machineId);
    }
    if (from) {
      filteredOutages = filteredOutages.filter(o => new Date(o.end_at) >= new Date(from));
    }
    if (to) {
      filteredOutages = filteredOutages.filter(o => new Date(o.start_at) <= new Date(to));
    }

    const outageBlocks = filteredOutages.map(o => ({
      id: o.id,
      machineId: o.machine_id,
      start: o.start_at,
      end: o.end_at,
      note: o.note
    }));

    res.json({
      machineId: machineId || null,
      blocks,
      outages: outageBlocks
    });
  } catch (err) {
    next(err);
  }
});

export default router;
