/**
 * Me Route
 * Owner: Aranno (A-BE-3, FR-01)
 * - GET /api/me: Returns current profile, role and stats
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { users } from './dataStore.js';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  try {
    const user = req.user;
    const storeUser = users.find(u => u.id === user.id) || user;
    
    res.json({
      user: {
        id: storeUser.id,
        email: storeUser.email,
        full_name: storeUser.full_name || storeUser.fullName || user.email?.split('@')[0],
        role: storeUser.role || 'student',
        active: storeUser.active !== false
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
