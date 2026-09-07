import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Only the anon/public key ever reaches the browser. The service-role key must
 * never appear in this bundle — every write goes through `SECURITY DEFINER`
 * SQL functions guarded by RLS instead. See supabase/migrations/.
 */
export const isSupabaseConfigured = Boolean(url && anonKey && url.startsWith('http'));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
