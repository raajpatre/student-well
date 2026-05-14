import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Initialize the Supabase client with the Service Role key for backend operations.
// We disable persistSession because this backend will be serving multiple users concurrently,
// and we do not want one user's session leaking into another's request scope.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    // Pin the Authorization header so auth.getUser(userJwt) calls in middleware
    // cannot contaminate the in-memory session used by subsequent from() queries.
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  },
});
