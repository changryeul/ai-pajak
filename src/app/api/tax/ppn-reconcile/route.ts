/**
 * PPN Coretax 대조 (v19 §9 — 트랙 6)
 *
 * POST — Coretax 출력 faktur 리스트를 받아 고객 제출분과 대조.
 *   body: { customerId?, taxPeriod, coretaxFaktur: [{ fakturType, fakturNumber, dpp, ppn }] }
 *   고객 행에 coretax 값 + recon_status 기록, Coretax 전용 faktur 는
 *   source=CORETAX 행으로 삽입(MISSING_CUSTOMER). 재실행 시 기존 CORETAX 행
 *   정리 후 재대조 → drift 0.
 *
 * GET  — 대조 결과 목록 + 요약(match/diff/missing).
 *   query: ?customerId=&taxPeriod=
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { reconcile, type CustomerFaktur } from '@/lib/tax/ppn-reconcile';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  customerId: z.string().uuid().optional(),
  taxPeriod: z.string().min(4).max(10),
  coretaxFaktur: z.array(z.object({
    fakturType: z.enum(['KELUARAN', 'MASUKAN']),
    fakturNumber: z.string().min(1),
    dpp: z.number().nonnegative(),
    ppn: z.number().nonnegative(),
  })).max(5000),
});

async function resolveCid(req: RequestWithSession, given?: string): Promise<string | null> {
  if (given) return given;
  if (req.session.role === 'CUSTOMER') {
    const { data } = await getSupabaseAdmin().from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
    return data?.id ?? null;
  }
  return null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const cid = await resolveCid(req, url.searchParams.get('customerId') ?? undefined);
  const taxPeriod = url.searchParams.get('taxPeriod');
  if (!cid || !taxPeriod) return NextResponse.json({ error: 'customerId and taxPeriod required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: rows } = await admin
    .from('ppn_faktur_monthly')
    .select('id, faktur_type, faktur_number, dpp, ppn, coretax_dpp, coretax_ppn, recon_status, recon_source, counterparty_name, reconciled_at')
    .eq('customer_id', cid)
    .eq('tax_period', taxPeriod)
    .order('faktur_type', { ascending: true })
    .order('faktur_number', { ascending: true });

  const list = rows ?? [];
  const summary = {
    total: list.length,
    match: list.filter(r => r.recon_status === 'MATCH').length,
    diff: list.filter(r => r.recon_status === 'DIFF').length,
    missingCoretax: list.filter(r => r.recon_status === 'MISSING_CORETAX').length,
    missingCustomer: list.filter(r => r.recon_status === 'MISSING_CUSTOMER').length,
    pending: list.filter(r => r.recon_status === 'PENDING').length,
    reconciledAt: list.find(r => r.reconciled_at)?.reconciled_at ?? null,
  };
  return NextResponse.json({ success: true, data: { rows: list, summary } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const cid = await resolveCid(req, parsed.data.customerId);
  if (!cid) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  const { taxPeriod, coretaxFaktur } = parsed.data;

  const admin = getSupabaseAdmin();

  // 재실행 drift 0 — 이전 CORETAX 전용 행 제거.
  await admin.from('ppn_faktur_monthly')
    .delete().eq('customer_id', cid).eq('tax_period', taxPeriod).eq('recon_source', 'CORETAX');

  const { data: custRows } = await admin
    .from('ppn_faktur_monthly')
    .select('id, faktur_type, faktur_number, dpp, ppn')
    .eq('customer_id', cid)
    .eq('tax_period', taxPeriod)
    .eq('recon_source', 'CUSTOMER');

  const customer: CustomerFaktur[] = (custRows ?? []).map(r => ({
    id: r.id, fakturType: r.faktur_type, fakturNumber: r.faktur_number,
    dpp: Number(r.dpp ?? 0), ppn: Number(r.ppn ?? 0),
  }));

  const result = reconcile(customer, coretaxFaktur);
  const now = new Date().toISOString();

  // 고객 행 갱신.
  for (const u of result.updates) {
    await admin.from('ppn_faktur_monthly').update({
      coretax_dpp: u.coretaxDpp, coretax_ppn: u.coretaxPpn,
      recon_status: u.reconStatus, reconciled_at: now,
    }).eq('id', u.id);
  }

  // Coretax 전용 행 삽입.
  if (result.coretaxOnly.length > 0) {
    await admin.from('ppn_faktur_monthly').insert(result.coretaxOnly.map(c => ({
      customer_id: cid, tax_period: taxPeriod,
      faktur_type: c.fakturType, faktur_number: c.fakturNumber,
      dpp: 0, ppn: 0, coretax_dpp: c.coretaxDpp, coretax_ppn: c.coretaxPpn,
      recon_status: 'MISSING_CUSTOMER', recon_source: 'CORETAX',
      status: 'APPROVED', reconciled_at: now,
      counterparty_name: 'Coretax',
    })));
  }

  return NextResponse.json({ success: true, data: { summary: result.summary, coretaxOnly: result.coretaxOnly.length } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}
export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PPN_CORETAX_RECONCILE'))(request as RequestWithSession, handlePost);
}
