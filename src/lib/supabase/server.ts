import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Get Supabase client for server-side use
 *
 * Supports two authentication methods:
 * 1. Cookie-based (browser sessions)
 * 2. Authorization header (API tokens for E2E tests, mobile apps, etc.)
 *
 * Use this in API route handlers and server components
 */
export async function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    );
  }

  const headerStore = await headers();
  const cookieStore = await cookies();

  // Check for Authorization header first (for API calls)
  const authHeader = headerStore.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    // Token-based authentication (E2E tests, API calls)
    const token = authHeader.replace('Bearer ', '');

    return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  // Cookie-based authentication (browser sessions)
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Get Supabase admin client with service role key
 *
 * IMPORTANT: This client bypasses RLS policies!
 * Use only when:
 * 1. User authentication has already been validated by middleware
 * 2. You need to access data across RLS boundaries
 * 3. The operation is authorized by application-level checks
 *
 * Common use cases:
 * - Middleware that validates cross-table relationships
 * - System-level operations (billing, notifications)
 * - Admin operations with proper authorization
 */
export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase service role key. Please check your .env.local file.'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
