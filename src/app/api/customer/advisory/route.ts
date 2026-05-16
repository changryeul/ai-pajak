/**
 * /api/customer/advisory
 *
 * GET — returns the 4 AI Tax Advisory signals the landing promises:
 *   1. PKP registration alert (revenue vs 4.8B threshold)
 *   2. UMKM ↔ PPh25 transition guidance (via determineAnnualRegime)
 *   3. Tax Treaty / PPh26 review need (DGT Form gaps)
 *   4. Asset-growth anomaly is already surfaced by GrowthAnomalyCard
 *      using /api/customer/snapshots, so it is NOT duplicated here.
 *
 * Auth: customer-only. Returns ko-friendly enum statuses + numeric inputs
 * so the client can render localized copy.
 */

import { NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { determineAnnualRegime, UMKM_REVENUE_THRESHOLD } from '@/lib/tax/annual-regime';
import { loggers } from '@/lib/logger';

type PkpStatus = 'NOT_APPLICABLE' | 'OK' | 'APPROACHING' | 'EXCEEDED' | 'REGISTERED';

interface PkpSignal {
  status: PkpStatus;
  annualRevenueIdr: number;
  thresholdIdr: number;
  pctOfThreshold: number;
  isPkp: boolean;
}

interface UmkmTransitionSignal {
  regime: 'PPH_FINAL' | 'PPH25' | 'NOT_DETERMINED';
  title: string;
  reason: string;
  yearsOperating: number;
  umkmYearsRemaining: number | null;
  warnings: string[];
  transitionUrgent: boolean;
}

interface TaxTreatySignal {
  status: 'NOT_APPLICABLE' | 'OK' | 'REVIEW_NEEDED';
  pph26TransactionCount: number;
  missingTreatyCount: number;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();

  const { data: customer, error: cErr } = await admin
    .from('customer')
    .select('id, customer_type, annual_revenue, is_pkp, legal_form, established_year, npwp_pph25_elected, umkm_start_year')
    .eq('user_id', req.session.userId)
    .maybeSingle();

  if (cErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const isCompany = customer.customer_type === 'COMPANY';
  const annualRevenue = Number(customer.annual_revenue ?? 0);
  const isPkp = Boolean(customer.is_pkp);

  // ─── PKP signal ───
  let pkpStatus: PkpStatus = 'NOT_APPLICABLE';
  const pctOfThreshold = UMKM_REVENUE_THRESHOLD > 0
    ? Math.round((annualRevenue / UMKM_REVENUE_THRESHOLD) * 1000) / 10
    : 0;
  if (isCompany || annualRevenue > 0) {
    if (isPkp) {
      pkpStatus = 'REGISTERED';
    } else if (annualRevenue >= UMKM_REVENUE_THRESHOLD) {
      pkpStatus = 'EXCEEDED';
    } else if (annualRevenue >= UMKM_REVENUE_THRESHOLD * 0.8) {
      pkpStatus = 'APPROACHING';
    } else if (annualRevenue > 0) {
      pkpStatus = 'OK';
    }
  }

  const pkp: PkpSignal = {
    status: pkpStatus,
    annualRevenueIdr: annualRevenue,
    thresholdIdr: UMKM_REVENUE_THRESHOLD,
    pctOfThreshold,
    isPkp,
  };

  // ─── UMKM ↔ PPh25 transition ───
  const regimeResult = isCompany
    ? determineAnnualRegime({
        establishedYear: customer.established_year,
        annualRevenue,
        npwpPph25Elected: customer.npwp_pph25_elected,
        legalForm: customer.legal_form,
        umkmStartYear: customer.umkm_start_year,
      })
    : null;

  const umkmTransition: UmkmTransitionSignal = regimeResult
    ? {
        regime: regimeResult.regime,
        title: regimeResult.title,
        reason: regimeResult.reason,
        yearsOperating: regimeResult.yearsOperating,
        umkmYearsRemaining: regimeResult.umkmYearsRemaining ?? null,
        warnings: regimeResult.warnings ?? [],
        transitionUrgent:
          regimeResult.regime === 'PPH25' && annualRevenue >= UMKM_REVENUE_THRESHOLD,
      }
    : {
        regime: 'NOT_DETERMINED',
        title: '',
        reason: '',
        yearsOperating: 0,
        umkmYearsRemaining: null,
        warnings: [],
        transitionUrgent: false,
      };

  // ─── Tax Treaty / PPh26 signal ───
  const { count: pph26Count } = await admin
    .from('pph26_transaction')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id);

  const { count: missingTreatyCount } = await admin
    .from('pph26_transaction')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('treaty_applied', false);

  const pph26TransactionCount = pph26Count ?? 0;
  const taxTreaty: TaxTreatySignal = {
    status:
      pph26TransactionCount === 0
        ? 'NOT_APPLICABLE'
        : (missingTreatyCount ?? 0) > 0
          ? 'REVIEW_NEEDED'
          : 'OK',
    pph26TransactionCount,
    missingTreatyCount: missingTreatyCount ?? 0,
  };

  loggers.api.info(
    {
      userId: req.session.userId,
      customerId: customer.id,
      pkp: pkp.status,
      regime: umkmTransition.regime,
      treaty: taxTreaty.status,
    },
    'GET /api/customer/advisory',
  );

  return NextResponse.json({
    success: true,
    data: {
      isCompany,
      pkp,
      umkmTransition,
      taxTreaty,
    },
  });
}

export async function GET(request: Request) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as unknown as RequestWithSession, handleGet);
}
