import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { listDatabases, openDatabase } from '@/lib/accounting/accurate-client';
import { resolveUserRole } from '@/lib/auth/resolve-role';

/**
 * GET  /api/accurate/connect?access_token=...
 *   → Lists available Accurate databases for the provided access_token
 *
 * POST /api/accurate/connect
 *   body: { customerId, accessToken, databaseId }
 *   → Opens the database, stores session+host in accurate_connection
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'CUSTOMER'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accessToken = new URL(request.url).searchParams.get('access_token');
    if (!accessToken) {
      return NextResponse.json({ error: 'access_token required' }, { status: 400 });
    }

    const databases = await listDatabases(accessToken);
    return NextResponse.json({ success: true, data: databases });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accurate list-db error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list databases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Only consultants can connect Accurate' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, accessToken, databaseId, databaseName } = body;

    if (!customerId || !accessToken || !databaseId) {
      return NextResponse.json({ error: 'customerId, accessToken, databaseId required' }, { status: 400 });
    }

    // Open database session
    const session = await openDatabase(accessToken, databaseId);

    // Store in DB (upsert)
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('accurate_connection')
      .upsert({
        customer_id: customerId,
        access_token: accessToken,
        session_key: session.session,
        host: session.host,
        database_id: String(databaseId),
        database_name: databaseName || null,
        is_active: true,
        last_error: null,
        sync_status: 'IDLE',
      }, { onConflict: 'customer_id' })
      .select()
      .single();

    if (error) {
      loggers.api.error({ err: error, customerId }, 'Accurate connect DB error');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    loggers.api.info({ customerId, host: session.host, databaseId }, 'Accurate connected');

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        host: data.host,
        database_name: data.database_name,
      },
      message: 'Accurate 연결이 완료되었습니다',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accurate connect error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Accurate' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accurate/connect?customerId=...
 * Disconnect Accurate for a customer
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const customerId = new URL(request.url).searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await admin.from('accurate_connection').delete().eq('customer_id', customerId);

    return NextResponse.json({ success: true, message: '연결이 해제되었습니다' });
  } catch (error) {
    loggers.api.error({ err: error }, 'Accurate disconnect error');
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
