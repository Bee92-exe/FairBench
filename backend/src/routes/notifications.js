/**
 * Notifications Route
 * Owner: Sirat (SI-BE-2, FR-32)
 * - GET /api/notifications: User's notifications
 * - POST /api/notifications/:id/read: Mark one read
 * - POST /api/notifications/read-all: Mark all read
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { USE_POSTGRES } from '../config/dataSource.js';
import { withRead } from '../db/pool.js';
import * as notificationService from '../services/notificationService.js';

const router = Router();

// Every notification route is scoped to the signed-in user. Without this,
// an anonymous caller would be served the fallback account's inbox.
router.use(requireAuth);

let notificationsStore = [];

/**
 * GET /api/notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === 'true';

    if (USE_POSTGRES) {
      const rows = await withRead((client) =>
        notificationService.listFor(client, req.user.id, { unread: unreadOnly })
      );
      return res.json({ notifications: rows });
    }

    let userNotifs = notificationsStore.filter(n => n.userId === req.user.id);
    if (unreadOnly) {
      userNotifs = userNotifs.filter(n => !n.read);
    }

    userNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ notifications: userNotifs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (USE_POSTGRES) {
      const updated = await withRead((client) =>
        notificationService.markRead(client, id, req.user.id)
      );
      if (!updated) {
        throw new AppError('NOT_FOUND', 'Notification not found', null, 404);
      }
      return res.json({ success: true });
    }

    const notif = notificationsStore.find(n => n.id === id && n.userId === req.user.id);
    if (!notif) {
      return next(new AppError('NOT_FOUND', 'Notification not found', null, 404));
    }
    notif.read = true;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', async (req, res, next) => {
  try {
    if (USE_POSTGRES) {
      await withRead((client) => notificationService.markAllRead(client, req.user.id));
      return res.json({ success: true });
    }

    notificationsStore.forEach(n => {
      if (n.userId === req.user.id) n.read = true;
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
