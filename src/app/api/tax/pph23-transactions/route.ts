import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
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

  let query = getSupabaseAdmin().from('pph23_transaction').select('*').eq('customer_id', cid).order('transaction_date', { ascending: false });
  if (period) query = query.eq('tax_period', period);

  const { data } = await query;

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
      rateInfo: {
        note: 'Tarif 2x berlaku jika lawan transaksi tidak memiliki NPWP (Pasal 21 ayat 5a UU PPh)',
        withNpwp: 'Tarif normal',
        withoutNpwp: 'Tarif 2x lipat',
      },
    },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, counterpartyId, taxPeriod, transactionDate, serviceType, grossAmount, invoiceNumber, description } = body;

    if (!customerId || !taxPeriod || !grossAmount) {
      return NextResponse.json({ error: 'customerId, taxPeriod, grossAmount required' }, { status: 400 });
    }

    // Get counterparty info
    let counterpartyName = body.counterpartyName || '';
    let counterpartyNpwp = body.counterpartyNpwp || '';
    if (counterpartyId) {
      const { data: cp } = await getSupabaseAdmin().from('tax_counterparty').select('name, npwp').eq('id', counterpartyId).single();
      if (cp) { counterpartyName = cp.name; counterpartyNpwp = cp.npwp || ''; }
    }

    let effectiveRate: number;
    let taxAmount: number;
    let resolvedServiceType = serviceType;
    let resolutionInfo: { ruleId: string; reason: string; legalBasis: string } | undefined;

    // Option A: Use Resolution Engine for automatic rate determination
    if (body.useResolution) {
      const resolution = TaxResolutionEngine.resolve({
        grossAmount,
        transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
        serviceCategory: (body.serviceCategory || 'SERVICE') as ServiceCategory,
        recipientType: 'RESIDENT',
        recipientNpwp: counterpartyNpwp,
        vendorIsPropertyOwner: body.vendorIsPropertyOwner,
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
      };

      // Map resolution to service type for DB storage
      if (!resolvedServiceType) {
        resolvedServiceType = effectiveRate >= 0.15 ? 'DIVIDEN' : 'JASA_LAINNYA';
      }
    }
    // Option B: Manual service type + rate (existing behavior)
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

    const { data, error } = await getSupabaseAdmin().from('pph23_transaction').insert({
      customer_id: customerId,
      counterparty_id: counterpartyId || null,
      tax_period: taxPeriod,
      transaction_date: transactionDate || new Date().toISOString().slice(0, 10),
      description: description || resolutionInfo?.reason || '',
      service_type: resolvedServiceType,
      invoice_number: invoiceNumber,
      gross_amount: grossAmount,
      tax_rate: effectiveRate,
      tax_amount: taxAmount,
      counterparty_name: counterpartyName,
      counterparty_npwp: counterpartyNpwp,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update monthly payment amount (best effort)
    try {
      await getSupabaseAdmin().rpc('update_monthly_payment_amount', {
        p_customer_id: customerId, p_tax_type: 'PPh23', p_tax_period: taxPeriod,
      });
    } catch { /* RPC may not exist yet */ }

    return NextResponse.json({
      success: true,
      data,
      ...(resolutionInfo && { resolution: resolutionInfo }),
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
