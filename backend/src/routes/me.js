/**
 * Me Route
 * Owner: Aranno (A-BE-3, FR-01)
 * - GET /api/me: Returns current profile, role and stats
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { users } from './dataStore.js';
import { USE_POSTGRES } from '../config/dataSource.js';
import { withRead } from '../db/pool.js';
import { getProfile } from '../db/queries.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = req.user;

    if (USE_POSTGRES) {
      const profile = await withRead((client) => getProfile(client, user.id));
      if (!profile) {
        throw new AppError('NOT_FOUND', 'Profile not found', null, 404);
      }
      return res.json({
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.name,
          role: profile.role,
          active: profile.active
        }
      });
    }

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
