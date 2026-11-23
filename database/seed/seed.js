/**
 * Demo seed (S-DB-5)
 * Usage: cd database && npm run seed
 *
 * Creates 1 admin + 20 students through the Supabase Admin API, then submits
 * the case-study requests through requestService so the real scheduler runs.
 * A centrifuge outage scenario is applied last.
 */

import '../env.js';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '../env.js';
import { closePool, getPool, withTransaction } from '../../backend/src/db/pool.js';
import { addLocalDays, zonedParts, zonedTimeToUtc } from '../../backend/src/scheduler/time.js';
import * as requestService from '../../backend/src/services/requestService.js';
import * as overrideService from '../../backend/src/services/overrideService.js';

const TZ = process.env.LAB_TIMEZONE || 'Asia/Dhaka';
const PASSWORD = process.env.SEED_PASSWORD || 'FairBench-demo-2026';

const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STUDENTS = Array.from({ length: 20 }, (_, index) => {
  const n = String(index + 1).padStart(2, '0');
  return { email: `student${n}@lab.test`, name: `Student ${n}` };
});

const ADMIN = { email: 'drhaque@lab.test', name: 'Dr. Haque' };

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function ensureUser({ email, name }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name }
  });
  if (data?.user) return data.user.id;
  if (error && /already|registered|exists/i.test(error.message)) {
    const existing = await findUserByEmail(email);
    if (existing) return existing.id;
  }
  throw error ?? new Error(`Could not create ${email}`);
}

async function upsertProfile(client, id, email, name, role) {
  await client.query(
    `insert into profiles (id, full_name, email, role)
     values ($1, $2, $3, $4)
     on conflict (id) do update
       set full_name = excluded.full_name, email = excluded.email, role = excluded.role, active = true`,
    [id, name, email, role]
  );
}

function openingDays(count, startOffset = 1) {
  const parts = zonedParts(new Date(), TZ);
  let cursor = addLocalDays({ year: parts.year, month: parts.month, day: parts.day }, startOffset);
  const days = [];
  while (days.length < count) {
    const weekday = new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day)).getUTCDay();
    if ([0, 1, 2, 3, 4].includes(weekday)) days.push({ ...cursor });
    cursor = addLocalDays(cursor, 1);
  }
  return days;
}

const localAt = (day, hour) => zonedTimeToUtc({ ...day, hour, minute: 0 }, TZ);

let randomState = 42;
function random() {
  randomState = (randomState * 1664525 + 1013904223) % 4294967296;
  return randomState / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];

async function main() {
  const adminId = await ensureUser(ADMIN);
  const studentIds = [];
  for (const student of STUDENTS) {
    studentIds.push(await ensureUser(student));
  }

  const pool = getPool();
  await withTransaction(async (client) => {
    await upsertProfile(client, adminId, ADMIN.email, ADMIN.name, 'admin');
    for (let index = 0; index < STUDENTS.length; index += 1) {
      await upsertProfile(client, studentIds[index], STUDENTS[index].email, STUDENTS[index].name, 'student');
    }
  });
  console.log(`Accounts ready: 1 admin, ${studentIds.length} students (password: ${PASSWORD})`);

  const { rows: machines } = await pool.query('select id, name, buffer_minutes from machines order by name');
  if (machines.length < 3) {
    throw new Error('Machines are missing. Run database/migrations/004_settings_seed.sql first.');
  }
  const byName = Object.fromEntries(machines.map((machine) => [machine.name, machine]));

  const { rows: existing } = await pool.query('select count(*)::int as count from requests');
  if (existing[0].count > 0) {
    console.log(`Requests already present (${existing[0].count}); skipping request seeding.`);
    await closePool();
    return;
  }

  const days = openingDays(12);
  const admin = { id: adminId, role: 'admin', name: ADMIN.name };
  const students = studentIds.map((id, index) => ({
    id, role: 'student', name: STUDENTS[index].name
  }));

  // The two case-study requests (PRD section 7).
  await requestService.submit(students[0], {
    machineId: byName.Microscope.id,
    durationMin: 180,
    windowStart: localAt(days[0], 9),
    windowEnd: localAt(days[1], 17),
    isFixed: true,
    reason: 'Samples expire Thursday; fluorescence signal degrades after 48 hours.',
    urgency: 5
  });
  console.log('Seeded the microscope case-study request (fixed, 3 hours, samples expire).');

  await requestService.submit(students[1], {
    machineId: byName.Centrifuge.id,
    durationMin: 30,
    windowStart: localAt(days[0], 9),
    windowEnd: localAt(days[4], 17),
    isFixed: false,
    reason: 'Routine pelleting, can happen any day this week.',
    urgency: 2
  });
  console.log('Seeded the flexible centrifuge request (30 minutes, next week).');

  // A busy, realistic calendar.
  const reasons = [
    'Fixed tissue imaging before the confocal slot closes.',
    'Bacterial pellet lysis for the enzymatic assay.',
    'Optical density curve runs for six hours; needs the stable lamp.',
    'Sample preparation for the group meeting demo.',
    'Repeat measurement after the previous run drifted.'
  ];
  const durations = [30, 60, 90, 120, 180, 240];
  const machineList = [byName.Microscope, byName.Centrifuge, byName.Spectrophotometer];

  for (let index = 0; index < 24; index += 1) {
    const student = students[(index + 2) % students.length];
    const machine = machineList[index % machineList.length];
    const startIndex = Math.floor(random() * 7);
    const span = 1 + Math.floor(random() * 2);
    const endIndex = Math.min(startIndex + span, days.length - 1);
    const durationMin = pick(durations);
    const isFixed = random() < 0.35;

    try {
      await requestService.submit(student, {
        machineId: machine.id,
        durationMin,
        windowStart: localAt(days[startIndex], 9),
        windowEnd: localAt(days[endIndex], 17),
        isFixed,
        reason: isFixed ? pick(reasons) : pick(reasons),
        urgency: 1 + Math.floor(random() * 5)
      });
    } catch (error) {
      console.warn(`skip one request: ${error.message}`);
    }
  }

  const { rows: counts } = await pool.query(
    `select status, count(*)::int as count from requests group by status order by status`
  );
  console.log('Request status after seeding:', counts.map((row) => `${row.status}=${row.count}`).join(', '));

  // PI reserved recurring blocks (FR-23) to show on the calendar.
  const reserveDay = days[2];
  await overrideService.apply(admin, {
    type: 'reserve',
    machineId: byName.Microscope.id,
    start: localAt(reserveDay, 9),
    end: localAt(reserveDay, 10),
    recurrence: { freq: 'weekly', count: 4 }
  }, 'Weekly group meeting imaging block');
  console.log('Reserved a weekly PI block on the microscope (4 weeks).');

  // Centrifuge outage two days from now; affected bookings are re-planned.
  const outageDay = days[4];
  const result = await overrideService.apply(admin, {
    type: 'outage',
    machineId: byName.Centrifuge.id,
    start: localAt(outageDay, 9),
    end: localAt(outageDay, 17),
    note: 'Rotor safety inspection'
  }, 'Rotor safety inspection');
  console.log('Centrifuge outage applied:', JSON.stringify(result.summary));

  await closePool();
  console.log('Seed complete.');
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await closePool().catch(() => {});
  process.exit(1);
});
