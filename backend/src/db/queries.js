/**
 * SQL queries for the FairBench services
 * Owner: Sabbir (S-BE-3, S-BE-4, S-BE-6)
 * All statements are parameterised. Business rules live in settings, not here.
 */

const MINUTE = 60 * 1000;

export function mapSettings(rows) {
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    raw: map,
    labName: map.lab_name ?? 'FairBench',
    timezone: map.timezone ?? 'Asia/Dhaka',
    openingHours: map.opening_hours ?? { days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00' },
    slotMinutes: Number(map.slot_minutes ?? 15),
    quota: map.quota ?? { weekly_hours: 10, open_requests: 5 },
    weights: map.weights ?? { deadline: 0.4, tightness: 0.25, waiting: 0.15, fairness: 0.2 },
    scoreFeatures: map.score_features ?? { waiting: false, fairness: false },
    bookingHorizonDays: Number(map.booking_horizon_days ?? 28),
    showNames: map.show_names !== false,
    cancelFreeHours: Number(map.cancel_free_hours ?? 12),
    fairnessWindowDays: Number(map.fairness_window_days ?? 14),
    checkinGraceMinutes: Number(map.checkin_grace_minutes ?? 15)
  };
}

export function mapMachineRow(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    bufferMinutes: row.buffer_minutes,
    reliabilityNote: row.reliability_note
  };
}

export function mapRequestRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.full_name ?? null,
    machineId: row.machine_id,
    durationMin: row.duration_min,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    isFixed: row.is_fixed,
    reason: row.reason,
    urgency: row.urgency,
    status: row.status,
    score: row.score == null ? null : Number(row.score),
    scoreBreakdown: row.score_breakdown ?? null,
    unplacedReason: row.unplaced_reason ?? null,
    suggestion: row.suggestion ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapBookingRow(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    machineId: row.machine_id,
    kind: row.kind,
    start: row.start_at,
    end: row.end_at,
    occupiedUntil: row.occupied_until,
    pinned: row.pinned,
    setBy: row.set_by,
    status: row.status,
    reason: row.reason,
    note: row.note,
    startedAt: row.started_at,
    createdAt: row.created_at
  };
}

export async function loadSettings(client) {
  const { rows } = await client.query('select key, value from settings');
  return mapSettings(rows);
}

export async function listMachines(client) {
  const { rows } = await client.query(
    `select m.*, o.id as outage_id, o.start_at as outage_start, o.end_at as outage_end, o.note as outage_note
       from machines m
       left join lateral (
         select id, start_at, end_at, note from outages
          where machine_id = m.id and ended_early_at is null and end_at > now()
          order by start_at limit 1
       ) o on true
      order by m.name`
  );
  return rows.map((row) => ({
    ...mapMachineRow(row),
    currentOutage: row.outage_id
      ? { id: row.outage_id, start: row.outage_start, end: row.outage_end, note: row.outage_note }
      : null
  }));
}

export async function getProfile(client, userId) {
  const { rows } = await client.query(
    'select id, full_name, email, role, active from profiles where id = $1',
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].full_name,
    email: rows[0].email,
    role: rows[0].role,
    active: rows[0].active
  };
}

/** Kept bookings, outages, usage and open requests needed by one scheduling run. */
export async function loadSchedulingState(client, { machineId = null, settings }) {
  const bookingsSql = `
    select b.id as booking_id, b.request_id, b.machine_id, b.kind, b.start_at, b.end_at,
           b.occupied_until, b.pinned, b.started_at,
           r.student_id, r.duration_min, r.window_start, r.window_end, r.is_fixed,
           r.reason as request_reason, r.urgency, r.status as request_status,
           r.created_at as request_created_at, p.full_name
      from bookings b
      left join requests r on r.id = b.request_id
      left join profiles p on p.id = r.student_id
     where b.status = 'active'
       and ($1::uuid is null or b.machine_id = $1)
     order by b.start_at`;
  const outagesSql = `
    select id, machine_id, start_at, end_at, ended_early_at
      from outages
     where ($1::uuid is null or machine_id = $1)
       and ended_early_at is null
       and end_at > now()
     order by start_at`;
  const usageSql = `
    select r.student_id, sum(r.duration_min)::int as minutes
      from bookings b
      join requests r on r.id = b.request_id
     where b.status in ('active', 'completed')
       and b.start_at >= now() - make_interval(days => $1)
     group by r.student_id`;
  const openSql = `
    select r.*, p.full_name
      from requests r
      join profiles p on p.id = r.student_id
     where r.status in ('unplaced', 'waiting')
       and ($1::uuid is null or r.machine_id = $1)
     order by r.created_at`;

  // Sequential on purpose: a pg client runs one query at a time, and issuing
  // these concurrently on the same client is deprecated (it becomes an error in
  // pg 9). Inside a transaction there is no second connection to use.
  const bookings = await client.query(bookingsSql, [machineId]);
  const outages = await client.query(outagesSql, [machineId]);
  const usage = await client.query(usageSql, [settings.fairnessWindowDays ?? 14]);
  const open = await client.query(openSql, [machineId]);

  const kept = bookings.rows.map((row) => ({
    booking: {
      id: row.booking_id,
      requestId: row.request_id,
      machineId: row.machine_id,
      kind: row.kind,
      startAt: row.start_at,
      endAt: row.end_at,
      occupiedUntil: row.occupied_until,
      pinned: row.pinned,
      startedAt: row.started_at
    },
    request: row.request_id
      ? {
          id: row.request_id,
          studentId: row.student_id,
          studentName: row.full_name,
          machineId: row.machine_id,
          durationMin: row.duration_min,
          windowStart: row.window_start,
          windowEnd: row.window_end,
          isFixed: row.is_fixed,
          reason: row.request_reason,
          urgency: row.urgency,
          status: row.request_status,
          createdAt: row.request_created_at
        }
      : null,
    locked: Boolean(row.pinned || row.started_at || row.kind === 'pi_reserved'),
    studentName: row.full_name
  }));

  return {
    kept,
    outages: outages.rows.map((row) => ({
      id: row.id,
      machineId: row.machine_id,
      startAt: row.start_at,
      endAt: row.end_at,
      endedEarlyAt: row.ended_early_at
    })),
    usage: Object.fromEntries(usage.rows.map((row) => [row.student_id, row.minutes])),
    openRequests: open.rows.map(mapRequestRow)
  };
}

export async function countOpenRequests(client, studentId) {
  const { rows } = await client.query(
    `select count(*)::int as open_requests
       from requests
      where student_id = $1 and status in ('pending','scheduled','waiting','unplaced')`,
    [studentId]
  );
  return rows[0]?.open_requests ?? 0;
}

/** Minutes already scheduled in the current lab week (FR-10). */
export async function minutesThisWeek(client, studentId, timezone) {
  const { rows } = await client.query(
    `select coalesce(sum(duration_min), 0)::int as minutes
       from requests
      where student_id = $1
        and status in ('scheduled','waiting')
        and window_start >= date_trunc('week', now() at time zone $2) at time zone $2`,
    [studentId, timezone]
  );
  return rows[0]?.minutes ?? 0;
}

export async function insertRequest(client, data, status = 'pending') {
  const { rows } = await client.query(
    `insert into requests
       (student_id, machine_id, duration_min, window_start, window_end, is_fixed, reason, urgency, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.studentId,
      data.machineId,
      data.durationMin,
      data.windowStart,
      data.windowEnd,
      Boolean(data.isFixed),
      data.reason ?? null,
      data.urgency ?? 3,
      status
    ]
  );
  return rows[0];
}

export async function updateRequestFields(client, requestId, fields) {
  const sets = [];
  const values = [];
  let index = 1;
  for (const [column, value] of Object.entries(fields)) {
    sets.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  }
  if (sets.length === 0) return;
  values.push(requestId);
  await client.query(`update requests set ${sets.join(', ')} where id = $${index}`, values);
}

export async function setRequestScheduled(client, requestId, { score, scoreBreakdown }) {
  await client.query(
    `update requests
        set status = 'scheduled', score = $2, score_breakdown = $3,
            unplaced_reason = null, suggestion = null
      where id = $1`,
    [requestId, score ?? null, scoreBreakdown ? JSON.stringify(scoreBreakdown) : null]
  );
}

export async function setRequestUnplaced(client, requestId, { reason, suggestion, score, scoreBreakdown }) {
  await client.query(
    `update requests
        set status = 'unplaced', unplaced_reason = $2, suggestion = $3,
            score = $4, score_breakdown = $5
      where id = $1`,
    [
      requestId,
      reason ?? null,
      suggestion ?? null,
      score ?? null,
      scoreBreakdown ? JSON.stringify(scoreBreakdown) : null
    ]
  );
}

export async function setRequestStatus(client, requestId, status) {
  await client.query('update requests set status = $2 where id = $1', [requestId, status]);
}

export async function getRequestRow(client, requestId) {
  const { rows } = await client.query('select * from requests where id = $1', [requestId]);
  return rows[0] ?? null;
}

export async function insertBookingRow(client, data) {
  const { rows } = await client.query(
    `insert into bookings
       (request_id, machine_id, kind, start_at, end_at, occupied_until,
        pinned, set_by, status, reason, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11)
     returning *`,
    [
      data.requestId ?? null,
      data.machineId,
      data.kind ?? (data.requestId ? 'student' : 'pi_reserved'),
      data.start,
      data.end,
      data.occupiedUntil,
      Boolean(data.pinned),
      data.setBy ?? 'system',
      data.reason ?? null,
      data.note ?? null,
      data.createdBy ?? null
    ]
  );
  return mapBookingRow(rows[0]);
}

export async function supersedeBooking(client, bookingId) {
  await client.query(
    "update bookings set status = 'superseded' where id = $1 and status = 'active'",
    [bookingId]
  );
}

export async function cancelBooking(client, bookingId) {
  await client.query(
    "update bookings set status = 'cancelled' where id = $1 and status = 'active'",
    [bookingId]
  );
}

export async function findActiveBooking(client, bookingId) {
  const { rows } = await client.query(
    `select b.*, r.student_id, r.duration_min, r.window_start, r.window_end, r.is_fixed,
            r.reason as request_reason, r.urgency, r.status as request_status
       from bookings b
       left join requests r on r.id = b.request_id
      where b.id = $1 and b.status = 'active'`,
    [bookingId]
  );
  return rows[0] ?? null;
}

export async function findActiveBookingForRequest(client, requestId) {
  const { rows } = await client.query(
    "select * from bookings where request_id = $1 and status = 'active' limit 1",
    [requestId]
  );
  return rows[0] ?? null;
}

/** Request plus its active booking, in API shape. */
export async function getRequestWithBooking(client, requestId) {
  const { rows } = await client.query(
    `select r.*, p.full_name,
            b.id as booking_id, b.machine_id as booking_machine_id, b.start_at, b.end_at,
            b.occupied_until, b.reason as booking_reason, b.pinned, b.set_by, b.status as booking_status
       from requests r
       join profiles p on p.id = r.student_id
       left join bookings b on b.request_id = r.id and b.status = 'active'
      where r.id = $1`,
    [requestId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    request: mapRequestRow(row),
    booking: row.booking_id
      ? {
          id: row.booking_id,
          requestId: row.id,
          machineId: row.booking_machine_id,
          start: row.start_at,
          end: row.end_at,
          occupiedUntil: row.occupied_until,
          pinned: row.pinned,
          setBy: row.set_by,
          status: row.booking_status,
          reason: row.booking_reason
        }
      : null
  };
}

export async function listRequestsForStudent(client, studentId) {
  const { rows } = await client.query(
    `select r.*, p.full_name,
            b.id as booking_id, b.machine_id as booking_machine_id, b.start_at, b.end_at,
            b.occupied_until, b.reason as booking_reason, b.pinned, b.set_by, b.status as booking_status
       from requests r
       join profiles p on p.id = r.student_id
       left join bookings b on b.request_id = r.id and b.status = 'active'
      where r.student_id = $1
      order by r.created_at desc`,
    [studentId]
  );
  return rows.map((row) => ({
    ...mapRequestRow(row),
    booking: row.booking_id
      ? {
          id: row.booking_id,
          machineId: row.booking_machine_id,
          start: row.start_at,
          end: row.end_at,
          occupiedUntil: row.occupied_until,
          pinned: row.pinned,
          setBy: row.set_by,
          status: row.booking_status,
          reason: row.booking_reason
        }
      : null
  }));
}

export async function getScheduleBlocks(client, { machineId, from, to, viewer, showNames, isAdmin }) {
  const { rows } = await client.query(
    `select b.id, b.kind, b.start_at, b.end_at, b.occupied_until, b.pinned,
            r.student_id, p.full_name
       from bookings b
       left join requests r on r.id = b.request_id
       left join profiles p on p.id = r.student_id
      where b.status = 'active'
        and b.machine_id = $1
        and b.start_at < $3
        and b.occupied_until > $2
      order by b.start_at`,
    [machineId, from, to]
  );
  return rows.map((row) => {
    let label = null;
    if (row.kind === 'pi_reserved') label = 'PI reserved';
    else if (showNames || isAdmin || row.student_id === viewer) label = row.full_name;
    return {
      id: row.id,
      kind: row.kind,
      label,
      start: row.start_at,
      end: row.end_at,
      occupiedUntil: row.occupied_until,
      pinned: row.pinned,
      isMine: row.student_id === viewer
    };
  });
}

export async function listOutages(client, { includeEnded = false } = {}) {
  const { rows } = await client.query(
    `select o.*, m.name as machine_name
       from outages o
       join machines m on m.id = o.machine_id
      where $1::boolean or o.end_at > now()
      order by o.start_at desc`,
    [includeEnded]
  );
  return rows.map((row) => ({
    id: row.id,
    machineId: row.machine_id,
    machine: row.machine_name,
    start: row.start_at,
    end: row.end_at,
    note: row.note,
    endedEarlyAt: row.ended_early_at,
    createdAt: row.created_at
  }));
}

export async function insertOutage(client, data) {
  const { rows } = await client.query(
    `insert into outages (machine_id, start_at, end_at, note, created_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [data.machineId, data.start, data.end, data.note ?? null, data.createdBy ?? null]
  );
  return rows[0];
}

export async function endOutageRow(client, outageId, at) {
  const { rows } = await client.query(
    `update outages set ended_early_at = $2
      where id = $1 and ended_early_at is null
      returning *`,
    [outageId, at]
  );
  return rows[0] ?? null;
}

export async function setMachineStatus(client, machineId, status) {
  await client.query('update machines set status = $2 where id = $1', [machineId, status]);
}

export async function getAttentionList(client, now = new Date()) {
  const { rows: unplacedRows } = await client.query(
    `select r.*, p.full_name, m.name as machine_name
       from requests r
       join profiles p on p.id = r.student_id
       join machines m on m.id = r.machine_id
      where r.status in ('unplaced', 'waiting')
      order by r.is_fixed desc, r.window_end asc`
  );
  const { rows: outages } = await client.query(
    `select o.*, m.name as machine_name
       from outages o join machines m on m.id = o.machine_id
      where o.ended_early_at is null and o.end_at > $1
      order by o.start_at`,
    [now]
  );
  const { rows: running } = await client.query(
    `select b.*, p.full_name, m.name as machine_name
       from bookings b
       join requests r on r.id = b.request_id
       join profiles p on p.id = r.student_id
       join machines m on m.id = b.machine_id
      where b.status = 'active' and b.started_at is not null and b.end_at > $1`,
    [now]
  );

  const unplaced = unplacedRows.map((row) => ({
    ...mapRequestRow(row),
    machine: row.machine_name,
    deadlineRisk: row.is_fixed || new Date(row.window_end).getTime() - now.getTime() <= 72 * 60 * 60 * 1000
  }));

  return {
    unplaced,
    deadlineRisk: unplaced.filter((item) => item.deadlineRisk),
    activeOutages: outages.map((row) => ({
      id: row.id,
      machineId: row.machine_id,
      machine: row.machine_name,
      start: row.start_at,
      end: row.end_at,
      note: row.note
    })),
    runningWarnings: running.map((row) => ({
      bookingId: row.id,
      machine: row.machine_name,
      studentName: row.full_name,
      start: row.start_at,
      end: row.end_at
    }))
  };
}

export async function listBookingsForStudent(client, studentId) {
  const { rows } = await client.query(
    `select b.*
       from bookings b
       join requests r on r.id = b.request_id
      where r.student_id = $1
      order by b.start_at desc`,
    [studentId]
  );
  return rows.map(mapBookingRow);
}

/** Upsert the given keys and return the whole settings map afterwards. */
export async function upsertSettings(client, patch = {}, userId = null) {
  for (const [key, value] of Object.entries(patch)) {
    await client.query(
      `insert into settings (key, value, updated_by, updated_at)
       values ($1, $2::jsonb, $3, now())
       on conflict (key) do update
         set value = excluded.value,
             updated_by = excluded.updated_by,
             updated_at = now()`,
      [key, JSON.stringify(value), userId]
    );
  }
  return loadSettings(client);
}

export async function listProfiles(client) {
  const { rows } = await client.query(
    'select id, full_name, email, role, active, created_at from profiles order by created_at'
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at
  }));
}

export async function setProfileActive(client, profileId, active) {
  const { rows } = await client.query(
    'update profiles set active = $2 where id = $1 returning id, full_name, email, role, active',
    [profileId, active]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active
  };
}

/** Every request, for the admin console, optionally filtered by status. */
export async function listRequestsAdmin(client, { status = null, limit = 200 } = {}) {
  const { rows } = await client.query(
    `select r.*, p.full_name,
            b.id as booking_id, b.machine_id as booking_machine_id, b.start_at, b.end_at,
            b.occupied_until, b.reason as booking_reason, b.pinned, b.set_by, b.status as booking_status
       from requests r
       join profiles p on p.id = r.student_id
       left join bookings b on b.request_id = r.id and b.status = 'active'
      where $1::text is null or r.status = $1::text
      order by r.created_at desc
      limit $2`,
    [status, limit]
  );
  return rows.map((row) => ({
    ...mapRequestRow(row),
    booking: row.booking_id
      ? {
          id: row.booking_id,
          machineId: row.booking_machine_id,
          start: row.start_at,
          end: row.end_at,
          occupiedUntil: row.occupied_until,
          pinned: row.pinned,
          setBy: row.set_by,
          status: row.booking_status,
          reason: row.booking_reason
        }
      : null
  }));
}

export async function getDashboard(client) {
  const { rows } = await client.query(
    `select
       (select count(*)::int from requests where status = 'pending') as pending,
       (select count(*)::int from requests where status = 'unplaced') as unplaced,
       (select count(*)::int from outages where ended_early_at is null and end_at > now()) as active_outages,
       (select count(*)::int from bookings where status = 'active') as active_bookings`
  );
  const { rows: overrides } = await client.query(
    `select a.id, a.action, a.created_at, a.note, p.full_name as actor
       from audit_log a left join profiles p on p.id = a.actor_id
      where a.action in ('pin','bump','reserve','outage','end_outage')
      order by a.created_at desc limit 10`
  );
  const counts = rows[0];
  return {
    pending: counts.pending,
    unplaced: counts.unplaced,
    activeOutages: counts.active_outages,
    activeBookings: counts.active_bookings,
    recentOverrides: overrides.map((row) => ({
      id: Number(row.id),
      action: row.action,
      actor: row.actor,
      note: row.note,
      createdAt: row.created_at
    }))
  };
}

export { MINUTE };
