import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { getProvider, type AccountingProviderId, type ConnectionCredentials } from '@/lib/accounting';
import { ensureFreshToken } from '@/lib/accounting/token-refresh';
import { resolveUserRole } from '@/lib/auth/resolve-role';

/**
 * POST /api/accounting/sync
 *   body: { customerId, provider?, fromDate?, toDate?, types?: ['sales','purchase'] }
 *
 * GET /api/accounting/sync?customerId=...[&provider=...]
 *   → Returns connections + import counts
 */
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
    const {
      customerId,
      provider: providerId = 'ACCURATE',
      fromDate,
      toDate,
      types = ['sales', 'purchase'],
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: conn } = await admin
      .from('accounting_connection')
      .select('*')
      .eq('customer_id', customerId)
      .eq('provider', providerId)
      .eq('is_active', true)
      .single();

    if (!conn) {
      return NextResponse.json(
        { error: `${providerId}가 연결되어 있지 않습니다` },
        { status: 404 }
      );
    }

    await admin.from('accounting_connection')
      .update({ sync_status: 'SYNCING', last_error: null })
      .eq('id', conn.id);

    const provider = getProvider(providerId as AccountingProviderId);
    // Refresh token if expired
    const freshToken = await ensureFreshToken(conn);
    const creds: ConnectionCredentials = {
      accessToken: freshToken,
      sessionKey: conn.session_key,
      host: conn.host,
      databaseId: conn.database_id || undefined,
    };

    let salesImported = 0;
    let purchaseImported = 0;
    const errors: string[] = [];

    const upsertInvoice = async (inv: Awaited<ReturnType<typeof provider.listSalesInvoices>>['invoices'][number]) => {
      const { error } = await admin.from('accounting_invoice').upsert({
        customer_id: customerId,
        provider: providerId,
        external_id: inv.externalId,
        invoice_type: inv.invoiceType,
        invoice_number: inv.invoiceNumber,
        invoice_date: inv.invoiceDate,
        counterparty_name: inv.counterpartyName,
        counterparty_npwp: inv.counterpartyNpwp,
        subtotal: inv.subtotal,
        tax_amount: inv.taxAmount,
        total_amount: inv.totalAmount,
        currency: inv.currency,
        has_ppn: inv.hasPpn,
        has_pph: inv.hasPph,
        raw_data: inv.raw,
        status: 'IMPORTED',
      }, { onConflict: 'customer_id,provider,invoice_type,external_id' });
      return !error;
    };

    if (types.includes('sales')) {
      try {
        let page = 1, hasMore = true;
        while (hasMore) {
          const result = await provider.listSalesInvoices(creds, { page, pageSize: 100, fromDate, toDate });
          for (const inv of result.invoices) if (await upsertInvoice(inv)) salesImported++;
          hasMore = result.hasMore;
          page++;
          if (page > 50) break; // safety cap
        }
      } catch (err) {
        errors.push(`Sales: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (types.includes('purchase')) {
      try {
        let page = 1, hasMore = true;
        while (hasMore) {
          const result = await provider.listPurchaseInvoices(creds, { page, pageSize: 100, fromDate, toDate });
          for (const inv of result.invoices) if (await upsertInvoice(inv)) purchaseImported++;
          hasMore = result.hasMore;
          page++;
          if (page > 50) break;
        }
      } catch (err) {
        errors.push(`Purchase: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    await admin.from('accounting_connection')
      .update({
        sync_status: errors.length > 0 ? 'ERROR' : 'IDLE',
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', conn.id);

    loggers.api.info(
      { customerId, providerId, salesImported, purchaseImported },
      'Accounting sync completed'
    );

    return NextResponse.json({
      success: errors.length === 0,
      data: { salesImported, purchaseImported, errors },
      message: `${provider.displayName}: 매출 ${salesImported}건, 매입 ${purchaseImported}건 가져왔습니다${errors.length > 0 ? ` (오류 ${errors.length}건)` : ''}`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting sync error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

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

    let connQuery = admin
      .from('accounting_connection')
      .select('id, provider, host, database_name, sync_status, last_sync_at, last_error, is_active')
      .eq('customer_id', customerId);
    if (providerFilter) connQuery = connQuery.eq('provider', providerFilter);

    const { data: connections } = await connQuery;

    // Count invoices per provider
    const { data: invCounts } = await admin
      .from('accounting_invoice')
      .select('provider, invoice_type')
      .eq('customer_id', customerId);

    const counts: Record<string, { sales: number; purchase: number }> = {};
    for (const row of invCounts || []) {
      const key = row.provider;
      if (!counts[key]) counts[key] = { sales: 0, purchase: 0 };
      if (row.invoice_type === 'SALES') counts[key].sales++;
      else counts[key].purchase++;
    }

    return NextResponse.json({
      success: true,
      data: { connections: connections || [], counts },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting status error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
