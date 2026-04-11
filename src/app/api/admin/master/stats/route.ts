/**
 * Master stats API — Phase K-3.2
 *
 * GET /api/admin/master/stats
 *   → platform-wide metrics for TAX_OPERATOR_MASTER:
 *     - total customers (by type and plan)
 *     - MRR (monthly recurring revenue) from active subscriptions
 *     - plan distribution
 *     - recent signups
 *     - Pro-exceeding customers (candidates for custom quotes)
 *     - AI/processing volume snapshot
 *
 * Requires TAX_OPERATOR_MASTER role.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { getPeakUsage } from '@/lib/billing/usage-query';
import { suggestPlanForCustomer } from '@/lib/billing/plan-recommender';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (role !== 'TAX_OPERATOR_MASTER') {
      return NextResponse.json(
        { error: '마스터 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // ─── Customer totals by type ──────
    const { data: customers, error: custError } = await admin
      .from('customer')
      .select('id, customer_type, created_at');

    if (custError) {
      loggers.api.error({ err: custError }, 'Failed to fetch customers');
      return NextResponse.json({ error: custError.message }, { status: 500 });
    }

    const totalCustomers = customers?.length || 0;
    const corporateCustomers = customers?.filter((c) => c.customer_type === 'COMPANY').length || 0;
    const individualCustomers = customers?.filter((c) => c.customer_type === 'INDIVIDUAL').length || 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSignups = customers?.filter((c) => c.created_at >= thirtyDaysAgo).length || 0;

    // ─── Active subscriptions + MRR ──────
    const { data: activeSubs } = await admin
      .from('customer_subscription')
      .select('plan_id, price_idr, customer_id')
      .eq('status', 'ACTIVE');

    const mrrIdr = (activeSubs || []).reduce((sum, s) => sum + Number(s.price_idr || 0), 0);
    const subscribedCustomers = activeSubs?.length || 0;
    const unsubscribedCorporate = Math.max(0, corporateCustomers - subscribedCustomers);

    const planDistribution: Record<string, number> = {};
    for (const sub of activeSubs || []) {
      planDistribution[sub.plan_id] = (planDistribution[sub.plan_id] || 0) + 1;
    }

    // ─── Processing volume snapshot (current month) ──────
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { count: withholdingCount } = await admin
      .from('pph23_transaction')
      .select('id', { count: 'exact', head: true })
      .eq('tax_period', currentPeriod);

    let ppnCount = 0;
    try {
      const { count } = await admin
        .from('faktur_pajak')
        .select('id', { count: 'exact', head: true })
        .eq('tax_period', currentPeriod);
      ppnCount = count || 0;
    } catch { /* table may not exist */ }

    const { count: employeeCount } = await admin
      .from('employee')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // ─── Pro-exceeding customers (candidates for custom quotes) ──────
    const proExceedingCandidates: Array<{
      customerId: string;
      companyName: string | null;
      reason: string;
      exceedingDimensions: string[];
    }> = [];

    const corporateIds = (customers || [])
      .filter((c) => c.customer_type === 'COMPANY')
      .slice(0, 50) // cap to 50 to keep response time bounded
      .map((c) => c.id);

    if (corporateIds.length > 0) {
      const { data: corporateDetails } = await admin
        .from('customer')
        .select('id, company_name, full_name')
        .in('id', corporateIds);

      const detailsMap = new Map(corporateDetails?.map((c) => [c.id, c]) || []);

      for (const customerId of corporateIds) {
        try {
          const usage = await getPeakUsage(customerId, 1);
          const rec = suggestPlanForCustomer(usage);
          if (rec.exceedsAllPlans) {
            const detail = detailsMap.get(customerId);
            proExceedingCandidates.push({
              customerId,
              companyName: detail?.company_name || detail?.full_name || 'Unknown',
              reason: rec.reason,
              exceedingDimensions: rec.exceedingDimensions,
            });
          }
        } catch {
          // skip
        }
      }
    }

    // ─── Open custom pricing quotes ──────
    const { count: openQuotesCount } = await admin
      .from('custom_pricing_quote')
      .select('id', { count: 'exact', head: true })
      .in('status', ['SENT', 'ACCEPTED']);

    return NextResponse.json({
      success: true,
      data: {
        customers: {
          total: totalCustomers,
          corporate: corporateCustomers,
          individual: individualCustomers,
          recentSignups30d: recentSignups,
        },
        subscriptions: {
          active: subscribedCustomers,
          unsubscribedCorporate,
          planDistribution,
          mrrIdr,
        },
        volume: {
          currentPeriod,
          activeEmployees: employeeCount || 0,
          withholdingTransactions: withholdingCount || 0,
          ppnTransactions: ppnCount,
        },
        proExceeding: {
          count: proExceedingCandidates.length,
          candidates: proExceedingCandidates,
        },
        customPricing: {
          openQuotes: openQuotesCount || 0,
        },
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/admin/master/stats error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
