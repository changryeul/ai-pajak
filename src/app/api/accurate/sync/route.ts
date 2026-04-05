import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { listSalesInvoices, listPurchaseInvoices, type AccurateSession } from '@/lib/accounting/accurate-client';
import { resolveUserRole } from '@/lib/auth/resolve-role';

/**
 * POST /api/accurate/sync
 *   body: { customerId, fromDate?, toDate?, types?: ['sales','purchase'] }
 *
 * Imports invoices from Accurate into accurate_invoice table.
 * Performs upsert on (customer_id, invoice_type, accurate_id).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Only consultants can sync' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, fromDate, toDate, types = ['sales', 'purchase'] } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Load connection
    const { data: conn } = await admin
      .from('accurate_connection')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .single();

    if (!conn) {
      return NextResponse.json({ error: 'Accurate가 연결되어 있지 않습니다' }, { status: 404 });
    }

    // Mark as syncing
    await admin
      .from('accurate_connection')
      .update({ sync_status: 'SYNCING', last_error: null })
      .eq('id', conn.id);

    const session: AccurateSession = { session: conn.session_key, host: conn.host };
    const accessToken = conn.access_token;

    let salesImported = 0;
    let purchaseImported = 0;
    const errors: string[] = [];

    // ── Sales Invoices ──
    if (types.includes('sales')) {
      try {
        let page = 1;
        let pageCount = 1;
        while (page <= pageCount) {
          const { invoices, pageCount: pc } = await listSalesInvoices(session, accessToken, {
            page, pageSize: 100, fromDate, toDate,
          });
          pageCount = pc;

          for (const inv of invoices) {
            const subtotal = Number(inv.totalAmount || 0) - Number(inv.taxAmount1 || 0);
            const { error } = await admin.from('accurate_invoice').upsert({
              customer_id: customerId,
              accurate_id: inv.id,
              invoice_type: 'SALES',
              invoice_number: inv.number,
              invoice_date: inv.transDate?.substring(0, 10),
              counterparty_name: inv.customerName || null,
              counterparty_npwp: inv.customerNpwp || null,
              subtotal,
              tax_amount: Number(inv.taxAmount1 || 0),
              total_amount: Number(inv.totalAmount || 0),
              currency: inv.currency || 'IDR',
              has_ppn: Number(inv.taxAmount1 || 0) > 0,
              has_pph: Number(inv.taxAmount2 || 0) > 0,
              raw_data: inv as unknown as Record<string, unknown>,
              status: 'IMPORTED',
            }, { onConflict: 'customer_id,invoice_type,accurate_id' });

            if (!error) salesImported++;
          }
          page++;
        }
      } catch (err) {
        errors.push(`Sales: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // ── Purchase Invoices ──
    if (types.includes('purchase')) {
      try {
        let page = 1;
        let pageCount = 1;
        while (page <= pageCount) {
          const { invoices, pageCount: pc } = await listPurchaseInvoices(session, accessToken, {
            page, pageSize: 100, fromDate, toDate,
          });
          pageCount = pc;

          for (const inv of invoices) {
            const subtotal = Number(inv.totalAmount || 0) - Number(inv.taxAmount1 || 0);
            const { error } = await admin.from('accurate_invoice').upsert({
              customer_id: customerId,
              accurate_id: inv.id,
              invoice_type: 'PURCHASE',
              invoice_number: inv.number,
              invoice_date: inv.transDate?.substring(0, 10),
              counterparty_name: inv.vendorName || null,
              counterparty_npwp: inv.vendorNpwp || null,
              subtotal,
              tax_amount: Number(inv.taxAmount1 || 0),
              total_amount: Number(inv.totalAmount || 0),
              currency: inv.currency || 'IDR',
              has_ppn: Number(inv.taxAmount1 || 0) > 0,
              has_pph: Number(inv.taxAmount2 || 0) > 0,
              raw_data: inv as unknown as Record<string, unknown>,
              status: 'IMPORTED',
            }, { onConflict: 'customer_id,invoice_type,accurate_id' });

            if (!error) purchaseImported++;
          }
          page++;
        }
      } catch (err) {
        errors.push(`Purchase: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // Update sync status
    await admin
      .from('accurate_connection')
      .update({
        sync_status: errors.length > 0 ? 'ERROR' : 'IDLE',
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', conn.id);

    loggers.api.info(
      { customerId, salesImported, purchaseImported, errors: errors.length },
      'Accurate sync completed'
    );

    return NextResponse.json({
      success: errors.length === 0,
      data: { salesImported, purchaseImported, errors },
      message: `매출 ${salesImported}건, 매입 ${purchaseImported}건 가져왔습니다${errors.length > 0 ? ` (오류 ${errors.length}건)` : ''}`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accurate sync error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accurate/sync?customerId=...
 * Returns sync status + recent imported invoices summary
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = new URL(request.url).searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: conn } = await admin
      .from('accurate_connection')
      .select('host, database_name, sync_status, last_sync_at, last_error, is_active')
      .eq('customer_id', customerId)
      .maybeSingle();

    const { count: salesCount } = await admin
      .from('accurate_invoice')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('invoice_type', 'SALES');

    const { count: purchaseCount } = await admin
      .from('accurate_invoice')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('invoice_type', 'PURCHASE');

    return NextResponse.json({
      success: true,
      data: {
        connection: conn,
        counts: { sales: salesCount || 0, purchase: purchaseCount || 0 },
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accurate status error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
