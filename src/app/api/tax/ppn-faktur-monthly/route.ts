import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/tax/ppn-faktur-monthly?customerId=xxx&period=2025-01
 * POST /api/tax/ppn-faktur-monthly - Create faktur entry
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

  let query = getSupabaseAdmin().from('ppn_faktur_monthly').select('*').eq('customer_id', cid).order('faktur_date', { ascending: false });
  if (period) query = query.eq('tax_period', period);

  const { data } = await query;
  const fakturs = data || [];

  // Summary: Output vs Input
  const keluaran = fakturs.filter(f => f.faktur_type === 'KELUARAN' && f.status === 'APPROVED');
  const masukan = fakturs.filter(f => f.faktur_type === 'MASUKAN' && f.status === 'APPROVED');

  const summary = {
    outputTax: {
      count: keluaran.length,
      totalDpp: keluaran.reduce((s, f) => s + Number(f.dpp), 0),
      totalPpn: keluaran.reduce((s, f) => s + Number(f.ppn), 0),
    },
    inputTax: {
      count: masukan.length,
      totalDpp: masukan.reduce((s, f) => s + Number(f.dpp), 0),
      totalPpn: masukan.reduce((s, f) => s + Number(f.ppn), 0),
    },
    netPpn: 0,
    status: 'NIHIL' as string,
  };

  summary.netPpn = summary.outputTax.totalPpn - summary.inputTax.totalPpn;
  summary.status = summary.netPpn > 0 ? 'KURANG_BAYAR' : summary.netPpn < 0 ? 'LEBIH_BAYAR' : 'NIHIL';

  return NextResponse.json({ success: true, data: { fakturs, summary } });
}

// PMK 131/2024: 2025-01-01 부터 statutory rate 12% (essential 은 DPP × 11/12 후
// 12% 적용 = effective 11%). UI 가 ppn 을 직접 계산해서 보내면 그 값을 우선
// 사용하고, 없을 때만 fallback 으로 12% 적용 (bulk-import 와 동일 패턴).
const PPN_DEFAULT_RATE = 0.12;

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, taxPeriod, fakturType, fakturNumber, fakturDate, counterpartyId, counterpartyName, counterpartyNpwp, dpp, ppn: ppnFromBody } = body;

    if (!customerId || !taxPeriod || !fakturType || !dpp) {
      return NextResponse.json({ error: 'customerId, taxPeriod, fakturType, dpp required' }, { status: 400 });
    }

    const ppnNum = Number(ppnFromBody);
    const ppn = Number.isFinite(ppnNum) && ppnNum > 0
      ? Math.round(ppnNum)
      : Math.round(Number(dpp) * PPN_DEFAULT_RATE);

    // Get counterparty info if provided
    let cpName = counterpartyName || '';
    let cpNpwp = counterpartyNpwp || '';
    if (counterpartyId) {
      const { data: cp } = await getSupabaseAdmin().from('tax_counterparty').select('name, npwp').eq('id', counterpartyId).single();
      if (cp) { cpName = cp.name; cpNpwp = cp.npwp || ''; }
    }

    const { data, error } = await getSupabaseAdmin().from('ppn_faktur_monthly').insert({
      customer_id: customerId,
      tax_period: taxPeriod,
      faktur_type: fakturType,
      faktur_number: fakturNumber || null,
      faktur_date: fakturDate || new Date().toISOString().slice(0, 10),
      counterparty_id: counterpartyId || null,
      counterparty_name: cpName,
      counterparty_npwp: cpNpwp,
      dpp,
      ppn,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await getSupabaseAdmin().from('ppn_faktur_monthly').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
export async function DELETE(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleDelete); }
