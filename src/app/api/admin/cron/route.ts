import { NextRequest, NextResponse } from 'next/server';
import { platformAdminOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/admin/cron — List all cron settings
 */
async function handleGet(_req: RequestWithSession): Promise<Response> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('cron_settings')
      .select('*')
      .order('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    loggers.api.error({ err: error }, 'Cron settings fetch error');
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/cron — Toggle cron job enabled/disabled
 * Body: { id: string, is_enabled: boolean }
 */
async function handlePut(req: RequestWithSession): Promise<Response> {
  try {
    const { id, is_enabled } = await req.json();

    if (!id || typeof is_enabled !== 'boolean') {
      return NextResponse.json({ error: 'id and is_enabled required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('cron_settings')
      .update({ is_enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    loggers.api.info({ cronId: id, enabled: is_enabled, userId: req.session.userId }, 'Cron job toggled');

    return NextResponse.json({ success: true, data });
  } catch (error) {
    loggers.api.error({ err: error }, 'Cron toggle error');
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return platformAdminOperation()(request as RequestWithSession, handleGet);
}

export async function PUT(request: NextRequest) {
  return platformAdminOperation()(request as RequestWithSession, handlePut);
}
