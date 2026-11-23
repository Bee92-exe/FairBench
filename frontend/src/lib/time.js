/**
 * Time and Date Utilities
 * Enforces FR-16 & FRONTEND_SPEC Rule 3:
 * Always store UTC; always display in the Lab Timezone (Asia/Dhaka)
 */

import { LAB_TIMEZONE } from './constants';

/**
 * Format a Date or ISO string into lab timezone display format
 * e.g., "Tue 24 Nov 2026, 10:00"
 */
export function formatLabDateTime(dateInput, timeZone = LAB_TIMEZONE) {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid date';

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return formatter.format(date);
}

/**
 * Format time only (e.g., "14:30")
 */
export function formatLabTime(dateInput, timeZone = LAB_TIMEZONE) {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

/**
 * Format date only (e.g., "Tue 24 Nov")
 */
export function formatLabDate(dateInput, timeZone = LAB_TIMEZONE) {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date);
}

/**
 * Converts a datetime-local input string into ISO UTC string
 */
export function localInputToUTC(dateTimeLocalStr, timeZone = LAB_TIMEZONE) {
  if (!dateTimeLocalStr) return null;
  // Parse local components: YYYY-MM-DDTHH:mm
  const [datePart, timePart] = dateTimeLocalStr.split('T');
  if (!datePart || !timePart) return new Date(dateTimeLocalStr).toISOString();

  // Create an explicit ISO representation interpreted in the designated timezone offset
  // For Asia/Dhaka (+06:00):
  const isoWithOffset = `${datePart}T${timePart}:00+06:00`;
  return new Date(isoWithOffset).toISOString();
}

/**
 * Convert UTC ISO to datetime-local input string for form inputs in Dhaka time
 */
export function utcToDhakaInput(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '';
  
  const options = {
    timeZone: LAB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA outputs YYYY-MM-DD
  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
}

/**
 * Calculates duration in minutes between two ISO timestamps
 */
export function getDurationMinutes(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return Math.max(0, Math.round((e - s) / (1000 * 60)));
}
