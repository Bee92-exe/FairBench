/**
 * Notifications Route
 * Owner: Sirat (SI-BE-2, FR-32)
 * - GET /api/notifications: User's notifications
 * - POST /api/notifications/:id/read: Mark one read
 * - POST /api/notifications/read-all: Mark all read
 */

import { Router } from 'express';

const router = Router();

let notificationsStore = [];

/**
 * GET /api/notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || 'usr-sirat';
    const unreadOnly = req.query.unread === 'true';

    let userNotifs = notificationsStore.filter(n => n.userId === userId);
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
    const notif = notificationsStore.find(n => n.id === id);
    if (notif) {
      notif.read = true;
    }
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
    const userId = req.user?.id || 'usr-sirat';
    notificationsStore.forEach(n => {
      if (n.userId === userId) n.read = true;
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
