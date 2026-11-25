/**
 * Earliest placement of one request
 * Owner: Sabbir (S-BE-1, FR-12, FR-13)
 */

import { placeRequest } from './slots.js';

export function place(request, machine, settings, busy, now) {
  return placeRequest({ request, machine, settings, busy, now });
}
