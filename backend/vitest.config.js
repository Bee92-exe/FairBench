import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The suite runs against the in-memory fixtures, never the live database:
    // it must not depend on a Supabase project and must not write to one.
    env: {
      DATA_SOURCE: 'memory'
    }
  }
});
