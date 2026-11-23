/**
 * Priority score and deterministic ordering
 * Owner: Sabbir (S-BE-1, FR-12, FR-14, FR-38, FR-41, FR-45, AF-05)
 */

import { availableMinutes } from './slots.js';
import { toDate } from './time.js';

const HOUR = 60 * 60 * 1000;
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value, places = 2) => Number(value.toFixed(places));

export function enabledFactors(settings) {
  const features = settings?.scoreFeatures ?? {};
  return {
    deadline: true,
    tightness: true,
    waiting: Boolean(features.waiting),
    fairness: Boolean(features.fairness)
  };
}

/**
 * Score = weighted average of the enabled factors over enabled weights.
 * All factors are 0..100. Breakdown values are weighted points that sum to score.
 */
export function computeScore(request, context) {
  const { now, settings, usage = {}, waitingSince = {}, quotaMinutes = 600 } = context;
  const factors = enabledFactors(settings);
  const weights = settings?.weights ?? {};
  const nowMs = toDate(now).getTime();
  const windowEnd = toDate(request.windowEnd);
  const hoursToDeadline = Math.max(0, (windowEnd.getTime() - nowMs) / HOUR);
  const available = availableMinutes({
    now,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    settings
  });
  const slack = available - Number(request.durationMin);

  const raw = {
    deadline: 100 * clamp(1 - hoursToDeadline / 168),
    tightness: available > 0 ? 100 * clamp(1 - slack / available) : 100,
    waiting: 0,
    fairness: 0
  };

  const since = toDate(waitingSince[request.id]) ?? toDate(request.createdAt) ?? new Date(nowMs);
  const hoursWaiting = Math.max(0, (nowMs - since.getTime()) / HOUR);
  raw.waiting = 100 * clamp(hoursWaiting / 72);

  const used = Number(usage[request.studentId] ?? 0);
  raw.fairness = 100 * (1 - clamp(used / Math.max(1, quotaMinutes * 2)));

  const active = Object.keys(factors).filter((key) => factors[key]);
  const weightSum = active.reduce((sum, key) => sum + Number(weights[key] ?? 0), 0);
  const normalized = weightSum > 0
    ? Object.fromEntries(active.map((key) => [key, Number(weights[key] ?? 0) / weightSum]))
    : Object.fromEntries(active.map((key) => [key, 1 / active.length]));

  // Waiting time is always part of the raw inputs for V2, but only weighted when enabled.
  if (!factors.waiting) raw.waiting = 0;

  const breakdown = { deadline: 0, tightness: 0, waiting: 0, fairness: 0 };
  let score = 0;
  for (const key of active) {
    const points = raw[key] * normalized[key];
    breakdown[key] = round(points);
    score += points;
  }

  return { score: round(score), breakdown, factors: raw };
}

/** Deterministic order: fixed first, higher score, nearer deadline, earlier submission, id. */
export function orderRequests(requests, context) {
  return requests
    .map((request) => ({ request, scored: computeScore(request, context) }))
    .sort((a, b) => {
      if (a.request.isFixed !== b.request.isFixed) return a.request.isFixed ? -1 : 1;
      if (b.scored.score !== a.scored.score) return b.scored.score - a.scored.score;
      const deadlineA = toDate(a.request.windowEnd).getTime();
      const deadlineB = toDate(b.request.windowEnd).getTime();
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;
      const createdA = toDate(a.request.createdAt)?.getTime() ?? 0;
      const createdB = toDate(b.request.createdAt)?.getTime() ?? 0;
      if (createdA !== createdB) return createdA - createdB;
      return String(a.request.id).localeCompare(String(b.request.id));
    });
}
