/**
 * PostgreSQL pool and transaction helpers
 * Owner: Sabbir (S-BE-3, NFR-05)
 */

import pg from 'pg';

const { Pool } = pg;
let pool = null;

function needsSsl(connectionString) {
  return !/localhost|127\.0\.0\.1|::1/.test(connectionString);
}

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  }
  pool = new Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX ?? 5)
  });
  return pool;
}

export async function withRead(fn) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * One transaction per re-plan with a global advisory lock, so two submits or
 * two admin changes cannot interleave (SYSTEM_DESIGN section 6).
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('fairbench_replan'))");
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try { await client.query('rollback'); } catch { /* connection already dead */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
