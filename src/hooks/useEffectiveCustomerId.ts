'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';

export interface CustomerListEntry {
  id: string;
  full_name: string;
  company_name: string | null;
  customer_type?: 'INDIVIDUAL' | 'COMPANY';
}

export interface UseEffectiveCustomerIdOptions {
  /**
   * If true, the consultant's customer list is filtered to COMPANY rows
   * (e.g. payroll / HR / SPT Masa screens that don't apply to INDIVIDUAL).
   * Default: false → return every customer the consultant is assigned to.
   */
  companyOnly?: boolean;
}

export interface UseEffectiveCustomerIdResult {
  /**
   * The customer ID the caller should actually use:
   *   - CUSTOMER role → session.customerId
   *   - Consultant role → the picker's currently selected customer
   * Empty string until ready (session still loading, or consultant has not
   * picked / been auto-assigned yet).
   */
  customerId: string;
  /** True for CONSULTANT_JTC / TAX_ADVISOR_JTC. Caller renders the picker. */
  isConsultant: boolean;
  /** Customer list for the consultant picker. Empty for CUSTOMER role. */
  customers: CustomerListEntry[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  /** True while session is loading. */
  isSessionLoading: boolean;
}

/**
 * Resolve the customer ID a page should work against, handling the
 * consultant-vs-customer divergence in one place.
 *
 * - CUSTOMER role: `customerId` is `session.customerId`.
 * - CONSULTANT_JTC / TAX_ADVISOR_JTC: the hook fetches the consultant's
 *   assigned customer list, auto-selects the first one, and exposes
 *   `setSelectedCustomerId` so the page can render a picker.
 *
 * Without this hook, consultants land on customer-shaped pages with an
 * empty `customerId`, which causes infinite spinners or permanently
 * disabled action buttons (the 4 fixes we shipped this week).
 */
export function useEffectiveCustomerId(
  opts: UseEffectiveCustomerIdOptions = {},
): UseEffectiveCustomerIdResult {
  const { companyOnly = false } = opts;
  const { session, isLoading: isSessionLoading } = useSession();

  const isConsultant =
    session?.role === UserRole.CONSULTANT_JTC ||
    session?.role === UserRole.TAX_ADVISOR_JTC;

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState<CustomerListEntry[]>([]);

  useEffect(() => {
    if (!isConsultant) return;
    (async () => {
      try {
        const r = await fetch('/api/customers');
        const j = await r.json();
        if (j.success && Array.isArray(j.customers)) {
          const filtered = companyOnly
            ? (j.customers as CustomerListEntry[]).filter(
                (c) => c.customer_type === 'COMPANY',
              )
            : (j.customers as CustomerListEntry[]);
          setCustomers(filtered);
          if (filtered.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(filtered[0].id);
          }
        }
      } catch { /* non-fatal — caller can show its own empty state */ }
    })();
  }, [isConsultant, companyOnly, selectedCustomerId]);

  const customerId = isConsultant
    ? selectedCustomerId
    : (session?.customerId || '');

  return {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    isSessionLoading,
  };
}
