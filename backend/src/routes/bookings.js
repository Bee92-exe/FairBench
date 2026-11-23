/**
 * Bookings Route
 * Owner: Aranno (A-BE-3, FR-35)
 * - GET /api/bookings/mine: List active and past bookings for current user
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { bookings } from './dataStore.js';

const router = Router();

router.get('/mine', requireAuth, (req, res, next) => {
  try {
    const user = req.user;
    const userBookings = bookings.filter(b => b.student_id === user.id);

    res.json({
      bookings: userBookings.map(b => ({
        id: b.id,
        requestId: b.request_id,
        machineId: b.machine_id,
        kind: b.kind,
        start: b.start_at,
        end: b.end_at,
        occupiedUntil: b.occupied_until,
        pinned: b.pinned,
        status: b.status,
        reason: b.reason
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
