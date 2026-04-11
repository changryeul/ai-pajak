/**
 * Individual SPT billing API — Phase D
 *
 * POST /api/billing/individual-spt
 *   body: { sptType: 'SPT_1770SS' | 'SPT_1770S' | 'SPT_1770', taxYear?: number }
 *   → Creates a billing_transaction row (PENDING) for the given SPT type +
 *     attempts to create a Midtrans Snap token. Returns transactionId always,
 *     and snapToken when Midtrans is configured.
 *
 * Caller must be authenticated and resolved to an INDIVIDUAL customer.
 * Unlike COMPANY plans (월 구독), individuals pay per filing using the
 * existing billing_transaction infrastructure (PAY-* webhook prefix).
 *
 * Midtrans degradation: if MIDTRANS_SERVER_KEY is missing or the Snap call
 * fails, the transaction is still created and the response includes
 * { snapToken: null, paymentUrl: null }. The user can then resume payment
 * via /api/payment/initiate (with the returned transactionId) once Midtrans
 * credentials become available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { MidtransService } from '@/lib/payment/midtrans';
import {
  INDIVIDUAL_SPT_PLANS,
  getIndividualSptPlan,
  sptPriceWithVat,
  type IndividualSptId,
} from '@/config/individual-pricing';

const VAT_RATE = 0.11;

/**
 * Resolve (or auto-create) an INDIVIDUAL customer record for the user.
 */
async function resolveOrCreateIndividualCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined,
  fullName: string | undefined,
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from('customer')
    .select('id, customer_type')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    if (existing.customer_type === 'COMPANY') {
      return null; // company customers must use /api/billing/corporate-plan
    }
    return { id: existing.id };
  }

  // Auto-create a minimal INDIVIDUAL customer
  const admin = getSupabaseAdmin();
  const { data: created, error } = await admin
    .from('customer')
    .insert({
      user_id: userId,
      customer_type: 'INDIVIDUAL',
      full_name: fullName || email?.split('@')[0] || 'Customer',
      email: email || null,
    })
    .select('id')
    .single();

  if (error || !created) {
    loggers.api.error({ err: error, userId }, 'Failed to auto-create individual customer');
    return null;
  }
  return { id: created.id };
}

/**
 * GET /api/billing/individual-spt
 *
 * Returns the catalog of individual SPT plans (1770SS / 1770S / 1770)
 * + any in-progress (PENDING) billing transactions for the current user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    loggers.api.info({ userId: user.id }, 'GET /api/billing/individual-spt');

    const admin = getSupabaseAdmin();
    const { data: customer } = await admin
      .from('customer')
      .select('id, customer_type')
      .eq('user_id', user.id)
      .maybeSingle();

    let pendingTransactions: unknown[] = [];
    if (customer && customer.customer_type !== 'COMPANY') {
      const { data } = await admin
        .from('billing_transaction')
        .select('id, invoice_number, service_type, description, amount_total, payment_status, created_at')
        .eq('customer_id', customer.id)
        .eq('payment_status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(10);
      pendingTransactions = data || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        plans: INDIVIDUAL_SPT_PLANS.map((p) => ({
          id: p.id,
          name: p.name,
          priceIdr: p.priceIdr,
          priceWithVat: sptPriceWithVat(p),
          description: p.description,
          features: p.features,
          recommendedFor: p.recommendedFor,
        })),
        pendingTransactions,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/billing/individual-spt error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/individual-spt
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sptType, taxYear } = body as { sptType: IndividualSptId; taxYear?: number };
    loggers.api.info({ userId: user.id, sptType, taxYear }, 'POST /api/billing/individual-spt');

    if (!sptType) {
      return NextResponse.json({ error: 'sptType is required' }, { status: 400 });
    }

    let plan;
    try {
      plan = getIndividualSptPlan(sptType);
    } catch {
      return NextResponse.json({ error: `Unknown sptType: ${sptType}` }, { status: 400 });
    }

    const customer = await resolveOrCreateIndividualCustomer(
      supabase,
      user.id,
      user.email,
      user.user_metadata?.full_name,
    );
    if (!customer) {
      return NextResponse.json(
        { error: '개인 고객만 SPT Pribadi 결제를 시작할 수 있습니다 (법인은 /api/billing/corporate-plan을 사용하세요)' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Look up JTC tax_partner — individual SPTs are filed by JTC by default
    const { data: jtcPartner } = await admin
      .from('tax_partner')
      .select('id')
      .eq('partner_type', 'JTC')
      .maybeSingle();

    if (!jtcPartner) {
      loggers.api.error({}, 'JTC tax_partner not found — DB seed missing?');
      return NextResponse.json(
        { error: 'System configuration: JTC tax_partner not found' },
        { status: 500 }
      );
    }

    // Look up platform_owner_id (billing_transaction requires it)
    const { data: platformOwner } = await admin
      .from('platform_owner')
      .select('id')
      .limit(1)
      .single();
    if (!platformOwner) {
      loggers.api.error({}, 'platform_owner not found — DB seed missing?');
      return NextResponse.json(
        { error: 'System configuration: platform_owner not found' },
        { status: 500 }
      );
    }

    const amountBase = plan.priceIdr;
    const amountTax = Math.round(amountBase * VAT_RATE);
    const amountTotal = amountBase + amountTax;
    const year = taxYear || new Date().getFullYear() - 1; // SPT for the prior tax year by default
    const invoiceNumber = `INV-IND-${year}-${Date.now()}`;
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Create billing_transaction row (PENDING)
    const { data: transaction, error: txErr } = await admin
      .from('billing_transaction')
      .insert({
        idempotency_key: `IND-SPT-${customer.id}-${plan.id}-${year}-${Date.now()}`,
        customer_id: customer.id,
        tax_partner_id: jtcPartner.id,
        platform_owner_id: platformOwner.id,
        transaction_type: 'TAX_SERVICE',
        service_type: 'TAX_FILING',
        description: `${plan.name} 신고 대행 (${year}년 귀속)`,
        amount_base: amountBase,
        amount_tax: amountTax,
        amount_total: amountTotal,
        platform_fee: 0,
        tax_service_fee: amountTotal,
        currency: 'IDR',
        invoice_number: invoiceNumber,
        payment_status: 'PENDING',
        billing_period: `${year}`,
        due_date: dueDate,
        metadata: {
          sptType: plan.id,
          taxYear: year,
          source: 'individual-spt-checkout',
        },
      })
      .select('id, invoice_number, amount_total')
      .single();

    if (txErr || !transaction) {
      loggers.api.error({ err: txErr, customerId: customer.id }, 'Failed to create individual SPT billing_transaction');
      return NextResponse.json(
        { error: txErr?.message || 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Try Midtrans Snap creation — degrade gracefully if credentials are missing.
    let snapToken: string | null = null;
    let paymentUrl: string | null = null;
    let snapError: string | null = null;

    try {
      const snap = await MidtransService.createSnapTransaction({
        orderId: `PAY-${transaction.id}-${Date.now()}`,
        grossAmount: amountTotal,
        customerDetails: {
          firstName: user.user_metadata?.full_name?.split(' ')[0] || 'Customer',
          email: user.email || 'noreply@example.com',
        },
        itemDetails: [
          {
            id: plan.id,
            name: `${plan.name} (${year})`,
            price: amountTotal,
            quantity: 1,
          },
        ],
      });
      snapToken = snap.token;
      paymentUrl = snap.redirect_url;
    } catch (payErr) {
      snapError = payErr instanceof Error ? payErr.message : 'Midtrans error';
      loggers.api.warn(
        { err: payErr, transactionId: transaction.id },
        'Midtrans Snap creation failed — transaction kept as PENDING for manual retry',
      );
      // intentional: do NOT cancel the transaction. The user can re-initiate
      // payment from /billing/pay/[id] later via /api/payment/initiate.
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.id,
        invoiceNumber: transaction.invoice_number,
        amountTotal: transaction.amount_total,
        snapToken,
        paymentUrl,
        // Surface the Midtrans gap to the UI so it can show a "결제 준비 중" notice.
        // null means the row exists and the user can retry payment later.
        snapError,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'POST /api/billing/individual-spt error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
