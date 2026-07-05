import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { buildAuthorizeUrl } from '@/lib/accounting/oauth-config';
import { loggers } from '@/lib/logger';
import type { AccountingProviderId } from '@/lib/accounting';

/**
 * POST /api/accounting/authorize
 *   body: { customerId, provider, redirectAfter? }
 *
 * Generates a random OAuth state, stores it with customer/provider/user binding,
 * and returns the provider's authorize URL. The frontend should then redirect
 * the browser to that URL. When the user approves, the provider will call
 * /api/accounting/callback which verifies state + exchanges code for token.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT', 'TAX_ADVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Only consultants can connect' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, provider, redirectAfter } = body as {
      customerId?: string;
      provider?: AccountingProviderId;
      redirectAfter?: string;
    };

    if (!customerId || !provider) {
      return NextResponse.json({ error: 'customerId and provider required' }, { status: 400 });
    }

    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const admin = getSupabaseAdmin();
    const { error: insertError } = await admin.from('accounting_oauth_state').insert({
      state,
      user_id: user.id,
      customer_id: customerId,
      provider,
      redirect_after: redirectAfter || null,
      expires_at: expiresAt,
    });

    if (insertError) {
      loggers.api.error({ err: insertError }, 'Failed to store oauth state');
      return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
    }

    let authorizeUrl: string;
    try {
      authorizeUrl = buildAuthorizeUrl(provider, state);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'OAuth config missing' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, authorizeUrl });
  } catch (error) {
    loggers.api.error({ err: error }, 'OAuth authorize error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
