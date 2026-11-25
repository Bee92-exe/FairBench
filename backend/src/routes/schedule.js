/**
 * Schedule Route
 * Owner: Aranno (A-BE-3, FR-20, FR-34)
 * - GET /api/schedule?machineId=&from=&to=: Returns calendar blocks & outages for machine
 * - Hides student names if show_names=false and caller is not admin
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getSettings } from './settings.js';
import { bookings, outages } from './dataStore.js';
import { USE_POSTGRES } from '../config/dataSource.js';
import { withRead } from '../db/pool.js';
import { getScheduleBlocks, listMachines, listOutages, loadSettings } from '../db/queries.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { machineId, from, to } = req.query;
    const isAdmin = req.user?.role === 'admin';

    if (USE_POSTGRES) {
      const settings = await withRead((client) => loadSettings(client));
      const machineList = await withRead((client) => listMachines(client));
      const targets = machineId ? [machineId] : machineList.map((m) => m.id);
      const fromIso = from ?? new Date(Date.now() - 7 * 864e5).toISOString();
      const toIso = to ?? new Date(Date.now() + 28 * 864e5).toISOString();

      const blocks = [];
      for (const id of targets) {
        blocks.push(...await withRead((client) => getScheduleBlocks(client, {
          machineId: id,
          from: fromIso,
          to: toIso,
          viewer: req.user?.id ?? null,
          showNames: settings.showNames,
          isAdmin
        })));
      }

      const allOutages = await withRead((client) => listOutages(client, { includeEnded: false }));
      const filteredOutages = machineId
        ? allOutages.filter((o) => String(o.machineId) === String(machineId))
        : allOutages;

      return res.json({
        machineId: machineId || null,
        blocks,
        outages: filteredOutages.map((o) => ({
          id: o.id,
          machineId: o.machineId,
          start: o.start,
          end: o.end,
          note: o.note
        }))
      });
    }

    const showNames = getSettings().show_names !== false;

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
