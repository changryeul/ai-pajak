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

  return NextResponse.json({ success: true, data: { counterparties: data || [] } });
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
