/**
 * Customer usage measurement — queries Supabase to produce a CustomerUsage
 * snapshot that can be fed into plan-recommender.
 *
 * All queries run via the admin client (service role) and therefore bypass
 * RLS. Callers must ensure the invoking user has permission to view the
 * customer before calling these helpers.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { CustomerUsage } from './plan-recommender';

interface UsageQueryOptions {
  /** YYYY-MM period to measure. Defaults to current month. */
  period?: string;
}

/**
 * Measure a single customer's monthly usage across:
 *   - Employees (from employee table, active only)
 *   - Withholding transactions (PPh 22/23/4(2)) — uses pph23_transaction
 *     which under Phase 4 holds all withholding categories via tax_regime
 *   - PPN invoices — from faktur_pajak or ppn_invoice (whichever exists)
 */
export async function getCustomerUsage(
  customerId: string,
  options: UsageQueryOptions = {}
): Promise<CustomerUsage> {
  const admin = getSupabaseAdmin();
  const period = options.period || currentPeriod();

  // ─── Employees ──────────────────────────────
  const { count: employeeCount } = await admin
    .from('employee')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true);

  // ─── Withholding transactions in the given period ────
  // pph23_transaction covers PPh 23/22/4(2) (all withholding regimes post-Phase 4)
  const { count: withholdingCount } = await admin
    .from('pph23_transaction')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('tax_period', period);

  // ─── PPN invoices in the given period ────
  // faktur_pajak holds PPN e-Faktur records. Fall back to 0 if table missing.
  let ppnCount = 0;
  try {
    const { count } = await admin
      .from('faktur_pajak')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('tax_period', period);
    ppnCount = count || 0;
  } catch {
    // Table may not exist in older schemas — treat as 0
    ppnCount = 0;
  }

  return {
    employees: employeeCount || 0,
    withholdingPerMonth: withholdingCount || 0,
    ppnPerMonth: ppnCount,
  };
}

/**
 * Get the max usage across the last N months (rolling window).
 * Used to smooth out one-off spikes when recommending a plan.
 */
export async function getPeakUsage(
  customerId: string,
  monthsBack: number = 3
): Promise<CustomerUsage> {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const snapshots = await Promise.all(
    periods.map((p) => getCustomerUsage(customerId, { period: p }))
  );

  return snapshots.reduce(
    (peak, cur) => ({
      employees: Math.max(peak.employees, cur.employees),
      withholdingPerMonth: Math.max(peak.withholdingPerMonth, cur.withholdingPerMonth),
      ppnPerMonth: Math.max(peak.ppnPerMonth, cur.ppnPerMonth),
    }),
    { employees: 0, withholdingPerMonth: 0, ppnPerMonth: 0 }
  );
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
