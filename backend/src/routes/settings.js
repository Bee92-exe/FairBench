/**
 * Settings Route
 * Owner: Sirat (SI-BE-1, FR-16, AF-06)
 * - GET /api/settings (all users): Returns public settings
 * - PUT /api/settings (admin only): Updates settings
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { USE_POSTGRES } from '../config/dataSource.js';
import { withRead, withTransaction } from '../db/pool.js';
import { loadSettings, upsertSettings } from '../db/queries.js';

const router = Router();

// In-memory fallback used when no database is configured (tests, demos).
let cachedSettings = {
  lab_name: "Dr. Haque's Biophysics & Nanoscopy Lab",
  opening_time: "08:00",
  closing_time: "20:00",
  slot_minutes: 15,
  timezone: process.env.LAB_TIMEZONE || 'Asia/Dhaka',
  show_names: true,
  weekly_quota_hours: 12,
  open_requests_limit: 3,
  score_weights: {
    deadline: 0.40,
    tightness: 0.25,
    waiting: 0.15,
    fairness: 0.20
  }
};

/** Database settings -> the shape this API has always returned. */
function toApiSettings(settings) {
  const raw = settings.raw ?? {};
  const hours = settings.openingHours ?? {};
  return {
    lab_name: raw.lab_name ?? settings.labName ?? 'FairBench',
    opening_time: hours.start ?? '09:00',
    closing_time: hours.end ?? '17:00',
    slot_minutes: settings.slotMinutes,
    timezone: settings.timezone,
    show_names: settings.showNames,
    weekly_quota_hours: settings.quota?.weekly_hours ?? 10,
    open_requests_limit: settings.quota?.open_requests ?? 5,
    score_weights: settings.weights
  };
}

/** API patch -> settings-table keys. Only the keys the caller sent. */
function toSettingsPatch(current, body = {}) {
  const patch = {};

  if (body.lab_name !== undefined) patch.lab_name = body.lab_name;
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.slot_minutes !== undefined) patch.slot_minutes = Number(body.slot_minutes);
  if (body.show_names !== undefined) patch.show_names = Boolean(body.show_names);
  if (body.score_weights !== undefined) patch.weights = body.score_weights;

  if (body.opening_time !== undefined || body.closing_time !== undefined) {
    patch.opening_hours = {
      ...(current.openingHours ?? { days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00' }),
      start: body.opening_time ?? current.openingHours?.start ?? '09:00',
      end: body.closing_time ?? current.openingHours?.end ?? '17:00'
    };
  }

  if (body.weekly_quota_hours !== undefined || body.open_requests_limit !== undefined) {
    patch.quota = {
      weekly_hours: Number(body.weekly_quota_hours ?? current.quota?.weekly_hours ?? 10),
      open_requests: Number(body.open_requests_limit ?? current.quota?.open_requests ?? 5)
    };
  }

  return patch;
}

/**
 * Read-only view of the current settings for other routes (e.g. the calendar
 * needs `show_names` to decide whether to label student bookings).
 */
export function getSettings() {
  return cachedSettings;
}

/**
 * GET /api/settings
 * Accessible by all users & visitors
 */
router.get('/', async (req, res, next) => {
  try {
    if (USE_POSTGRES) {
      const settings = await withRead((client) => loadSettings(client));
      return res.json({ settings: toApiSettings(settings) });
    }
    res.json({ settings: cachedSettings });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Admin role required (NFR-04)
 */
router.put('/', requireRole('admin'), async (req, res, next) => {
  try {
    if (USE_POSTGRES) {
      const updated = await withTransaction(async (client) => {
        const current = await loadSettings(client);
        const patch = toSettingsPatch(current, req.body);
        const next = await upsertSettings(client, patch, req.user.id);
        return toApiSettings(next);
      });
      return res.json({ settings: updated });
    }

    cachedSettings = {
      ...cachedSettings,
      ...req.body
    };

    res.json({ settings: cachedSettings });
  } catch (err) {
    next(err);
  }
});

export default router;
