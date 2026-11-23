/**
 * Apply database/migrations/*.sql in order.
 * Usage: cd database && npm install && npm run migrate
 * Every file runs once inside its own transaction and is recorded in schema_migrations.
 */

import './env.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { requireEnv } from './env.js';

const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

const connectionString = requireEnv('DATABASE_URL');
const client = new Client({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false }
});

await client.connect();
await client.query(`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

const applied = new Set(
  (await client.query('select name from schema_migrations')).rows.map((row) => row.name)
);
const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

let failed = false;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip    ${file}`);
    continue;
  }
  const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query('rollback');
    console.error(`FAILED  ${file}: ${error.message}`);
    failed = true;
    break;
  }
}

await client.end();
if (failed) process.exit(1);
console.log('All migrations applied.');
