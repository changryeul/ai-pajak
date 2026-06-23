import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
import { SERVICE_TYPE_TO_CATEGORY, taxTypeToRegime, isDgtFormValid } from '@/lib/tax/withholding-helpers';
import { assignPendingBPNumbers } from '@/lib/tax/ebupot/pph23-bupot-service';
import type { ServiceCategory } from '@/types';

const SERVICE_TYPES = {
  JASA_TEKNIK: { label: 'Jasa Teknik', rate: 0.02 },
  JASA_MANAJEMEN: { label: 'Jasa Manajemen', rate: 0.02 },
  JASA_KONSULTAN: { label: 'Jasa Konsultan', rate: 0.02 },
  JASA_LAINNYA: { label: 'Jasa Lainnya', rate: 0.02 },
  SEWA: { label: 'Sewa (selain tanah/bangunan)', rate: 0.02 },
  DIVIDEN: { label: 'Dividen', rate: 0.15 },
  BUNGA: { label: 'Bunga', rate: 0.15 },
  ROYALTI: { label: 'Royalti', rate: 0.15 },
  HADIAH: { label: 'Hadiah/Penghargaan', rate: 0.15 },
};

/**
 * GET /api/tax/pph23-transactions?customerId=xxx&period=2025-01
 * POST /api/tax/pph23-transactions - Create transaction
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  const period = url.searchParams.get('period');
  const { role, userId } = req.session;

  let cid = customerId;
  if (!cid && role === 'CUSTOMER') {
    const { data: c } = await getSupabaseAdmin().from('customer').select('id').eq('user_id', userId).single();
    cid = c?.id;
  }
  if (!cid) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = (page - 1) * limit;

  let query = getSupabaseAdmin().from('pph23_transaction').select('*', { count: 'exact' }).eq('customer_id', cid).order('transaction_date', { ascending: false }).range(offset, offset + limit - 1);
  if (period) query = query.eq('tax_period', period);
  // `regime=PPH4_2` 는 `/tax/pph42` 페이지 전용 부분 뷰. 같은 테이블의
  // tax_regime='PPH4_2' AND tax_rate=0.10 (토지·건물 임대) 만 선별.
  // 그 외 ?regime=PPH23 도 지원 — 명시 시 PPh4(2) 행 제외.
  const regime = url.searchParams.get('regime');
  if (regime === 'PPH4_2') {
    query = query.eq('tax_regime', 'PPH4_2').eq('tax_rate', 0.10);
  } else if (regime === 'PPH23') {
    query = query.not('tax_regime', 'eq', 'PPH4_2');
  }

  const { data, count } = await query;

  const summary = {
    totalGross: (data || []).reduce((s, t) => s + Number(t.gross_amount), 0),
    totalTax: (data || []).reduce((s, t) => s + Number(t.tax_amount), 0),
    transactionCount: (data || []).length,
    byServiceType: Object.entries(
      (data || []).reduce((acc, t) => {
        acc[t.service_type] = (acc[t.service_type] || 0) + Number(t.tax_amount);
        return acc;
      }, {} as Record<string, number>)
    ).map(([type, total]) => ({ type, total })),
  };

  return NextResponse.json({
    success: true,
    data: {
      transactions: data || [],
      summary,
      serviceTypes: SERVICE_TYPES,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      customerId, counterpartyId, taxPeriod, transactionDate, serviceType,
      grossAmount, invoiceNumber, description,
      // Phase 4 explicit context
      rentalAssetType, interestSource, shareholdingPctAtTime, isReinvestedDomestically,
    } = body;

    if (!customerId || !taxPeriod || !grossAmount) {
      return NextResponse.json({ error: 'customerId, taxPeriod, grossAmount required' }, { status: 400 });
    }

    // Fetch counterparty full profile for engine context
    let counterpartyName = body.counterpartyName || '';
    let counterpartyNpwp = body.counterpartyNpwp || '';
    let cpRecord: {
      name: string;
      npwp: string | null;
      country: string | null;
      is_foreign: boolean | null;
      is_resident: boolean | null;
      is_entity: boolean | null;
      has_cod: boolean | null;
      shareholding_pct: number | null;
      is_beneficial_owner: boolean | null;
      receives_reinvested_dividend: boolean | null;
      vendor_is_property_owner: boolean | null;
      is_related_party: boolean | null;
      dgt_form_valid_until: string | null;
    } | null = null;

    if (counterpartyId) {
      const { data: cp } = await getSupabaseAdmin()
        .from('tax_counterparty')
        .select('name, npwp, country, is_foreign, is_resident, is_entity, has_cod, shareholding_pct, is_beneficial_owner, receives_reinvested_dividend, vendor_is_property_owner, is_related_party, dgt_form_valid_until')
        .eq('id', counterpartyId)
        .single();
      if (cp) {
        cpRecord = cp;
        counterpartyName = cp.name;
        counterpartyNpwp = cp.npwp || '';
      }
    }

    // Check DGT Form validity (not expired as of transaction date)
    const txDate = transactionDate || new Date().toISOString().slice(0, 10);
    const hasDgtForm = isDgtFormValid(cpRecord?.dgt_form_valid_until, txDate);

    let effectiveRate: number;
    let taxAmount: number;
    let resolvedServiceType = serviceType;
    let resolutionInfo: { ruleId: string; reason: string; legalBasis: string; taxType: string; isFinal: boolean; npwpSurchargeApplied: boolean } | undefined;

    // Option A: Use Resolution Engine for automatic rate determination
    if (body.useResolution !== false) {
      const serviceCategory = (
        body.serviceCategory
        || SERVICE_TYPE_TO_CATEGORY[serviceType]
        || 'SERVICE'
      ) as ServiceCategory;

      const recipientType = cpRecord?.is_foreign || cpRecord?.is_resident === false ? 'NON_RESIDENT' : 'RESIDENT';

      const resolution = TaxResolutionEngine.resolve({
        grossAmount,
        transactionDate: txDate,
        description,
        serviceCategory,
        recipientType,
        recipientNpwp: counterpartyNpwp,
        recipientCountry: cpRecord?.country || undefined,
        hasCertificateOfDomicile: cpRecord?.has_cod || false,
        hasDgtForm,
        recipientIsEntity: cpRecord?.is_entity ?? undefined,
        // Shareholding: use override from request body if provided, else counterparty default
        shareholdingPct: shareholdingPctAtTime ?? cpRecord?.shareholding_pct ?? undefined,
        isBeneficialOwner: cpRecord?.is_beneficial_owner ?? undefined,
        // Reinvestment: use override from request body if provided, else counterparty default
        receivesReinvestedDividend: isReinvestedDomestically ?? cpRecord?.receives_reinvested_dividend ?? false,
        rentalAssetType: rentalAssetType || undefined,
        interestSource: interestSource || undefined,
        vendorIsPropertyOwner: cpRecord?.vendor_is_property_owner || body.vendorIsPropertyOwner,
        isRelatedParty: cpRecord?.is_related_party || false,
        kbliCode: body.kbliCode,
        constructionType: body.constructionType,
        qualification: body.qualification,
      });

      effectiveRate = resolution.rate;
      taxAmount = resolution.taxAmount;
      resolutionInfo = {
        ruleId: resolution.ruleId,
        reason: resolution.reason,
        legalBasis: resolution.legalBasis,
        taxType: resolution.taxType,
        isFinal: resolution.isFinal,
        npwpSurchargeApplied: resolution.npwpSurchargeApplied,
      };

      // Keep original service_type for DB (for e-Bupot reporting)
      if (!resolvedServiceType) {
        resolvedServiceType = 'JASA_LAINNYA';
      }
    }
    // Option B: Manual service type + rate (legacy path)
    else {
      if (!serviceType) {
        return NextResponse.json({ error: 'serviceType required (or use useResolution: true)' }, { status: 400 });
      }
      const typeInfo = SERVICE_TYPES[serviceType as keyof typeof SERVICE_TYPES];
      if (!typeInfo) return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 });

      const hasNpwp = !!counterpartyNpwp && counterpartyNpwp.trim().length >= 15;
      effectiveRate = hasNpwp ? typeInfo.rate : typeInfo.rate * 2;
      taxAmount = Math.round(grossAmount * effectiveRate);
    }

    const taxRegime = resolutionInfo
      ? taxTypeToRegime(resolutionInfo.taxType, effectiveRate)
      : (resolvedServiceType === 'SEWA' ? 'PPH4_2' : 'PPH23');

    const { data, error } = await getSupabaseAdmin().from('pph23_transaction').insert({
      customer_id: customerId,
      counterparty_id: counterpartyId || null,
      tax_period: taxPeriod,
      transaction_date: txDate,
      description: description || resolutionInfo?.reason || '',
      service_type: resolvedServiceType,
      invoice_number: invoiceNumber,
      gross_amount: grossAmount,
      tax_rate: effectiveRate,
      tax_amount: taxAmount,
      counterparty_name: counterpartyName,
      counterparty_npwp: counterpartyNpwp,
      // Phase 4 fields
      tax_regime: taxRegime,
      income_type: resolvedServiceType,
      rental_asset_type: rentalAssetType || null,
      interest_source: interestSource || null,
      shareholding_pct_at_time: shareholdingPctAtTime ?? cpRecord?.shareholding_pct ?? null,
      is_reinvested_domestically: !!(isReinvestedDomestically ?? cpRecord?.receives_reinvested_dividend),
      recipient_is_entity: cpRecord?.is_entity ?? null,
      recipient_country: cpRecord?.country || null,
      treaty_applied: resolutionInfo?.taxType === 'PPh26' && effectiveRate < 0.20,
      resolution_rule_id: resolutionInfo?.ruleId || null,
      resolution_reason: resolutionInfo?.reason || null,
      resolution_legal_basis: resolutionInfo?.legalBasis || null,
      is_final: resolutionInfo?.isFinal || false,
      npwp_surcharge_applied: resolutionInfo?.npwpSurchargeApplied || false,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update monthly payment amount (best effort)
    try {
      await getSupabaseAdmin().rpc('update_monthly_payment_amount', {
        p_customer_id: customerId, p_tax_type: 'PPh23', p_tax_period: taxPeriod,
      });
    } catch { /* RPC may not exist yet */ }

    // 2026-06-24: e-Bupot 번호 자동 부여 (best-effort)
    try { await assignPendingBPNumbers(getSupabaseAdmin(), customerId, taxPeriod); } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data,
      ...(resolutionInfo && { resolution: resolutionInfo }),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

async function handlePut(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { id, grossAmount, serviceType, counterpartyName, counterpartyNpwp, description, transactionDate } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (grossAmount !== undefined) {
      const typeInfo = SERVICE_TYPES[(serviceType || 'JASA_LAINNYA') as keyof typeof SERVICE_TYPES];
      const rate = typeInfo?.rate || 0.02;
      const hasNpwp = !!counterpartyNpwp && counterpartyNpwp.trim().length >= 15;
      const effectiveRate = hasNpwp ? rate : rate * 2;
      updateData.gross_amount = grossAmount;
      updateData.tax_rate = effectiveRate;
      updateData.tax_amount = Math.round(grossAmount * effectiveRate);
    }
    if (serviceType) updateData.service_type = serviceType;
    if (counterpartyName !== undefined) updateData.counterparty_name = counterpartyName;
    if (counterpartyNpwp !== undefined) updateData.counterparty_npwp = counterpartyNpwp;
    if (description !== undefined) updateData.description = description;
    if (transactionDate) updateData.transaction_date = transactionDate;

    const { error } = await getSupabaseAdmin().from('pph23_transaction').update(updateData).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await getSupabaseAdmin().from('pph23_transaction').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
export async function PUT(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePut); }
export async function DELETE(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleDelete); }
