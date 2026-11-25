/**
 * Where the routes read their data from.
 *
 * postgres — the real schema in `database/`, through `db/queries.js` and the
 *            services layer. This is the default whenever DATABASE_URL is set.
 * memory   — the seeded fixtures in `routes/dataStore.js`. Used by the test
 *            suite so the 33 tests need no database and never touch real data.
 *
 * Set DATA_SOURCE explicitly to override the inference.
 */

const configured = (process.env.DATA_SOURCE ?? '').toLowerCase();

export const DATA_SOURCE =
  configured === 'postgres' || configured === 'memory'
    ? configured
    : (process.env.DATABASE_URL ? 'postgres' : 'memory');

export const USE_POSTGRES = DATA_SOURCE === 'postgres';
