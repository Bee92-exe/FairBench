/**
 * Requests Route
 * Owner: Aranno (A-BE-3, FR-04 to FR-09, FR-35)
 * - POST /api/requests: Submit request with FR-08 validation, placed by the real scheduler
 * - GET /api/requests/mine: List own requests
 * - PATCH /api/requests/:id: Edit unstarted request
 * - POST /api/requests/:id/cancel: Cancel request
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { machines, requests, bookings, outages } from './dataStore.js';
import { getSettings } from './settings.js';
import { schedule, normalizeSettings } from '../scheduler/index.js';

const router = Router();

/**
 * Settings as the scheduler expects them. The store keeps snake_case and
 * partial data; the engine wants one normalised shape.
 */
function schedulerSettings(store = {}) {
  return normalizeSettings({
    timezone: store.timezone,
    openingHours: {
      days: store.opening_days ?? [0, 1, 2, 3, 4],
      start: store.opening_time ?? '09:00',
      end: store.closing_time ?? '17:00'
    },
    slotMinutes: Number(store.slot_minutes ?? 15),
    quota: {
      weekly_hours: Number(store.weekly_quota_hours ?? 10),
      open_requests: Number(store.open_requests_limit ?? 5)
    },
    weights: store.score_weights ?? undefined
  });
}

/** Existing bookings, in the shape the engine reads as "kept" time. */
function keptBookings() {
  return bookings
    .filter((b) => b.status === 'active')
    .map((b) => ({
      booking: {
        id: b.id,
        machineId: b.machine_id,
        startAt: b.start_at,
        endAt: b.end_at,
        occupiedUntil: b.occupied_until,
        pinned: b.pinned,
        startedAt: b.started_at ?? null,
        kind: b.kind
      },
      request: requests.find((r) => r.id === b.request_id) ?? null,
      locked: b.pinned ? 'pinned' : (b.started_at ? 'started' : null)
    }));
}

// Validation schema for request submission (FR-08)
const requestSubmitSchema = z.object({
  machineId: z.string().min(1, 'Machine is required'),
  durationMin: z.number().int().positive('Duration must be positive'),
  windowStart: z.string().datetime({ message: 'windowStart must be valid ISO timestamp' }),
  windowEnd: z.string().datetime({ message: 'windowEnd must be valid ISO timestamp' }),
  isFixed: z.boolean().default(false),
  reason: z.string().optional(),
  urgency: z.number().int().min(1).max(5).default(3)
}).superRefine((data, ctx) => {
  const start = new Date(data.windowStart);
  const end = new Date(data.windowEnd);
  const now = new Date();

  // Duration multiple of slot_minutes (15 min)
  if (data.durationMin % 15 !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duration must be a multiple of 15 minutes',
      path: ['durationMin']
    });
  }

  // Window end after window start
  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'windowEnd must be after windowStart',
      path: ['windowEnd']
    });
  }

  // Window duration check (window must contain duration)
  const windowMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (windowMinutes < data.durationMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Window duration is shorter than requested duration',
      path: ['windowEnd']
    });
  }

  // Fixed reason required with at least 5 chars (FR-06)
  if (data.isFixed && (!data.reason || data.reason.trim().length < 5)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reason must be at least 5 characters for fixed requests',
      path: ['reason']
    });
  }

  // Date not far in the past (allow 5 min clock skew)
  if (start.getTime() < now.getTime() - 5 * 60 * 1000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'windowStart cannot be in the past',
      path: ['windowStart']
    });
  }
});

/**
 * POST /api/requests
 *
 * Placement is decided by backend/src/scheduler, the same pure module the
 * services layer uses. This route must not grow its own scheduling rules —
 * a second copy is exactly how the documented algorithm and the running app
 * drift apart.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const parseResult = requestSubmitSchema.safeParse(req.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new AppError('VALIDATION_ERROR', 'Validation failed for request submission', details, 400);
    }

    const input = parseResult.data;
    const user = req.user;

    const machine = machines.find(m => m.id === input.machineId);
    if (!machine) {
      throw new AppError('NOT_FOUND', `Machine '${input.machineId}' not found`, null, 404);
    }

    // Quota (FR-10) — the limit comes from settings, not a hardcoded number.
    const storeSettings = getSettings();
    const openLimit = Number(storeSettings.open_requests_limit ?? 5);
    const openCount = requests.filter(r =>
      r.student_id === user.id && ['pending', 'scheduled', 'waiting'].includes(r.status)
    ).length;
    if (openCount >= openLimit) {
      throw new AppError('QUOTA_EXCEEDED', `You have reached the limit of ${openLimit} open requests`, null, 422);
    }

    const now = new Date();
    const reqId = 'req-' + Math.random().toString(36).slice(2, 11);
    const studentName = user.fullName || user.email?.split('@')[0] || null;

    const engineRequest = {
      id: reqId,
      studentId: user.id,
      studentName,
      machineId: machine.id,
      durationMin: input.durationMin,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      isFixed: input.isFixed,
      reason: input.reason ?? null,
      urgency: input.urgency,
      status: 'pending',
      createdAt: now.toISOString()
    };

    const result = schedule({
      now,
      settings: schedulerSettings(storeSettings),
      machines: machines.map(m => ({
        id: m.id,
        name: m.name,
        bufferMinutes: m.buffer_minutes ?? 0
      })),
      outages: outages.map(o => ({
        id: o.id,
        machineId: o.machine_id,
        start: o.start_at,
        end: o.end_at,
        endedEarlyAt: o.ended_early_at ?? null
      })),
      kept: keptBookings(),
      toPlace: [engineRequest]
    });

    // The engine may have moved one flexible booking to make room (FR-42).
    // Persist those moves, otherwise the store and the plan disagree.
    for (const move of result.moves ?? []) {
      const moved = bookings.find(b => b.id === move.bookingId);
      if (moved) {
        moved.start_at = move.start;
        moved.end_at = move.end;
        moved.occupied_until = move.occupiedUntil;
        moved.reason = move.reason;
      }
    }

    const placement = result.placements?.[0] ?? null;
    const rejection = result.unplaced?.[0] ?? null;

    const newRequest = {
      id: reqId,
      student_id: user.id,
      student_name: studentName,
      machine_id: machine.id,
      duration_min: input.durationMin,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      is_fixed: input.isFixed,
      reason: input.reason || null,
      urgency: input.urgency,
      status: placement ? 'scheduled' : 'unplaced',
      score: placement?.score ?? rejection?.score ?? null,
      score_breakdown: placement?.scoreBreakdown ?? rejection?.scoreBreakdown ?? null,
      unplaced_reason: placement ? null : (rejection?.reason ?? null),
      suggestion: placement ? null : (rejection?.suggestion ?? null),
      created_at: now.toISOString()
    };

    let booking = null;
    if (placement) {
      booking = {
        id: 'book-' + Math.random().toString(36).slice(2, 11),
        request_id: reqId,
        machine_id: placement.machineId,
        student_id: user.id,
        student_name: studentName,
        kind: 'student',
        start_at: placement.start,
        end_at: placement.end,
        occupied_until: placement.occupiedUntil,
        pinned: false,
        set_by: 'system',
        status: 'active',
        reason: placement.reason
      };
      bookings.push(booking);
    }

    requests.push(newRequest);

    res.status(201).json({
      request: {
        id: newRequest.id,
        status: newRequest.status,
        score: newRequest.score,
        scoreBreakdown: newRequest.score_breakdown,
        unplacedReason: newRequest.unplaced_reason,
        suggestion: newRequest.suggestion
      },
      booking: booking ? {
        id: booking.id,
        machineId: booking.machine_id,
        start: booking.start_at,
        end: booking.end_at,
        reason: booking.reason
      } : null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/requests/mine
 */
router.get('/mine', requireAuth, (req, res, next) => {
  try {
    const user = req.user;
    const userRequests = requests.filter(r => r.student_id === user.id);

    const result = userRequests.map(r => {
      const booking = bookings.find(b => b.request_id === r.id && b.status === 'active');
      return {
        ...r,
        booking: booking || null
      };
    });

    res.json({ requests: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/requests/:id
 */
router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const { id } = req.params;
    const reqItem = requests.find(r => r.id === id);

    if (!reqItem) {
      throw new AppError('NOT_FOUND', `Request ${id} not found`, null, 404);
    }

    if (reqItem.student_id !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Cannot edit another student request', null, 403);
    }

    // Cannot edit if booking already started (FR-40)
    const booking = bookings.find(b => b.request_id === id && b.status === 'active');
    if (booking && new Date(booking.start_at) <= new Date()) {
      throw new AppError('BOOKING_STARTED', 'Booking has already started and cannot be edited', null, 409);
    }

    Object.assign(reqItem, req.body);
    res.json({ request: reqItem });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/requests/:id/cancel
 */
router.post('/:id/cancel', requireAuth, (req, res, next) => {
  try {
    const { id } = req.params;
    const reqItem = requests.find(r => r.id === id);

    if (!reqItem) {
      throw new AppError('NOT_FOUND', `Request ${id} not found`, null, 404);
    }

    if (reqItem.student_id !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Cannot cancel another student request', null, 403);
    }

    reqItem.status = 'cancelled';

    // Mark associated booking cancelled
    const booking = bookings.find(b => b.request_id === id && b.status === 'active');
    if (booking) {
      booking.status = 'cancelled';
    }

    res.json({ success: true, request: reqItem });
  } catch (err) {
    next(err);
  }
});

export default router;
