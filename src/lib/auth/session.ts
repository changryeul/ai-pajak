import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SessionContext, UserRole, OrganizationType } from '@/types/auth';

/**
 * Get session context for the current authenticated user
 *
 * Returns null if:
 * - No Supabase session exists
 * - User has no active role in database
 *
 * @returns SessionContext with user ID, role, and organization info
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = cookies();

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // Get user role and organization from database
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('role, organization_id, organization_type')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    console.error('[AUTH] Failed to get user role:', error);
    return null;
  }

  return {
    userId: session.user.id,
    role: userRole.role as UserRole,
    organizationId: userRole.organization_id,
    organizationType: userRole.organization_type as OrganizationType | null,
    email: session.user.email!,
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
  const cookieStore = cookies();

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
  const cookieStore = cookies();

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
