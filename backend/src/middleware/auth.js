/**
 * Authentication and Authorization Middleware
 * Owner: Aranno (A-BE-2, FR-01, NFR-04)
 * - Verifies Supabase JWT
 * - Loads user profile & role
 * - Enforces requireAuth and requireRole
 * - Rejects inactive accounts
 */

import { AppError } from './errors.js';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';

// Development and test tokens are honoured only outside production, so a
// deployed server can never be entered with a well-known string.
const ALLOW_MOCK_AUTH = env.NODE_ENV !== 'production';

// Mock profiles for development / testing without live Supabase connection
const MOCK_PROFILES = {
  'admin-token': { id: 'usr-admin', email: 'drhaque@lab.test', fullName: 'Dr. Haque', role: 'admin', active: true },
  'student-token': { id: 'usr-rahim', email: 'rahim@lab.test', fullName: 'Rahim', role: 'student', active: true },
  'student-inactive-token': { id: 'usr-inactive', email: 'inactive@lab.test', fullName: 'Inactive Student', role: 'student', active: false },
  'drhaque': { id: 'usr-admin', email: 'drhaque@lab.test', fullName: 'Dr. Haque', role: 'admin', active: true },
  'rahim': { id: 'usr-rahim', email: 'rahim@lab.test', fullName: 'Rahim', role: 'student', active: true },
  'nusrat': { id: 'usr-nusrat', email: 'nusrat@lab.test', fullName: 'Nusrat', role: 'student', active: true }
};

/**
 * Extracts and loads the user from Supabase or Mock fallback
 */
async function resolveUserFromToken(token) {
  if (!token) return null;

  // 1. Development / test tokens (never honoured in production)
  if (ALLOW_MOCK_AUTH && MOCK_PROFILES[token]) {
    return MOCK_PROFILES[token];
  }

  // 2. Live Supabase verification
  const supabase = getSupabase();
  if (!supabase) {
    // Fail closed. Without Supabase there is no way to verify a token, and
    // synthesising an identity from an arbitrary string would let any caller
    // claim any role — including admin.
    throw new AppError(
      'UNAUTHENTICATED',
      'Authentication is not configured on this server',
      null,
      401
    );
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired authentication token', null, 401);
  }

  // Load profile from profiles table
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    // Default fallback profile if not found
    return {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || user.email?.split('@')[0],
      role: user.user_metadata?.role || 'student',
      active: true
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    active: profile.active
  };
}

/**
 * Optional authentication middleware: parses token if present
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const user = await resolveUserFromToken(token);

    if (user && user.active === false) {
      return next(new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated', null, 403));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Mandatory authentication middleware
 */
export function requireAuth(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 'Authentication required to access this resource', null, 401));
    }
    next();
  });
}

/**
 * Role-based access control middleware
 */
export function requireRole(requiredRole) {
  return [
    requireAuth,
    (req, res, next) => {
      if (req.user.role !== requiredRole) {
        return next(new AppError('FORBIDDEN', `Forbidden: requires role '${requiredRole}'`, null, 403));
      }
      next();
    }
  ];
}
