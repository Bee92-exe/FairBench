/**
 * Environment loader for migration and seed scripts.
 * Reads backend/.env (single source of truth for server-side secrets).
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../backend/.env') });
dotenv.config();

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to backend/.env (see backend/.env.example).`);
  }
  return value;
}
