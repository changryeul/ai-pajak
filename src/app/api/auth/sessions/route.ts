import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/auth/sessions — Get login history and active sessions
 *
 * Returns recent audit log entries for LOGIN_SUCCESS/LOGIN_FAILURE
 * for the current user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get recent login activity from audit_log. Schema uses:
    //   actor_user_id / activity_type / activity_details
    // Enum values come from migrations 20251223000018 + 20251223000022.
    // LOGOUT / PASSWORD_CHANGE / MFA_* are not in the activity_type enum,
    // so filtering on them would hard-fail the PostgREST query. Stick to
    // the two login events until a future migration adds the rest.
    const { data: loginLogs, error } = await admin
      .from('audit_log')
      .select('id, activity_type, ip_address, user_agent, created_at, activity_details')
      .eq('actor_user_id', user.id)
      .in('activity_type', ['LOGIN_SUCCESS', 'LOGIN_FAILURE'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      loggers.auth.error({ err: error }, 'Failed to fetch login history');
      return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Parse user agent for display
    const sessions = (loginLogs || []).map((log) => ({
      id: log.id,
      action: log.activity_type,
      ipAddress: log.ip_address,
      device: parseUserAgent(log.user_agent),
      userAgent: log.user_agent,
      timestamp: log.created_at,
      details: log.activity_details,
    }));

    return NextResponse.json({
      success: true,
      data: {
        loginHistory: sessions,
        currentEmail: user.email,
        lastSignIn: user.last_sign_in_at,
      },
    });
  } catch (error) {
    loggers.auth.error({ err: error }, 'Sessions API error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';

  // Simple UA parsing
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('Android')) return 'Android';
    return 'Mobile';
  }

  if (ua.includes('Chrome')) return 'Chrome (Desktop)';
  if (ua.includes('Firefox')) return 'Firefox (Desktop)';
  if (ua.includes('Safari')) return 'Safari (Desktop)';
  if (ua.includes('Edge')) return 'Edge (Desktop)';

  return 'Desktop';
}
