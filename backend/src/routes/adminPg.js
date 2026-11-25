/**
 * Admin Route — PostgreSQL implementation
 * Owner: Aranno (A-BE-4, FR-21 to FR-30, AF-01 to AF-06)
 *
 * Same paths and response shapes as routes/admin.js, but backed by the real
 * schema through the services layer. app.js mounts this one when DATA_SOURCE is
 * postgres, and the in-memory implementation for tests and demos.
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { withRead, withTransaction } from '../db/pool.js';
import {
  getDashboard,
  getAttentionList,
  listOutages,
  listProfiles,
  listRequestsAdmin,
  setProfileActive
} from '../db/queries.js';
import * as overrideService from '../services/overrideService.js';
import * as auditService from '../services/auditService.js';
import { getSupabase } from '../config/supabase.js';

const router = Router();

router.use(requireRole('admin'));

/** Preview: nothing is written, the caller gets the diff and a hash. */
router.post('/changes/preview', async (req, res, next) => {
  try {
    const change = req.body?.change ?? req.body;
    const preview = await overrideService.preview(req.user, change);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

/** Apply: writes the change, re-plans the affected bookings and audits it. */
router.post('/changes/apply', async (req, res, next) => {
  try {
    const change = req.body?.change ?? req.body;
    const note = req.body?.note ?? null;
    const previewHash = req.body?.previewHash ?? null;

    const result = await overrideService.apply(req.user, change, note, previewHash);
    res.json({
      applied: result.applied,
      summary: result.summary,
      auditId: result.auditId
    });
  } catch (err) {
    next(err);
  }
});

router.get('/requests', async (req, res, next) => {
  try {
    const list = await withRead((client) => listRequestsAdmin(client, {
      status: req.query.status ?? null
    }));
    res.json({ requests: list });
  } catch (err) {
    next(err);
  }
});

router.get('/outages', async (req, res, next) => {
  try {
    const outages = await withRead((client) => listOutages(client, { includeEnded: true }));
    res.json({ outages });
  } catch (err) {
    next(err);
  }
});

router.get('/attention', async (req, res, next) => {
  try {
    const attention = await withRead((client) => getAttentionList(client));
    res.json({
      unplaced: attention.unplaced,
      deadlineRisk: attention.deadlineRisk,
      activeOutages: attention.activeOutages,
      // Kept for the existing admin screen, which reads `outageWarnings`.
      outageWarnings: attention.runningWarnings
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await withRead((client) => getDashboard(client));
    res.json({
      stats: {
        pendingCount: dashboard.pending,
        unplacedCount: dashboard.unplaced,
        activeOutagesCount: dashboard.activeOutages,
        totalBookings: dashboard.activeBookings
      },
      recentOverrides: dashboard.recentOverrides
    });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const before = req.query.before ?? null;
    const auditLogs = await withRead((client) => auditService.list(client, { limit, before }));
    res.json({ auditLogs });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await withRead((client) => listProfiles(client));
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/**
 * Accounts live in Supabase Auth; the `profiles` row is created by the
 * on_auth_user_created trigger, so creating the auth user is enough.
 */
router.post('/users', async (req, res, next) => {
  try {
    const { email, password, full_name: fullName, role = 'student' } = req.body ?? {};
    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'email and password are required', [], 400);
    }

    const supabase = getSupabase();
    if (!supabase) {
      throw new AppError('NOT_CONFIGURED', 'Supabase admin API is not configured', [], 503);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? email.split('@')[0] }
    });
    if (error) {
      throw new AppError('USER_CREATE_FAILED', error.message, [], 400);
    }

    if (role !== 'student') {
      await withTransaction(async (client) => {
        await client.query('update profiles set role = $2 where id = $1', [data.user.id, role]);
      });
    }

    const users = await withRead((client) => listProfiles(client));
    const created = users.find((u) => u.id === data.user.id) ?? { id: data.user.id, email };
    res.status(201).json({ user: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body ?? {};
    if (typeof active !== 'boolean') {
      throw new AppError('VALIDATION_ERROR', 'active must be a boolean', [], 400);
    }

    const user = await withTransaction((client) => setProfileActive(client, id, active));
    if (!user) {
      throw new AppError('NOT_FOUND', `User ${id} not found`, null, 404);
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
