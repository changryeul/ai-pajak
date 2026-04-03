import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';

const INCOME_TYPES = {
  dividend: { label: 'Dividen', rate: 0.20 },
  interest: { label: 'Bunga', rate: 0.20 },
  royalty: { label: 'Royalti', rate: 0.20 },
  service: { label: 'Jasa Teknik/Manajemen', rate: 0.20 },
  salary: { label: 'Gaji/Upah', rate: 0.20 },
  pension: { label: 'Pensiun', rate: 0.20 },
  insurance: { label: 'Premi Asuransi', rate: 0.20 },
  other: { label: 'Lainnya', rate: 0.20 },
};

/**
 * GET /api/tax/pph26-transactions?customerId=xxx&period=2025-01
 * POST /api/tax/pph26-transactions
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

  let query = getSupabaseAdmin().from('pph26_transaction').select('*').eq('customer_id', cid).order('transaction_date', { ascending: false });
  if (period) query = query.eq('tax_period', period);

  const { data } = await query;

  const summary = {
    totalGross: (data || []).reduce((s, t) => s + Number(t.gross_amount), 0),
    totalTax: (data || []).reduce((s, t) => s + Number(t.tax_amount), 0),
    transactionCount: (data || []).length,
    treatyAppliedCount: (data || []).filter(t => t.treaty_applied).length,
    byIncomeType: Object.entries(
      (data || []).reduce((acc, t) => {
        acc[t.income_type] = (acc[t.income_type] || 0) + Number(t.tax_amount);
        return acc;
      }, {} as Record<string, number>)
    ).map(([type, total]) => ({ type, total })),
  };

  return NextResponse.json({
    success: true,
    data: {
      transactions: data || [],
      summary,
      incomeTypes: INCOME_TYPES,
    },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      customerId, counterpartyId, taxPeriod, transactionDate,
      incomeType, grossAmount, invoiceNumber, description,
      recipientCountry, hasCod,
    } = body;

    if (!customerId || !taxPeriod || !incomeType || !grossAmount || !recipientCountry) {
      return NextResponse.json({
        error: 'customerId, taxPeriod, incomeType, grossAmount, recipientCountry required',
      }, { status: 400 });
    }

    if (!INCOME_TYPES[incomeType as keyof typeof INCOME_TYPES]) {
      return NextResponse.json({ error: 'Invalid incomeType' }, { status: 400 });
    }

    // Get counterparty info
    let recipientName = body.recipientName || '';
    let recipientNpwp = body.recipientNpwp || '';
    if (counterpartyId) {
      const { data: cp } = await getSupabaseAdmin().from('tax_counterparty').select('name, npwp').eq('id', counterpartyId).single();
      if (cp) { recipientName = cp.name; recipientNpwp = cp.npwp || ''; }
    }

    // Use Tax Resolution Engine for automatic rate determination
    const serviceCategoryMap: Record<string, string> = {
      dividend: 'DIVIDEND', interest: 'INTEREST', royalty: 'ROYALTY',
    };
    const resolution = TaxResolutionEngine.resolve({
      grossAmount,
      transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
      serviceCategory: (serviceCategoryMap[incomeType] || 'SERVICE') as 'DIVIDEND' | 'INTEREST' | 'ROYALTY' | 'SERVICE',
      recipientType: 'NON_RESIDENT',
      recipientCountry,
      hasCertificateOfDomicile: hasCod ?? false,
      recipientNpwp,
    });

    const appliedRate = resolution.rate;
    const taxAmount = resolution.taxAmount;
    const treatyApplied = resolution.ruleId.startsWith('TREATY_') && !resolution.ruleId.endsWith('STANDARD_20') && !resolution.ruleId.endsWith('NOT_BENEFICIAL');
    const treatyRate = treatyApplied ? appliedRate : null;

    const { data, error } = await getSupabaseAdmin().from('pph26_transaction').insert({
      customer_id: customerId,
      counterparty_id: counterpartyId || null,
      tax_period: taxPeriod,
      transaction_date: transactionDate || new Date().toISOString().slice(0, 10),
      description: description || resolution.reason,
      income_type: incomeType,
      invoice_number: invoiceNumber,
      gross_amount: grossAmount,
      standard_rate: 0.20,
      applied_rate: appliedRate,
      tax_amount: taxAmount,
      recipient_name: recipientName,
      recipient_country: recipientCountry,
      recipient_npwp: recipientNpwp,
      treaty_applied: treatyApplied,
      treaty_rate: treatyRate,
      treaty_reference: treatyApplied ? resolution.legalBasis : null,
      has_cod: hasCod ?? false,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update monthly payment (best effort)
    try {
      await getSupabaseAdmin().rpc('update_monthly_payment_amount', {
        p_customer_id: customerId, p_tax_type: 'PPh26', p_tax_period: taxPeriod,
      });
    } catch { /* RPC may not exist yet */ }

    return NextResponse.json({
      success: true,
      data,
      resolution: {
        ruleId: resolution.ruleId,
        reason: resolution.reason,
        legalBasis: resolution.legalBasis,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
