import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role === 'PLATFORM_ADMIN';
}

/**
 * GET /api/admin/audit-logs?page=1&limit=50&activityType=TAX_FILING_SUBMIT&actorRole=TAX_ADVISOR_JTC
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !await checkAdmin(user.id)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const activityType = url.searchParams.get('activityType');
    const actorRole = url.searchParams.get('actorRole');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    let query = getSupabaseAdmin()
      .from('tax_activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (activityType) query = query.eq('activity_type', activityType);
    if (actorRole) query = query.eq('actor_role', actorRole);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data: logs, count, error } = await query;

    if (error) {
      console.error('Audit log query error:', error);
      return NextResponse.json({ success: true, data: { logs: [], stats: {}, pagination: { page, limit, total: 0 } } });
    }

    // Get actor emails for display
    const actorIds = [...new Set((logs || []).map(l => l.actor_user_id).filter(Boolean))];
    const { data: users } = await getSupabaseAdmin().auth.admin.listUsers({ perPage: 100 });
    const emailMap = new Map((users?.users || []).map(u => [u.id, u.email]));

    const enrichedLogs = (logs || []).map(log => ({
      ...log,
      actorEmail: emailMap.get(log.actor_user_id) || 'Unknown',
    }));

    // Stats
    const allActivityTypes = [...new Set((logs || []).map(l => l.activity_type))];
    const allRoles = [...new Set((logs || []).map(l => l.actor_role))];

    // Get total counts by type (from full table, not just page)
    const { data: typeCounts } = await getSupabaseAdmin()
      .from('tax_activity_log')
      .select('activity_type')
      .limit(1000);

    const typeStats: Record<string, number> = {};
    for (const t of typeCounts || []) {
      typeStats[t.activity_type] = (typeStats[t.activity_type] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: enrichedLogs,
        stats: { typeStats, totalLogs: count || 0 },
        filters: { activityTypes: allActivityTypes, roles: allRoles },
        pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
