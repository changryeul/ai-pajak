import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateBuktiPotongNumber } from '@/lib/tax/ebupot/pph23-bupot-service';

/**
 * e-Bupot PPh 23 API
 *
 * GET  ?customerId=xxx&period=2025-01 — List bukti potong for period
 * POST { customerId, period }         — Generate bukti potong numbers for all transactions in period
 */

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  const period = url.searchParams.get('period');

  if (!customerId || !period) {
    return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
  }

  const { data: transactions } = await getSupabaseAdmin()
    .from('pph23_transaction')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tax_period', period)
    .order('transaction_date');

  const withBupot = (transactions || []).filter(t => t.bukti_potong_number);
  const withoutBupot = (transactions || []).filter(t => !t.bukti_potong_number);

  return NextResponse.json({
    success: true,
    data: {
      period,
      totalTransactions: (transactions || []).length,
      generated: withBupot.length,
      pending: withoutBupot.length,
      transactions: transactions || [],
    },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { customerId, period } = body;

  if (!customerId || !period) {
    return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
  }

  // Get all transactions without bukti potong for the period
  const { data: transactions, error: fetchErr } = await getSupabaseAdmin()
    .from('pph23_transaction')
    .select('id, bukti_potong_number')
    .eq('customer_id', customerId)
    .eq('tax_period', period)
    .is('bukti_potong_number', null)
    .order('transaction_date');

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!transactions || transactions.length === 0) {
    return NextResponse.json({
      success: true,
      data: { generated: 0, message: 'No pending transactions to generate bukti potong' },
    });
  }

  // Find the current max sequence for this customer + period
  const { data: existing } = await getSupabaseAdmin()
    .from('pph23_transaction')
    .select('bukti_potong_number')
    .eq('customer_id', customerId)
    .eq('tax_period', period)
    .not('bukti_potong_number', 'is', null)
    .order('bukti_potong_number', { ascending: false })
    .limit(1);

  let startSeq = 1;
  if (existing && existing.length > 0) {
    const lastNum = existing[0].bukti_potong_number;
    const parts = lastNum.split('/');
    if (parts.length === 3) {
      startSeq = parseInt(parts[2], 10) + 1;
    }
  }

  // Generate bukti potong numbers and update transactions
  const today = new Date().toISOString().slice(0, 10);
  const updates: Array<{ id: string; number: string }> = [];

  for (let i = 0; i < transactions.length; i++) {
    const bpNumber = generateBuktiPotongNumber(period, startSeq + i);
    const { error: updateErr } = await getSupabaseAdmin()
      .from('pph23_transaction')
      .update({
        bukti_potong_number: bpNumber,
        bukti_potong_date: today,
      })
      .eq('id', transactions[i].id);

    if (!updateErr) {
      updates.push({ id: transactions[i].id, number: bpNumber });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      generated: updates.length,
      period,
      buktiPotongList: updates,
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession, handleGet
  );
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('EBUPOT_GENERATE'))(
    request as RequestWithSession, handlePost
  );
}
