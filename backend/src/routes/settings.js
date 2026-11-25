/**
 * Settings Route
 * Owner: Sirat (SI-BE-1, FR-16, AF-06)
 * - GET /api/settings (all users): Returns public settings
 * - PUT /api/settings (admin only): Updates settings
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Fallback in-memory state until Sabbir's DB / services layer connects
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
    // If Sabbir's db pool is available, fetch from DB; otherwise return cached
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
    const updates = req.body;
    cachedSettings = {
      ...cachedSettings,
      ...updates
    };

    res.json({ settings: cachedSettings });
  } catch (err) {
    next(err);
  }
});

export default router;
