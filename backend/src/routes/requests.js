/**
 * Requests Route
 * Owner: Aranno (A-BE-3, FR-04 to FR-09, FR-35)
 * - POST /api/requests: Submit request with FR-08 validation & scheduling placement
 * - GET /api/requests/mine: List own requests
 * - PATCH /api/requests/:id: Edit unstarted request
 * - POST /api/requests/:id/cancel: Cancel request
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { machines, requests, bookings, outages } from './dataStore.js';

const router = Router();

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

    // Check machine exists
    const machine = machines.find(m => m.id === input.machineId);
    if (!machine) {
      throw new AppError('NOT_FOUND', `Machine '${input.machineId}' not found`, null, 404);
    }

    // Quota check (FR-10): max 5 open requests
    const openCount = requests.filter(r => r.student_id === user.id && ['pending', 'scheduled', 'waiting'].includes(r.status)).length;
    if (openCount >= 5) {
      throw new AppError('QUOTA_EXCEEDED', 'You have reached the limit of 5 open requests', null, 422);
    }

    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    const reqId = 'req-' + Math.random().toString(36).substr(2, 9);

    // Compute basic score
    const hoursToDeadline = Math.max(0, (end.getTime() - Date.now()) / (1000 * 60 * 60));
    const deadlineScore = Math.min(100, Math.max(0, 100 * (1 - hoursToDeadline / 168)));
    const windowMins = (end.getTime() - start.getTime()) / (1000 * 60);
    const slack = windowMins - input.durationMin;
    const tightnessScore = Math.min(100, Math.max(0, 100 * (1 - slack / windowMins)));
    const totalScore = Number((0.6 * deadlineScore + 0.4 * tightnessScore).toFixed(1));

    // Try finding a placement on the slot grid (simulated scheduler)
    let slotStart = new Date(start);
    slotStart.setMinutes(Math.ceil(slotStart.getMinutes() / 15) * 15, 0, 0);

    let placedBooking = null;
    let placed = false;

    // Check if slot fits before windowEnd
    const requiredEnd = new Date(slotStart.getTime() + input.durationMin * 60 * 1000);
    const bufferMins = machine.buffer_minutes || 10;
    const occupiedUntil = new Date(requiredEnd.getTime() + bufferMins * 60 * 1000);

    // Check conflict with active bookings on same machine
    const hasConflict = bookings.some(b => 
      b.machine_id === machine.id &&
      b.status === 'active' &&
      new Date(b.start_at) < occupiedUntil &&
      new Date(b.occupied_until) > slotStart
    );

    // Check conflict with outages
    const hasOutageConflict = outages.some(o => 
      o.machine_id === machine.id &&
      !o.ended_early_at &&
      new Date(o.start_at) < occupiedUntil &&
      new Date(o.end_at) > slotStart
    );

    if (!hasConflict && !hasOutageConflict && requiredEnd <= end) {
      placed = true;
      const bookingId = 'book-' + Math.random().toString(36).substr(2, 9);
      placedBooking = {
        id: bookingId,
        request_id: reqId,
        machine_id: machine.id,
        student_id: user.id,
        student_name: user.fullName || user.email?.split('@')[0],
        kind: 'student',
        start_at: slotStart.toISOString(),
        end_at: requiredEnd.toISOString(),
        occupied_until: occupiedUntil.toISOString(),
        pinned: false,
        set_by: 'system',
        status: 'active',
        reason: `Placed ${slotStart.toLocaleDateString('en-GB', { weekday: 'short' })} ${slotStart.toTimeString().slice(0, 5)}: earliest free slot inside your window.`
      };
      bookings.push(placedBooking);
    }

    const newRequest = {
      id: reqId,
      student_id: user.id,
      student_name: user.fullName || user.email?.split('@')[0],
      machine_id: machine.id,
      duration_min: input.durationMin,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      is_fixed: input.isFixed,
      reason: input.reason || null,
      urgency: input.urgency,
      status: placed ? 'scheduled' : 'unplaced',
      score: totalScore,
      score_breakdown: {
        deadline: Number(deadlineScore.toFixed(1)),
        tightness: Number(tightnessScore.toFixed(1)),
        waiting: 0,
        fairness: 0
      },
      unplaced_reason: placed ? null : `${machine.name} has no continuous ${input.durationMin}-minute slot free in your window`,
      suggestion: placed ? null : 'Widen your window by one day or choose a shorter run',
      created_at: new Date().toISOString()
    };

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
      booking: placedBooking ? {
        id: placedBooking.id,
        machineId: placedBooking.machine_id,
        start: placedBooking.start_at,
        end: placedBooking.end_at,
        reason: placedBooking.reason
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
