/**
 * Admin Routes
 * Owner: Aranno (A-BE-4, FR-21 to FR-30, FR-36, FR-03, AF-01, AF-02, NFR-04)
 * - All routes protected by requireRole('admin')
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { machines, users, requests, bookings, outages, auditLogs } from './dataStore.js';

const router = Router();

// Enforce admin role on every route in this router
router.use(requireRole('admin'));

/**
 * POST /api/admin/changes/preview
 * Dry-run simulation of an admin override or outage (AF-01, AF-02)
 */
router.post('/changes/preview', (req, res, next) => {
  try {
    const { type, machineId, start, end, bookingId, note } = req.body;

    if (!type) {
      throw new AppError('VALIDATION_ERROR', 'Change type is required', null, 400);
    }

    const machine = machines.find(m => m.id === machineId) || machines[0];
    const previewStart = start ? new Date(start) : new Date();
    const previewEnd = end ? new Date(end) : new Date(previewStart.getTime() + 180 * 60 * 1000);

    // Find affected bookings overlapping the preview period
    const affected = bookings.filter(b => 
      b.machine_id === machine.id &&
      b.status === 'active' &&
      new Date(b.start_at) < previewEnd &&
      new Date(b.occupied_until) > previewStart
    );

    const changes = [];
    const warnings = [];

    let movedCount = 0;
    let unplacedCount = 0;
    let atRiskCount = 0;

    affected.forEach((b, idx) => {
      // Check if already running (FR-40)
      if (new Date(b.start_at) <= new Date()) {
        warnings.push({
          code: 'RUNNING_BOOKING',
          bookingId: b.id,
          message: `Run by ${b.student_name} is in progress and cannot be moved`
        });
        return;
      }

      // Check if pinned
      if (b.pinned) {
        warnings.push({
          code: 'PINNED_BOOKING',
          bookingId: b.id,
          message: `Booking by ${b.student_name} is already pinned by admin`
        });
        return;
      }

      const reqItem = requests.find(r => r.id === b.request_id);
      const isUrgent = reqItem?.is_fixed || (reqItem?.urgency || 3) >= 4;
      const isOutage = type === 'outage';

      if (isOutage && idx % 2 === 1) {
        // Simulated unplaced outcome
        unplacedCount++;
        if (isUrgent) atRiskCount++;
        changes.push({
          requestId: b.request_id,
          studentName: b.student_name,
          machine: machine.name,
          before: { start: b.start_at, end: b.end_at },
          after: null,
          outcome: 'unplaced',
          risk: isUrgent,
          reason: `${machine.name} out of service. Could not find another slot inside window.`
        });
      } else {
        // Simulated moved outcome
        movedCount++;
        const newStart = new Date(previewEnd.getTime() + (idx + 1) * 3600 * 1000);
        const newEnd = new Date(newStart.getTime() + (new Date(b.end_at) - new Date(b.start_at)));
        changes.push({
          requestId: b.request_id,
          studentName: b.student_name,
          machine: machine.name,
          before: { start: b.start_at, end: b.end_at },
          after: { start: newStart.toISOString(), end: newEnd.toISOString() },
          outcome: 'moved',
          risk: false,
          reason: `Moved due to admin ${type}. Placed at earliest free slot inside window.`
        });
      }
    });

    const previewResult = {
      summary: {
        affected: affected.length,
        moved: movedCount,
        unplaced: unplacedCount,
        atRisk: atRiskCount
      },
      changes,
      warnings,
      previewHash: 'hash-' + Date.now()
    };

    res.json(previewResult);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/changes/apply
 * Applies an override or outage with audit logging (FR-21 to FR-30, FR-25)
 */
router.post('/changes/apply', (req, res, next) => {
  try {
    const { change, note, previewHash } = req.body;
    if (!change || !change.type) {
      throw new AppError('VALIDATION_ERROR', 'Valid change object is required', null, 400);
    }

    const { type, machineId, start, end, bookingId } = change;
    const admin = req.user;
    const now = new Date();

    if (type === 'pin') {
      const targetBooking = bookings.find(b => b.id === bookingId);
      if (targetBooking) {
        targetBooking.pinned = true;
        targetBooking.set_by = 'admin';
        if (start && end) {
          targetBooking.start_at = start;
          targetBooking.end_at = end;
        }
      }
    } else if (type === 'bump') {
      const targetBooking = bookings.find(b => b.id === bookingId);
      if (targetBooking) {
        if (new Date(targetBooking.start_at) <= now) {
          throw new AppError('BOOKING_STARTED', 'Cannot bump a running booking', null, 409);
        }
        targetBooking.status = 'superseded';
        // Mark associated request unplaced for re-planning
        const reqItem = requests.find(r => r.id === targetBooking.request_id);
        if (reqItem) {
          reqItem.status = 'unplaced';
          reqItem.unplaced_reason = 'Bumped by admin override; queued for re-planning';
        }
      }
    } else if (type === 'reserve') {
      const newBooking = {
        id: 'book-pi-' + Math.random().toString(36).substr(2, 7),
        request_id: null,
        machine_id: machineId || 'm-microscope',
        student_id: admin.id,
        student_name: admin.fullName || 'Dr. Haque',
        kind: 'pi_reserved',
        start_at: start || now.toISOString(),
        end_at: end || new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
        occupied_until: new Date(new Date(end || now).getTime() + 15 * 60 * 1000).toISOString(),
        pinned: true,
        set_by: 'admin',
        status: 'active',
        reason: note || 'PI reserved for lab experiments',
        created_at: now.toISOString()
      };
      bookings.push(newBooking);
    } else if (type === 'outage') {
      const newOutage = {
        id: 'outage-' + Math.random().toString(36).substr(2, 7),
        machine_id: machineId,
        start_at: start || now.toISOString(),
        end_at: end || new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
        note: note || change.note || 'Scheduled maintenance',
        ended_early_at: null,
        created_by: admin.id,
        created_at: now.toISOString()
      };
      outages.push(newOutage);
    } else if (type === 'end_outage') {
      const outage = outages.find(o => o.id === change.outageId);
      if (outage) {
        outage.ended_early_at = now.toISOString();
      }
    }

    // Write audit log (FR-25, NFR-09)
    const auditId = auditLogs.length + 1;
    auditLogs.unshift({
      id: auditId,
      actor_id: admin.id,
      actor_name: admin.fullName || 'Dr. Haque',
      action: type,
      entity_type: type === 'outage' ? 'outage' : 'booking',
      entity_id: bookingId || change.outageId || 'gen-' + auditId,
      details: { change },
      note: note || '',
      created_at: now.toISOString()
    });

    res.json({
      applied: true,
      summary: { type, note },
      auditId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/requests
 * Filterable by ?status= (FR-36)
 */
router.get('/requests', (req, res, next) => {
  try {
    const { status } = req.query;
    let list = requests;
    if (status) {
      list = list.filter(r => r.status === status);
    }
    res.json({ requests: list });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/outages
 * List all outages (FR-26)
 */
router.get('/outages', (req, res, next) => {
  try {
    res.json({ outages });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/attention
 * Needs attention: unplaced requests and deadline risks (FR-19, FR-30, FR-43)
 */
router.get('/attention', (req, res, next) => {
  try {
    const unplaced = requests.filter(r => r.status === 'unplaced');
    const now = new Date();
    
    // Deadline risk: window ends within 72h or fixed
    const deadlineRisk = requests.filter(r => 
      ['pending', 'waiting', 'unplaced'].includes(r.status) &&
      (r.is_fixed || (new Date(r.window_end) - now) < 72 * 3600 * 1000)
    );

    // Outage warnings: running bookings during active outages
    const outageWarnings = [];

    res.json({
      unplaced,
      deadlineRisk,
      outageWarnings
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/dashboard
 * Overview statistics (FR-36)
 */
router.get('/dashboard', (req, res, next) => {
  try {
    const pendingCount = requests.filter(r => ['pending', 'waiting'].includes(r.status)).length;
    const unplacedCount = requests.filter(r => r.status === 'unplaced').length;
    const now = new Date();
    const activeOutagesCount = outages.filter(o => !o.ended_early_at && new Date(o.end_at) > now).length;
    const recentOverrides = auditLogs.slice(0, 5);

    res.json({
      stats: {
        pendingCount,
        unplacedCount,
        activeOutagesCount,
        totalBookings: bookings.filter(b => b.status === 'active').length
      },
      recentOverrides
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/audit
 * Immutable audit logs (FR-25, NFR-09)
 */
router.get('/audit', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      auditLogs: auditLogs.slice(0, limit)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * Accounts list (FR-03)
 */
router.get('/users', (req, res, next) => {
  try {
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users
 * Add new account (FR-03)
 */
router.post('/users', (req, res, next) => {
  try {
    const { email, full_name, role } = req.body;
    if (!email || !full_name) {
      throw new AppError('VALIDATION_ERROR', 'Email and full_name are required', null, 400);
    }

    const newUser = {
      id: 'usr-' + Math.random().toString(36).substr(2, 7),
      email,
      full_name,
      role: role || 'student',
      active: true,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    res.status(201).json({ user: newUser });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/users/:id
 * Toggle activate/deactivate account (FR-03)
 */
router.patch('/users/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new AppError('NOT_FOUND', `User ${id} not found`, null, 404);
    }

    if (req.body.active !== undefined) {
      user.active = Boolean(req.body.active);
    }
    if (req.body.role) {
      user.role = req.body.role;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
