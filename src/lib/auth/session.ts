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

  // Get user role and organization from database
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('role, organization_id, organization_type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    loggers.auth.error({ err: error }, 'Failed to get user role');
    return null;
  }

  return {
    userId,
    role: userRole.role as UserRole,
    organizationId: userRole.organization_id,
    organizationType: userRole.organization_type as OrganizationType | null,
    email: userEmail!,
  };
}

/**
 * Role check helpers
 */

export function isCustomer(session: SessionContext): boolean {
  return session.role === UserRole.CUSTOMER;
}

export function isJTCConsultant(session: SessionContext): boolean {
  return session.role === UserRole.CONSULTANT_JTC;
}

export function isJTCTaxAdvisor(session: SessionContext): boolean {
  return session.role === UserRole.TAX_ADVISOR_JTC;
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
 * ONLY TAX_ADVISOR_JTC can file tax
 */
export function canFileTax(session: SessionContext): boolean {
  return session.role === UserRole.TAX_ADVISOR_JTC;
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
