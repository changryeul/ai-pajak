import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/tax/counterparties?customerId=xxx&type=VENDOR
 * POST /api/tax/counterparties - Create/update counterparty
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  const type = url.searchParams.get('type');
  const { role, userId } = req.session;

  let cid = customerId;
  if (!cid && role === 'CUSTOMER') {
    const { data: c } = await getSupabaseAdmin().from('customer').select('id').eq('user_id', userId).single();
    cid = c?.id;
  }
  if (!cid) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  let query = getSupabaseAdmin().from('tax_counterparty').select('*').eq('customer_id', cid).order('name');
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const master = (data || []) as Array<Record<string, unknown>>;

  // 2026-08-30 — 원천세(PPh23)·부가세(PPN) 거래에서 입력된 상대방 회사도 리스트업.
  // master(tax_counterparty)에 없는 거래 상대방을 파생 항목으로 병합(dedup by NPWP/name).
  const key = (name?: string | null, npwp?: string | null) =>
    (npwp && npwp.trim() ? `n:${npwp.replace(/[.\-\s]/g, '')}` : `m:${(name || '').trim().toLowerCase()}`);
  const seen = new Set(master.map((c) => key(c.name as string, c.npwp as string)));
  const derived: Array<Record<string, unknown>> = [];

  const admin = getSupabaseAdmin();
  const addDerived = (name: string | null, npwp: string | null, address: string | null, source: string) => {
    if (!name && !npwp) return;
    const k = key(name, npwp);
    if (seen.has(k)) return;
    seen.add(k);
    derived.push({
      id: `derived-${source}-${k}`, customer_id: cid, name: name || npwp, npwp: npwp || null,
      address: address || null, type: 'VENDOR', is_related_party: false, derived: true, source,
    });
  };

  const { data: p23 } = await admin
    .from('pph23_transaction')
    .select('counterparty_name, counterparty_npwp, counterparty_address')
    .eq('customer_id', cid);
  for (const t of p23 || []) addDerived(t.counterparty_name, t.counterparty_npwp, t.counterparty_address, 'PPh23');

  const { data: ppn } = await admin
    .from('ppn_faktur_monthly')
    .select('counterparty_name, counterparty_npwp, counterparty_address')
    .eq('customer_id', cid);
  for (const f of ppn || []) addDerived(f.counterparty_name, f.counterparty_npwp, f.counterparty_address, 'PPN');

  const counterparties = [...master, ...derived.sort((a, b) => String(a.name).localeCompare(String(b.name)))];
  return NextResponse.json({ success: true, data: { counterparties } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, name, npwp, address, type = 'VENDOR', isRelatedParty = false, id } = body;

    if (!customerId || !name) return NextResponse.json({ error: 'customerId and name required' }, { status: 400 });

    if (id) {
      // Update
      const { error } = await getSupabaseAdmin().from('tax_counterparty')
        .update({ name, npwp, address, type, is_related_party: isRelatedParty })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: 'Updated' });
    }

    // Create
    const { data, error } = await getSupabaseAdmin().from('tax_counterparty')
      .insert({ customer_id: customerId, name, npwp, address, type, is_related_party: isRelatedParty })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
