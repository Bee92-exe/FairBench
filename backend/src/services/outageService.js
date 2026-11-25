/**
 * Machine outage workflow (FR-26 to FR-31)
 * Owner: Sabbir (S-BE-6)
 * All writes go through overrideService so outage re-plans use the same scheduler.
 */

import { withRead } from '../db/pool.js';
import { listOutages } from '../db/queries.js';
import * as overrideService from './overrideService.js';

export async function create(admin, input, options = {}) {
  return overrideService.apply(
    admin,
    {
      type: 'outage',
      machineId: input.machineId,
      start: input.start,
      end: input.end,
      note: input.note
    },
    input.note ?? null,
    input.previewHash ?? null,
    options
  );
}

export async function endEarly(admin, outageId, options = {}) {
  return overrideService.apply(
    admin,
    { type: 'end_outage', outageId },
    'Machine repaired early',
    null,
    options
  );
}

export async function list(options = {}) {
  return withRead((client) => listOutages(client, options));
}

/** Bookings on a machine overlapping a proposed outage period (preview helper). */
export async function findAffected({ machineId, start, end }) {
  return withRead(async (client) => {
    const { rows } = await client.query(
      `select b.id as booking_id, b.start_at, b.end_at, b.pinned, b.started_at,
              r.id as request_id, r.student_id, p.full_name
         from bookings b
         join requests r on r.id = b.request_id
         join profiles p on p.id = r.student_id
        where b.status = 'active'
          and b.machine_id = $1
          and tstzrange(b.start_at, b.occupied_until) && tstzrange($2, $3)
        order by b.start_at`,
      [machineId, start, end]
    );
    return rows.map((row) => ({
      bookingId: row.booking_id,
      requestId: row.request_id,
      studentId: row.student_id,
      studentName: row.full_name,
      start: row.start_at,
      end: row.end_at,
      pinned: row.pinned,
      started: Boolean(row.started_at)
    }));
  });
}
