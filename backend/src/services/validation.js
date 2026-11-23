/**
 * Request validation (FR-08) and quota checks (FR-10)
 * Owner: Sabbir (S-BE-4). Routes validate with zod as well; the service re-checks.
 */

import { AppError } from './errors.js';
import { availableMinutes, gridSettings } from '../scheduler/slots.js';
import { toDate } from '../scheduler/time.js';

function fail(details) {
  throw new AppError('VALIDATION_ERROR', details[0]?.message ?? 'Invalid request', details);
}

export function validateRequestInput(input, { settings, machine, now }) {
  const details = [];
  const windowStart = toDate(input.windowStart);
  const windowEnd = toDate(input.windowEnd);
  const durationMin = Number(input.durationMin);
  const slot = Number(settings.slotMinutes ?? 15);

  if (!machine) {
    details.push({ field: 'machineId', message: 'Unknown machine' });
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    details.push({ field: 'durationMin', message: 'Duration must be a positive number of minutes' });
  } else if (durationMin % slot !== 0) {
    details.push({ field: 'durationMin', message: `Duration must be a multiple of ${slot} minutes` });
  } else {
    const openingMinutesPerDay = openingDayMinutes(settings);
    if (durationMin > openingMinutesPerDay) {
      details.push({ field: 'durationMin', message: 'A single run cannot be longer than one opening day' });
    }
  }

  if (!windowStart) details.push({ field: 'windowStart', message: 'Window start is required' });
  if (!windowEnd) details.push({ field: 'windowEnd', message: 'Window end is required' });

  if (windowStart && windowEnd) {
    if (windowEnd <= windowStart) {
      details.push({ field: 'windowEnd', message: 'Window end must be after the window start' });
    }
    const nowDate = toDate(now);
    if (windowStart.getTime() < nowDate.getTime()) {
      details.push({ field: 'windowStart', message: 'Window start cannot be in the past' });
    }
    const horizonMs = Number(settings.bookingHorizonDays ?? 28) * 24 * 60 * 60 * 1000;
    if (windowStart.getTime() - nowDate.getTime() > horizonMs) {
      details.push({
        field: 'windowStart',
        message: `Requests may be made at most ${settings.bookingHorizonDays} days ahead`
      });
    }

    const buffer = Number(machine?.bufferMinutes ?? 0);
    const available = availableMinutes({
      now, windowStart, windowEnd, settings
    });
    if (available < durationMin + buffer) {
      details.push({
        field: 'windowEnd',
        message: `The window does not contain a ${durationMin}-minute block inside opening hours`
      });
    }
  }

  if (input.isFixed && String(input.reason ?? '').trim().length < 5) {
    details.push({ field: 'reason', message: 'A fixed request needs a reason (at least 5 characters)' });
  }

  const urgency = Number(input.urgency ?? 3);
  if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) {
    details.push({ field: 'urgency', message: 'Urgency must be between 1 and 5' });
  }

  if (details.length > 0) fail(details);
}

function openingDayMinutes(settings) {
  const [sh, sm] = String(settings.openingHours?.start ?? '09:00').split(':').map(Number);
  const [eh, em] = String(settings.openingHours?.end ?? '17:00').split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export function assertWithinQuota({ settings, openRequests, scheduledMinutes, durationMin }) {
  const limitRequests = Number(settings.quota?.open_requests ?? 5);
  const limitMinutes = Number(settings.quota?.weekly_hours ?? 10) * 60;

  if (openRequests >= limitRequests) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `You already have ${openRequests} open requests (limit ${limitRequests}). Cancel one to submit another.`,
      [{ field: 'quota', message: 'open requests limit reached' }],
      422
    );
  }
  if (scheduledMinutes + Number(durationMin) > limitMinutes) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `This run would exceed your weekly ${settings.quota.weekly_hours}-hour machine quota.`,
      [{ field: 'quota', message: 'weekly hours limit reached' }],
      422
    );
  }
}
