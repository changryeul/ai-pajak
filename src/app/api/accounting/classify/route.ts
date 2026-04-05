import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { classifyInvoice, toTaxPeriod } from '@/lib/accounting/accurate-classifier';

/**
 * Provider-agnostic classify endpoint.
 * Reads from accounting_invoice table; classifier operates on normalized columns
 * so it works for any provider.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const providerFilter = params.get('provider');
    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    let q = admin
      .from('accounting_invoice')
      .select('*')
      .eq('customer_id', customerId)
      .order('invoice_date', { ascending: false })
      .limit(500);
    if (providerFilter) q = q.eq('provider', providerFilter);

    const { data: invoices } = await q;

    const withClassification = (invoices || []).map(inv => ({
      ...inv,
      classifications: classifyInvoice({
        invoice_type: inv.invoice_type,
        counterparty_name: inv.counterparty_name,
        counterparty_npwp: inv.counterparty_npwp,
        subtotal: Number(inv.subtotal || 0),
        tax_amount: Number(inv.tax_amount || 0),
        total_amount: Number(inv.total_amount || 0),
        has_ppn: !!inv.has_ppn,
      }),
    }));

    return NextResponse.json({ success: true, data: withClassification });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting classify GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, provider, invoiceIds, applyToCalculation = false } = body;

    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    let query = admin.from('accounting_invoice').select('*').eq('customer_id', customerId);
    if (provider) query = query.eq('provider', provider);
    if (invoiceIds && invoiceIds.length > 0) {
      query = query.in('id', invoiceIds);
    } else {
      query = query.eq('status', 'IMPORTED');
    }
    const { data: invoices } = await query;

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        data: { classified: 0, applied: 0 },
        message: '대상 인보이스가 없습니다',
      });
    }

    let classified = 0;
    let applied = 0;

    for (const inv of invoices) {
      const classifications = classifyInvoice({
        invoice_type: inv.invoice_type,
        counterparty_name: inv.counterparty_name,
        counterparty_npwp: inv.counterparty_npwp,
        subtotal: Number(inv.subtotal || 0),
        tax_amount: Number(inv.tax_amount || 0),
        total_amount: Number(inv.total_amount || 0),
        has_ppn: !!inv.has_ppn,
      });
      if (classifications.length === 0) continue;
      classified++;

      if (applyToCalculation) {
        for (const cls of classifications) {
          if (cls.tax_type === 'NONE') continue;
          const tcTaxType =
            cls.tax_type === 'PPN_OUTPUT' || cls.tax_type === 'PPN_INPUT' ? 'PPN' :
            cls.tax_type === 'PPh23' ? 'PPh23' :
            cls.tax_type === 'PPh4_FINAL' ? 'PPh_FINAL' : null;
          if (!tcTaxType) continue;

          const { data: calc, error } = await admin.from('tax_calculation').insert({
            customer_id: customerId,
            tax_type: tcTaxType,
            tax_period: toTaxPeriod(inv.invoice_date),
            source: 'CUSTOMER_OCR',
            calculation_result: {
              taxRate: cls.tax_rate,
              calculatedTax: cls.calculated_tax,
              taxBase: cls.tax_base,
              confidence: cls.confidence,
              warnings: cls.warnings,
              direction: cls.tax_type === 'PPN_INPUT' ? 'INPUT' : cls.tax_type === 'PPN_OUTPUT' ? 'OUTPUT' : undefined,
            },
            income_data: {
              recipient_name: inv.counterparty_name,
              recipient_npwp: inv.counterparty_npwp,
              invoice_number: inv.invoice_number,
              invoice_date: inv.invoice_date,
              accounting_invoice_id: inv.id,
            },
            invoice_classification: {
              source: inv.provider,
              type: cls.tax_type,
              externalId: inv.external_id,
            },
          }).select().single();

          if (!error && calc) {
            applied++;
            await admin.from('accounting_invoice')
              .update({ status: 'APPLIED', applied_to_calculation_id: calc.id })
              .eq('id', inv.id);
          }
        }
      } else {
        await admin.from('accounting_invoice').update({ status: 'CLASSIFIED' }).eq('id', inv.id);
      }
    }

    loggers.api.info({ customerId, classified, applied }, 'Accounting classify completed');
    return NextResponse.json({
      success: true,
      data: { classified, applied },
      message: applyToCalculation
        ? `${classified}건 분류 완료, ${applied}건이 세금 계산에 적용되었습니다`
        : `${classified}건이 분류되었습니다`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting classify POST error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
