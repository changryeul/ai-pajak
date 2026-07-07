import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve user's role with robust fallback.
 *
 * Use this when a route does its own auth (not via `requireAuth` middleware)
 * and needs the user's role without hitting `.single()` pitfalls.
 *
 * Lookup order:
 *   1. user_roles (handle multiple rows via priority)
 *   2. consultant table → CONSULTANT
 *   3. customer table → CUSTOMER
 *
 * @returns role string (e.g. 'TAX_ADVISOR') or null if no role found
 */
export async function resolveUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (roles && roles.length > 0) {
    const priority = [
      'TAX_OPERATOR_MASTER',
      'TAX_ADVISOR',
      'FIRM_ADMIN',
      'CONSULTANT',
      'TAX_OPERATOR_SUPERVISOR',
      'TAX_OPERATOR_LEAD',
      'TAX_OPERATOR',
      'CUSTOMER',
      'PLATFORM_ADMIN',
    ];
    for (const p of priority) {
      if (roles.find(r => r.role === p)) return p;
    }
    return roles[0].role;
  }

  const { data: consultant } = await supabase
    .from('consultant')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (consultant) return 'CONSULTANT';

  const { data: customer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (customer) return 'CUSTOMER';

  return null;
}
