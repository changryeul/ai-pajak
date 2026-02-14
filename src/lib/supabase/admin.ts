/**
 * Supabase Admin Client
 *
 * Lazy-loaded admin client that bypasses RLS.
 * Use this for server-side operations that need elevated permissions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminClient: SupabaseClient | null = null;

/**
 * Get the Supabase admin client (lazy-loaded)
 * This client bypasses Row Level Security.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing Supabase environment variables for admin client. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
      );
    }

    _adminClient = createClient(supabaseUrl, serviceRoleKey);
  }
  return _adminClient;
}
