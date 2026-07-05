import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { getProvider, type AccountingProviderId } from '@/lib/accounting';
import { resolveUserRole } from '@/lib/auth/resolve-role';

/**
 * GET  /api/accounting/connect?provider=ACCURATE&access_token=...
 *   → List databases (Accurate only, Mekari returns [])
 *
 * POST /api/accounting/connect
 *   body: { customerId, provider, accessToken, databaseId?, databaseName? }
 *   → Open session (if needed) and save credentials
 *
 * DELETE /api/accounting/connect?customerId=...&provider=...
 *   → Disconnect
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT', 'TAX_ADVISOR', 'CUSTOMER'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const providerId = (params.get('provider') || 'ACCURATE') as AccountingProviderId;
    const accessToken = params.get('access_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'access_token required' }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const databases = provider.listDatabases ? await provider.listDatabases(accessToken) : [];

    return NextResponse.json({ success: true, data: databases, provider: providerId });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting list-db error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT', 'TAX_ADVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Only consultants can connect' }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      provider: providerId = 'ACCURATE',
      accessToken,
      databaseId,
      databaseName,
    } = body;

    if (!customerId || !accessToken) {
      return NextResponse.json({ error: 'customerId, accessToken required' }, { status: 400 });
    }

    const provider = getProvider(providerId as AccountingProviderId);
    const creds = await provider.openSession({ accessToken, databaseId });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('accounting_connection')
      .upsert({
        customer_id: customerId,
        provider: providerId,
        access_token: creds.accessToken,
        session_key: creds.sessionKey || providerId, // use provider id as placeholder for providers without session
        host: creds.host || '',
        database_id: creds.databaseId || null,
        database_name: databaseName || null,
        is_active: true,
        last_error: null,
        sync_status: 'IDLE',
      }, { onConflict: 'customer_id,provider' })
      .select()
      .single();

    if (error) {
      loggers.api.error({ err: error, customerId }, 'Accounting connect DB error');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    loggers.api.info({ customerId, provider: providerId }, 'Accounting connected');
    return NextResponse.json({
      success: true,
      data: { id: data.id, provider: providerId, database_name: data.database_name },
      message: `${provider.displayName} 연결이 완료되었습니다`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting connect error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT', 'TAX_ADVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const providerId = params.get('provider');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    let q = admin.from('accounting_connection').delete().eq('customer_id', customerId);
    if (providerId) q = q.eq('provider', providerId);
    await q;

    return NextResponse.json({ success: true, message: '연결이 해제되었습니다' });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accounting disconnect error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
