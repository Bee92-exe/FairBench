#!/usr/bin/env node
/**
 * Smoke test against the real database.
 *
 * Exercises the write paths the unit tests cannot reach, then removes every row
 * it created so the database is left exactly as it was found.
 *
 * Usage:
 *   cd backend && npm run smoke                 # read + submit + cancel
 *   cd backend && npm run smoke -- --with-apply # also apply an admin change
 *
 * Requirements: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in
 * backend/.env, and VITE_SUPABASE_ANON_KEY in frontend/.env (used only to sign
 * in and obtain a real access token).
 *
 * Exit code is non-zero if any check fails, so it can gate a deployment.
 *
 * Note on --with-apply: audit_log is append-only by trigger, so the audit entry
 * it produces cannot be cleaned up. Run it before a demo, not during one.
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { withTransaction, closePool } from '../src/db/pool.js';

const withApply = process.argv.includes('--with-apply');

let failures = 0;
function check(name, ok, detail = '') {
  const label = ok ? 'PASS' : 'FAIL';
  console.log(`${label}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

function readEnvFile(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  if (!fs.existsSync(url)) return {};
  return Object.fromEntries(
    fs.readFileSync(url, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
  );
}

const frontendEnv = readEnvFile('../../frontend/.env');
const anonKey = frontendEnv.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error('VITE_SUPABASE_ANON_KEY missing from frontend/.env — cannot sign in.');
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const email = process.env.SEED_ADMIN_EMAIL || 'admin@lab.test';
const password = process.env.SEED_PASSWORD || 'FairBench-demo-2026';

const { data: session, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError || !session?.session) {
  console.error(`Sign-in failed for ${email}: ${signInError?.message ?? 'no session'}`);
  console.error('Set SEED_ADMIN_EMAIL / SEED_PASSWORD in backend/.env to an existing account.');
  process.exit(1);
}

const jwt = session.session.access_token;
const userId = session.session.user.id;

const server = app.listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}/api`;

const call = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
};

const created = { requestId: null, bookingId: null, outageId: null };

try {
  // --- health -------------------------------------------------------------
  const health = await call('/health');
  check('GET /health', health.status === 200 && health.json?.db === true, `db=${health.json?.db}`);

  // --- read paths ---------------------------------------------------------
  const machines = await call('/machines');
  const machineList = machines.json?.machines ?? [];
  check('GET /machines', machines.status === 200 && machineList.length > 0, `${machineList.length} machines`);
  const machineId = machineList[0]?.id;

  const settings = await call('/settings');
  check('GET /settings', settings.status === 200 && !!settings.json?.settings?.slot_minutes);

  const schedule = await call(`/schedule?machineId=${machineId}`);
  check('GET /schedule', schedule.status === 200 && Array.isArray(schedule.json?.blocks));

  const me = await call('/me');
  check('GET /me', me.status === 200 && me.json?.user?.id === userId);

  // --- write path: submit -------------------------------------------------
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 5);
  start.setUTCHours(3, 0, 0, 0);            // 09:00 Asia/Dhaka
  const end = new Date(start.getTime() + 2 * 3600e3);

  const submit = await call('/requests', {
    method: 'POST',
    body: {
      machineId,
      durationMin: 60,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      isFixed: false,
      urgency: 3
    }
  });

  const submitted = submit.json?.request;
  created.requestId = submitted?.id ?? null;
  created.bookingId = submit.json?.booking?.id ?? null;

  check('POST /requests returns 201', submit.status === 201, `status=${submit.status}`);
  check(
    'POST /requests explains the outcome',
    Boolean(submit.json?.booking?.reason || submitted?.unplacedReason),
    submitted?.status
  );

  const mine = await call('/requests/mine');
  check(
    'GET /requests/mine includes the new request',
    mine.status === 200 && (mine.json?.requests ?? []).some((r) => r.id === created.requestId)
  );

  // --- write path: cancel -------------------------------------------------
  if (created.requestId) {
    const cancel = await call(`/requests/${created.requestId}/cancel`, { method: 'POST' });
    check('POST /requests/:id/cancel', cancel.status === 200, `status=${cancel.status}`);

    const row = await withTransaction((client) =>
      client.query('select status from requests where id = $1', [created.requestId])
    );
    check('request is cancelled in the database', row.rows[0]?.status === 'cancelled', row.rows[0]?.status);
  }

  // --- admin: preview (dry run) -------------------------------------------
  const preview = await call('/admin/changes/preview', {
    method: 'POST',
    body: {
      change: {
        type: 'outage',
        machineId,
        start: new Date(start.getTime() + 7 * 864e5).toISOString(),
        end: new Date(start.getTime() + 7 * 864e5 + 3600e3).toISOString(),
        note: 'smoke test preview'
      }
    }
  });
  check(
    'POST /admin/changes/preview returns a diff and hash',
    preview.status === 200 && !!preview.json?.previewHash && !!preview.json?.summary,
    `hash=${String(preview.json?.previewHash).slice(0, 8)}`
  );

  // --- admin: apply (optional) --------------------------------------------
  if (withApply) {
    const applyStart = new Date(start.getTime() + 14 * 864e5);
    const applyEnd = new Date(applyStart.getTime() + 3600e3);

    const apply = await call('/admin/changes/apply', {
      method: 'POST',
      body: {
        change: {
          type: 'outage',
          machineId,
          start: applyStart.toISOString(),
          end: applyEnd.toISOString(),
          note: 'smoke test apply'
        },
        note: 'smoke test apply'
      }
    });
    check('POST /admin/changes/apply', apply.status === 200 && apply.json?.applied === true, `auditId=${apply.json?.auditId}`);

    const outages = await call('/admin/outages');
    const applied = (outages.json?.outages ?? []).find((o) => o.note === 'smoke test apply');
    created.outageId = applied?.id ?? null;
    check('outage is visible in the database', Boolean(created.outageId));

    const audit = await call('/admin/audit?limit=5');
    check(
      'audit log recorded the change',
      (audit.json?.auditLogs ?? []).some((row) => row.note === 'smoke test apply')
    );
  }
} finally {
  // --- cleanup ------------------------------------------------------------
  try {
    if (created.bookingId) {
      await withTransaction((client) => client.query('delete from bookings where id = $1', [created.bookingId]));
    }
    if (created.requestId) {
      await withTransaction((client) => client.query('delete from requests where id = $1', [created.requestId]));
    }
    if (created.outageId) {
      await withTransaction((client) => client.query('delete from outages where id = $1', [created.outageId]));
    }
    if (created.requestId || created.bookingId || created.outageId) {
      console.log('cleanup  removed the rows this run created');
    }
  } catch (cleanupError) {
    console.error('cleanup failed:', cleanupError.message);
    failures += 1;
  }

  server.close();
  await closePool();
}

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} smoke check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
