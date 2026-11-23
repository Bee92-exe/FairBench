/**
 * Database checks for S-DB-6 (AT-15, NFR-03, FR-06, NFR-09)
 * Usage: cd database && npm run test
 * Runs against the database in backend/.env DATABASE_URL.
 */

import './env.js';
import assert from 'node:assert/strict';
import pg from 'pg';
import { requireEnv } from './env.js';

const { Client } = pg;
const connectionString = requireEnv('DATABASE_URL');
const ssl = /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false };

function newClient() {
  return new Client({ connectionString, ssl });
}

async function main() {
  const setup = newClient();
  await setup.connect();
  const machineName = `AT15 ${Date.now()}`;
  let machineId;
  let requestId;

  try {
    const { rows: machineRows } = await setup.query(
      'insert into machines (name, buffer_minutes) values ($1, 10) returning id',
      [machineName]
    );
    machineId = machineRows[0].id;

    const { rows: profileRows } = await setup.query('select id from profiles limit 1');
    if (profileRows.length === 0) {
      throw new Error('No profiles yet. Run database/seed/seed.js first (needs one student).');
    }
    const studentId = profileRows[0].id;

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const { rows: requestRows } = await setup.query(
      `insert into requests (student_id, machine_id, duration_min, window_start, window_end)
       values ($1, $2, 60, $3, $4) returning id`,
      [studentId, machineId, start, end]
    );
    requestId = requestRows[0].id;

    // AT-15: two simultaneous inserts for the same slot, one must fail.
    const insert = async () => {
      const client = newClient();
      await client.connect();
      try {
        await client.query('begin');
        await client.query(
          `insert into bookings (request_id, machine_id, start_at, end_at, occupied_until)
           values ($1, $2, $3, $4, $5)`,
          [requestId, machineId, start, end, end]
        );
        await client.query('commit');
        return { ok: true };
      } catch (error) {
        await client.query('rollback');
        return { ok: false, code: error.code };
      } finally {
        await client.end();
      }
    };

    const [first, second] = await Promise.all([insert(), insert()]);
    const succeeded = [first, second].filter((result) => result.ok);
    const failed = [first, second].filter((result) => !result.ok);

    assert.equal(succeeded.length, 1, 'exactly one overlapping insert must succeed');
    assert.equal(failed.length, 1, 'exactly one overlapping insert must fail');
    assert.equal(failed[0].code, '23P01', 'the database must reject with exclusion_violation (23P01)');
    console.log('PASS AT-15: one insert succeeded, the other failed with 23P01');

    // FR-06: a fixed request without a reason is rejected by the check constraint.
    let fixedRejected = false;
    try {
      await setup.query(
        `insert into requests (student_id, machine_id, duration_min, window_start, window_end, is_fixed)
         values ($1, $2, 30, $3, $4, true)`,
        [studentId, machineId, start, end]
      );
    } catch (error) {
      fixedRejected = error.code === '23514';
    }
    assert.ok(fixedRejected, 'fixed request without reason must violate a check constraint');
    console.log('PASS FR-06: fixed request without a reason is rejected');

    // NFR-09: the audit log is append-only. Rolled back so the check leaves no row.
    const auditClient = newClient();
    await auditClient.connect();
    let auditBlocked = false;
    try {
      await auditClient.query('begin');
      const { rows: auditRows } = await auditClient.query(
        "insert into audit_log (action, details) values ('test_entry', '{}'::jsonb) returning id"
      );
      await auditClient.query("update audit_log set action = 'tampered' where id = $1", [auditRows[0].id]);
    } catch (error) {
      auditBlocked = /append-only/.test(error.message);
    } finally {
      await auditClient.query('rollback').catch(() => {});
      await auditClient.end();
    }
    assert.ok(auditBlocked, 'audit_log update must be blocked by the trigger');
    console.log('PASS NFR-09: audit_log cannot be updated');
  } finally {
    await setup.query('delete from bookings where machine_id = $1', [machineId]).catch(() => {});
    await setup.query('delete from requests where machine_id = $1', [machineId]).catch(() => {});
    await setup.query('delete from machines where id = $1', [machineId]).catch(() => {});
    await setup.end();
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
