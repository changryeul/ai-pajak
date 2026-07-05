import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { SessionContext, UserRole, OrganizationType } from '@/types/auth';
import { loggers } from '@/lib/logger';

/**
 * Check if a token is a service role key (SYSTEM account)
 */
function isServiceRoleKey(token: string): boolean {
  // Service role keys are longer than regular JWTs and have a specific format
  // Check against the actual service role key from environment
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testServiceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

  // Support both production and test service role keys
  return serviceRoleKey === token || testServiceRoleKey === token;
}

/**
 * Get session context for the current authenticated user
 *
 * Supports three authentication methods:
 * 1. Cookie-based (browser sessions)
 * 2. Authorization header (API tokens for E2E tests, mobile apps, etc.)
 * 3. Service role key (SYSTEM account for billing and internal operations)
 *
 * Returns null if:
 * - No Supabase session exists
 * - User has no active role in database
 *
 * @returns SessionContext with user ID, role, and organization info
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();

  // Check for Authorization header first (for API calls)
  const authHeader = headerStore.get('authorization');

  let supabase;
  let userId: string | null = null;
  let userEmail: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    // Token-based authentication (E2E tests, API calls)
    const token = authHeader.replace('Bearer ', '');

    // CRITICAL: Check if this is a service role key (SYSTEM account)
    if (isServiceRoleKey(token)) {
      // Return SYSTEM session context
      // SYSTEM account has special privileges for billing operations
      return {
        userId: 'system',
        role: UserRole.SYSTEM,
        organizationId: null,
        organizationType: null,
        email: 'system@aipajak.internal',
      };
    }

    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      loggers.auth.error({ err: error }, 'Token validation failed');
      return null;
    }

    userId = user.id;
    userEmail = user.email || null;
  } else {
    // Cookie-based authentication (browser sessions)
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return null;
    }

    userId = session.user.id;
    userEmail = session.user.email || null;
  }

  if (!userId) {
    return null;
  }

  // Get user role and organization from database (handle multiple rows)
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role, organization_id, organization_type')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (userRoles && userRoles.length > 0) {
    // Pick best role (prefer TAX_ADVISOR > CONSULTANT > CUSTOMER > others)
    const roleOrder: UserRole[] = [
      UserRole.TAX_ADVISOR,
      UserRole.CONSULTANT,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR,
      UserRole.CUSTOMER,
      UserRole.PLATFORM_ADMIN,
    ];
    const best = roleOrder
      .map(r => userRoles.find(ur => ur.role === r))
      .find(Boolean) || userRoles[0];

    return {
      userId,
      role: best.role as UserRole,
      organizationId: best.organization_id,
      organizationType: best.organization_type as OrganizationType | null,
      email: userEmail!,
    };
  }

  // Fallback: infer role from consultant/customer tables
  const { data: consultant } = await supabase
    .from('consultant')
    .select('id, tax_partner_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (consultant) {
    return {
      userId,
      role: UserRole.CONSULTANT,
      organizationId: consultant.tax_partner_id,
      organizationType: OrganizationType.TAX_PARTNER,
      email: userEmail!,
    };
  }

  const { data: customer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (customer) {
    return {
      userId,
      role: UserRole.CUSTOMER,
      organizationId: null,
      organizationType: null,
      email: userEmail!,
    };
  }

  loggers.auth.error({ userId }, 'No role found in user_roles, consultant, or customer tables');
  return null;
}

/**
 * Role check helpers
 */

export function isCustomer(session: SessionContext): boolean {
  return session.role === UserRole.CUSTOMER;
}

export function isJTCConsultant(session: SessionContext): boolean {
  return session.role === UserRole.CONSULTANT;
}

export function isJTCTaxAdvisor(session: SessionContext): boolean {
  return session.role === UserRole.TAX_ADVISOR;
}

export function isPlatformAdmin(session: SessionContext): boolean {
  return session.role === UserRole.PLATFORM_ADMIN;
}

export function isSystem(session: SessionContext): boolean {
  return session.role === UserRole.SYSTEM;
}

/**
 * CRITICAL: Determine if session can access tax data
 *
 * PLATFORM_ADMIN and SYSTEM can NEVER access tax data
 */
export function canAccessTaxData(session: SessionContext): boolean {
  return ![UserRole.PLATFORM_ADMIN, UserRole.SYSTEM].includes(session.role);
}

/**
 * CRITICAL: Determine if session can file tax
 *
 * ONLY TAX_ADVISOR can file tax
 */
export function canFileTax(session: SessionContext): boolean {
  return session.role === UserRole.TAX_ADVISOR;
}

/**
 * Check if session can access billing data
 */
export function canAccessBilling(session: SessionContext): boolean {
  return [UserRole.SYSTEM, UserRole.PLATFORM_ADMIN].includes(session.role);
}

/**
 * Get user's customer ID if they are a customer
 */
export async function getCustomerId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Get user's consultant ID if they are a consultant
 */
export async function getConsultantId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('consultant')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
