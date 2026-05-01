import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

interface SessionData {
  annualRevenue?: number;
  cogs?: number;
  salary?: number;
  opex?: number;
  petty?: number;
  deprec?: number;
  pph22?: number;
  pph23?: number;
  pph24?: number;
  pph25?: number;
}

async function ensureOwnedSession(sessionId: string, customerId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('tax_closing_session')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!data || data.customer_id !== customerId) return null;
  return data;
}

async function handleGet(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('closing_id_billing')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  return NextResponse.json({ success: true, data: data ?? null });
}

/**
 * Issue (or reissue) the closing ID Billing for a session.
 *
 * Until DJP Coretax credentials are wired we generate a deterministic
 * placeholder code; once the env flag is set the same endpoint will call
 * the upstream API and persist the real code with source='CORETAX'.
 */
async function handlePost(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  // Recompute amount + KAP/KJS from session.data — never trust client.
  const data = (owned.data ?? {}) as SessionData;
  const sales = Number(data.annualRevenue ?? 0);
  let amount = 0;
  let kap = '411126';   // PPh Badan
  let kjs = '200';      // SPT Tahunan PPh Badan
  if (owned.closing_type === 'UMKM') {
    amount = Math.round(sales * 0.005);
    kap = '411128';     // PPh Final
    kjs = '420';        // PPh Final UMKM
  } else {
    const cogs = Number(data.cogs ?? 0);
    const salary = Number(data.salary ?? 0);
    const opex = Number(data.opex ?? 0);
    const petty = Number(data.petty ?? 0);
    const deprec = Number(data.deprec ?? 0);
    const accountingIncome = sales - cogs - salary - opex - petty - deprec;

    const sb2 = getSupabaseAdmin();
    const { data: adj } = await sb2
      .from('closing_adjustment_entry')
      .select('direction, amount')
      .eq('session_id', sessionId);
    const positiveSum = (adj ?? []).filter((e) => e.direction === 'POSITIVE').reduce((s, e) => s + Number(e.amount || 0), 0);
    const negativeSum = (adj ?? []).filter((e) => e.direction === 'NEGATIVE').reduce((s, e) => s + Number(e.amount || 0), 0);
    const pkp = Math.max(0, accountingIncome + positiveSum - negativeSum);

    const eligibleSme = sales > 0 && sales < 50_000_000_000;
    let pphBadan = 0;
    if (pkp > 0) {
      if (eligibleSme && sales > 0) {
        const share = Math.min(sales, 4_800_000_000) / sales;
        pphBadan = Math.round(pkp * share * 0.22 * 0.5 + pkp * (1 - share) * 0.22);
      } else {
        pphBadan = Math.round(pkp * 0.22);
      }
    }
    const credits =
      Number(data.pph22 ?? 0) + Number(data.pph23 ?? 0) +
      Number(data.pph24 ?? 0) + Number(data.pph25 ?? 0);
    amount = Math.max(0, pphBadan - credits); // PPh 29 (kurang bayar)
  }

  if (amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'No amount due — billing not required' },
      { status: 400 }
    );
  }

  // Placeholder Coretax-format code:
  //   AP25-<YYYY>-<sessionShort>-<8 digits derived from amount + ts>
  const ts = Date.now().toString().slice(-6);
  const sessionShort = sessionId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const billingCode = `AP25-${owned.fiscal_year}-${sessionShort}-${ts}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from('closing_id_billing')
    .upsert(
      {
        session_id: sessionId,
        billing_code: billingCode,
        amount,
        kap_code: kap,
        kjs_code: kjs,
        tax_period: String(owned.fiscal_year),
        billing_date: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'PENDING',
        source: 'PLACEHOLDER',
        raw_response: { issued_via: 'wizard', placeholder: true },
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single();
  if (error) {
    loggers.api.error({ err: error, sessionId }, 'closing id-billing upsert failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: row });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth)(request as RequestWithSession, (r) => handleGet(r, id));
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_ID_BILLING_ISSUE'))(
    request as RequestWithSession,
    (r) => handlePost(r, id)
  );
}
