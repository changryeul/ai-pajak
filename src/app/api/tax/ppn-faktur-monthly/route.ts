import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';
import { PPNCalculator } from '@/lib/tax/ppn-calculator';

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

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      customerId, taxPeriod, fakturType, fakturNumber, fakturDate,
      counterpartyId, counterpartyName, counterpartyNpwp,
      dpp, ppn: ppnFromBody,
      dppNilaiLain: dppNilaiLainFromBody, isLuxury: isLuxuryFromBody,
    } = body;

    if (!customerId || !taxPeriod || !fakturType || !dpp) {
      return NextResponse.json({ error: 'customerId, taxPeriod, fakturType, dpp required' }, { status: 400 });
    }

    // 2026-06-29 PMK 131/2024 정합:
    //   essential (default) → ppn = DPP × 11/12 × 12% = DPP × 11%
    //   luxury               → ppn = DPP × 12%
    // ppn/dpp_nilai_lain 모두 body 우선, 없으면 PPNCalculator.calculateSimple
    // 로 함께 일관 계산.
    const isLuxury = isLuxuryFromBody === true;
    const fakturDateResolved = fakturDate || new Date().toISOString().slice(0, 10);
    const calc = PPNCalculator.calculateSimple(
      Number(dpp),
      new Date(fakturDateResolved),
      isLuxury,
    );
    const ppnNum = Number(ppnFromBody);
    const ppn = Number.isFinite(ppnNum) && ppnNum > 0
      ? Math.round(ppnNum)
      : calc.ppn_amount;
    const dppNilaiLainNum = Number(dppNilaiLainFromBody);
    const dppNilaiLain = Number.isFinite(dppNilaiLainNum) && dppNilaiLainNum > 0
      ? Math.round(dppNilaiLainNum)
      : calc.adjusted_dpp;

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
      faktur_date: fakturDateResolved,
      counterparty_id: counterpartyId || null,
      counterparty_name: cpName,
      counterparty_npwp: cpNpwp,
      dpp,
      dpp_nilai_lain: dppNilaiLain,
      is_luxury: isLuxury,
      ppn,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 고객 PPN faktur 입력 → 담당 상담원 업무함에 PPN 큐 자동 노출 (best-effort).
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPN', taxPeriod);

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/tax/ppn-faktur-monthly — inline edit (faktur 목록 행)
 * 부분 update. dpp 변경 시 ppn / dpp_nilai_lain 자동 재계산 (UI 가 명시적으로
 * 값을 주면 그 값을 우선). dppNilaiLain 재계산은 PMK 131/2024 (essential
 * 2025+ → dpp × 11/12) 의 PPNCalculator.adjustDPP 와 동일 분기.
 */
async function handlePut(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      id, fakturNumber, fakturDate, counterpartyName, counterpartyNpwp,
      dpp, ppn, dppNilaiLain, isLuxury, fakturType,
      // 2026-06-26: 신규 — 양식이 수집하지만 그동안 surface 안 되던 필드들.
      invoiceNumber, counterpartyAddress, description, notes,
    } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (fakturNumber !== undefined) update.faktur_number = fakturNumber || null;
    if (fakturDate !== undefined) update.faktur_date = fakturDate;
    if (counterpartyName !== undefined) update.counterparty_name = counterpartyName;
    if (counterpartyNpwp !== undefined) update.counterparty_npwp = counterpartyNpwp;
    if (fakturType !== undefined) update.faktur_type = fakturType;
    if (invoiceNumber !== undefined) update.invoice_number = invoiceNumber || null;
    if (counterpartyAddress !== undefined) update.counterparty_address = counterpartyAddress || null;
    if (description !== undefined) update.description = description || null;
    if (notes !== undefined) update.notes = notes || null;

    // 2026-06-29 PMK 131/2024 정합:
    //   essential → ppn = adjustedDPP × 12% = DPP × 11/12 × 12% = DPP × 11%
    //   luxury    → ppn = DPP × 12%
    // dpp 또는 isLuxury 중 하나만 바뀌어도 ppn + dpp_nilai_lain 모두
    // PPNCalculator.calculateSimple 로 함께 재계산 (사용자가 ppn/dpp_nilai_lain
    // 을 명시적으로 보낸 경우는 그 값을 우선).
    const luxuryChanged = isLuxury !== undefined;
    const dppChanged = dpp !== undefined;
    if (luxuryChanged) update.is_luxury = isLuxury === true;
    if (dppChanged || luxuryChanged) {
      // current row 조회 — dpp 또는 isLuxury 한쪽만 왔을 때 나머지를 채움.
      const { data: current } = await getSupabaseAdmin()
        .from('ppn_faktur_monthly')
        .select('dpp, is_luxury, faktur_date')
        .eq('id', id)
        .single();
      const effectiveDpp = dppChanged ? Number(dpp) : Number(current?.dpp ?? 0);
      const effectiveLuxury = luxuryChanged ? isLuxury === true : current?.is_luxury === true;
      const dateStr = fakturDate || current?.faktur_date || new Date().toISOString().slice(0, 10);
      const calc = PPNCalculator.calculateSimple(effectiveDpp, new Date(dateStr), effectiveLuxury);
      if (dppChanged) update.dpp = effectiveDpp;
      if (ppn === undefined) update.ppn = calc.ppn_amount;
      if (dppNilaiLain === undefined) update.dpp_nilai_lain = calc.adjusted_dpp;
    }
    if (ppn !== undefined) update.ppn = Math.round(Number(ppn));
    if (dppNilaiLain !== undefined) update.dpp_nilai_lain = Math.round(Number(dppNilaiLain));

    const { error } = await getSupabaseAdmin().from('ppn_faktur_monthly').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
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
export async function PUT(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePut); }
export async function DELETE(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleDelete); }
