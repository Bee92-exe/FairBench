/**
 * Supabase Client Configuration (Backend with Service Role)
 * Owner: Aranno (A-BE-1, NFR-04)
 * Note: Service role key lives ONLY in backend environment (Global Rule 5).
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseClient = null;

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export const getSupabase = () => supabaseClient;
