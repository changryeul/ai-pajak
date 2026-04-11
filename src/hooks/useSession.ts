'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { UserRole, OrganizationType } from '@/types/auth';

export interface ClientSessionContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  organizationType: OrganizationType | null;
  email: string;
  fullName?: string;
  customerId?: string;
  customerType?: 'INDIVIDUAL' | 'COMPANY';
  consultantId?: string;
  /** All available roles for this user (for role switching) */
  availableRoles?: UserRole[];
}

interface UseSessionReturn {
  session: ClientSessionContext | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /** Switch to a different role (if user has multiple roles) */
  switchRole: (role: UserRole) => void;
}

const ROLE_STORAGE_KEY = 'ai-pajak-active-role';

/**
 * Client-side hook for getting current user session
 *
 * Returns the user's session context including role and organization info
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<ClientSessionContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use ref for supabase client to avoid recreation on each render
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const fetchSession = useCallback(async () => {
    const supabase = supabaseRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();

      if (authError) {
        throw authError;
      }

      if (!authSession) {
        setSession(null);
        return;
      }

      // Get ALL user roles
      const { data: allRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('role, organization_id, organization_type')
        .eq('user_id', authSession.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (roleError) {
        if (roleError.code === 'PGRST116') {
          console.warn('[useSession] No active role found for user:', authSession.user.id);
          setSession(null);
          return;
        }
        console.error('[useSession] Role fetch error:', roleError.message, roleError.code);
        throw new Error(`Failed to fetch user role: ${roleError.message}`);
      }

      if (!allRoles || allRoles.length === 0) {
        console.warn('[useSession] No role data returned for user:', authSession.user.id);
        setSession(null);
        return;
      }

      const availableRoles = allRoles.map(r => r.role as UserRole);

      // Check if user has a preferred role stored in sessionStorage
      const storedRole = typeof window !== 'undefined'
        ? sessionStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null
        : null;

      // Use stored role if it's in the available roles, otherwise use first
      const userRole = storedRole && availableRoles.includes(storedRole)
        ? allRoles.find(r => r.role === storedRole)!
        : allRoles[0];

      let fullName: string | undefined;
      let customerId: string | undefined;
      let customerType: 'INDIVIDUAL' | 'COMPANY' | undefined;
      let consultantId: string | undefined;

      // Get additional data based on role
      if (userRole.role === UserRole.CUSTOMER) {
        const { data: customer } = await supabase
          .from('customer')
          .select('id, full_name, company_name, customer_type')
          .eq('user_id', authSession.user.id)
          .single();

        if (customer) {
          customerId = customer.id;
          customerType = customer.customer_type as 'INDIVIDUAL' | 'COMPANY';
          fullName = customer.company_name || customer.full_name;
        }
      } else if (
        userRole.role === UserRole.TAX_OPERATOR ||
        userRole.role === UserRole.TAX_OPERATOR_LEAD ||
        userRole.role === UserRole.TAX_OPERATOR_SUPERVISOR ||
        userRole.role === UserRole.TAX_OPERATOR_MASTER
      ) {
        const { data: operator } = await supabase
          .from('tax_operators')
          .select('id, name')
          .eq('user_id', authSession.user.id)
          .maybeSingle();

        if (operator) {
          fullName = operator.name;
        }
      } else if (userRole.role === UserRole.CONSULTANT_JTC || userRole.role === UserRole.TAX_ADVISOR_JTC) {
        const { data: consultant } = await supabase
          .from('consultant')
          .select('id, full_name')
          .eq('user_id', authSession.user.id)
          .eq('is_active', true)
          .single();

        if (consultant) {
          consultantId = consultant.id;
          fullName = consultant.full_name;
        }
      }

      setSession({
        userId: authSession.user.id,
        role: userRole.role as UserRole,
        organizationId: userRole.organization_id,
        organizationType: userRole.organization_type as OrganizationType | null,
        email: authSession.user.email!,
        fullName,
        customerId,
        customerType,
        consultantId,
        availableRoles: availableRoles.length > 1 ? availableRoles : undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : 'Unknown error';
      console.error('[useSession] Error:', errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    fetchSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSession]);

  const switchRole = useCallback((role: UserRole) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ROLE_STORAGE_KEY, role);
    }
    fetchSession();
  }, [fetchSession]);

  return {
    session,
    isLoading,
    error,
    refetch: fetchSession,
    switchRole,
  };
}

/**
 * Helper function to check if user has a specific role
 */
export function hasRole(session: ClientSessionContext | null, ...roles: UserRole[]): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}

/**
 * Check if session can access tax data
 */
export function canAccessTaxData(session: ClientSessionContext | null): boolean {
  if (!session) return false;
  return ![UserRole.PLATFORM_ADMIN, UserRole.SYSTEM].includes(session.role);
}

/**
 * Check if session can file tax
 */
export function canFileTax(session: ClientSessionContext | null): boolean {
  if (!session) return false;
  return session.role === UserRole.TAX_ADVISOR_JTC;
}
