/**
 * Plain-language reasons and suggestions (FR-18, FR-19, FR-43)
 * Owner: Sabbir (S-BE-1)
 */

import { formatDate, formatDayTime } from './time.js';

export function placedReason({ request, placement, settings }) {
  const when = formatDayTime(placement.start, settings.timezone);
  return `Placed ${when}: earliest free slot inside your window.`;
}

export function repairedReason({ request, placement, settings }) {
  const when = formatDayTime(placement.start, settings.timezone);
  return `Placed ${when} after moving one flexible booking to keep both inside their windows.`;
}

export function movedReason({ placement, settings, cause }) {
  const when = formatDayTime(placement.start, settings.timezone);
  return `Moved to ${when}: ${cause}. Your window and deadline are still met.`;
}

export function unplacedReason({ code, request, machine, settings, outage }) {
  const name = machine?.name ?? 'This machine';
  switch (code) {
    case 'WINDOW_TOO_SMALL':
      return `Your window has no ${request.durationMin}-minute block inside opening hours.`;
    case 'MACHINE_DOWN': {
      const until = outage?.end ? formatDate(outage.end, settings.timezone) : 'further notice';
      return `${name} is out of service until ${until}.`;
    }
    case 'NO_FREE_BLOCK':
    default: {
      const deadline = formatDate(request.windowEnd, settings.timezone);
      const base = `${name} is full inside your window, ending ${deadline}.`;
      return request.isFixed
        ? `${base} Your samples or deadline cannot move, so Dr. Haque needs to decide.`
        : base;
    }
  }
}

export function suggestionFor({ code, request }) {
  if (code === 'WINDOW_TOO_SMALL') return 'Widen your window by one day or choose a shorter run';
  if (code === 'MACHINE_DOWN') return 'Choose another day or ask Dr. Haque to review';
  return request.isFixed
    ? 'Ask Dr. Haque to review, or widen your window by one day'
    : 'Widen your window by one day';
}

export function deadlineRisk(request, nowMs) {
  const fixed = Boolean(request.isFixed);
  const endsSoon = new Date(request.windowEnd).getTime() - nowMs <= 72 * 60 * 60 * 1000;
  return fixed || endsSoon;
}
