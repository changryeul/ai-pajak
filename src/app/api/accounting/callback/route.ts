import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { exchangeCodeForToken } from '@/lib/accounting/oauth-config';
import { getProvider, type AccountingProviderId } from '@/lib/accounting';
import { getAppUrl } from '@/lib/app-url';

/**
 * GET /api/accounting/callback?code=...&state=...
 *
 * Provider-agnostic OAuth callback. Flow:
 *   1. Verify state exists in accounting_oauth_state and is not expired
 *   2. Exchange code for access_token via provider token endpoint
 *   3. For Accurate: automatically pick first database and call open-db.do
 *      For Mekari: no additional step needed
 *   4. Upsert into accounting_connection
 *   5. Delete the state row
 *   6. Redirect to /{locale}/settings/accurate?provider=...&connected=1
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const appUrl = getAppUrl();

  // Helper to build redirect with status
  const buildRedirect = (provider: string, status: 'success' | 'error', message?: string) => {
    const target = new URL(`${appUrl}/ko/settings/accurate`);
    target.searchParams.set('provider', provider);
    target.searchParams.set('oauth', status);
    if (message) target.searchParams.set('oauth_message', message);
    return NextResponse.redirect(target.toString());
  };

  try {
    if (errorParam) {
      return buildRedirect('ACCURATE', 'error', `Provider returned: ${errorParam}`);
    }

    if (!code || !state) {
      return buildRedirect('ACCURATE', 'error', 'Missing code or state');
    }

    const admin = getSupabaseAdmin();

    // Verify state
    const { data: stateRow, error: stateError } = await admin
      .from('accounting_oauth_state')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateRow) {
      loggers.api.warn({ state }, 'OAuth state not found');
      return buildRedirect('ACCURATE', 'error', 'Invalid or expired state');
    }

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await admin.from('accounting_oauth_state').delete().eq('state', state);
      return buildRedirect(stateRow.provider, 'error', 'State expired, please retry');
    }

    const providerId = stateRow.provider as AccountingProviderId;
    const customerId = stateRow.customer_id;

    // Exchange code for token
    let tokenData: { access_token: string; refresh_token?: string; expires_in?: number };
    try {
      tokenData = await exchangeCodeForToken(providerId, code);
    } catch (err) {
      loggers.api.error({ err, providerId }, 'Token exchange failed');
      await admin.from('accounting_oauth_state').delete().eq('state', state);
      return buildRedirect(providerId, 'error', 'Token exchange failed');
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // For Accurate we need to pick a database and open session
    const provider = getProvider(providerId);
    let sessionKey: string | null = null;
    let host: string | null = null;
    let databaseId: string | null = null;
    let databaseName: string | null = null;

    if (providerId === 'ACCURATE' && provider.listDatabases) {
      try {
        const dbs = await provider.listDatabases(accessToken);
        if (dbs.length === 0) {
          await admin.from('accounting_oauth_state').delete().eq('state', state);
          return buildRedirect(providerId, 'error', 'No Accurate databases found');
        }
        // Pick the first database automatically; user can change later
        const firstDb = dbs[0];
        const creds = await provider.openSession({ accessToken, databaseId: firstDb.id });
        sessionKey = creds.sessionKey || null;
        host = creds.host || null;
        databaseId = creds.databaseId || String(firstDb.id);
        databaseName = firstDb.name;
      } catch (err) {
        loggers.api.error({ err }, 'Accurate open-db failed');
        await admin.from('accounting_oauth_state').delete().eq('state', state);
        return buildRedirect(providerId, 'error', 'Failed to open Accurate database');
      }
    } else {
      // Mekari: session step not needed
      const creds = await provider.openSession({ accessToken });
      sessionKey = creds.sessionKey || providerId;
      host = creds.host || '';
    }

    // Upsert connection
    const { error: upsertError } = await admin.from('accounting_connection').upsert({
      customer_id: customerId,
      provider: providerId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expires_at: tokenExpiresAt,
      session_key: sessionKey || providerId,
      host: host || '',
      database_id: databaseId,
      database_name: databaseName,
      is_active: true,
      last_error: null,
      sync_status: 'IDLE',
    }, { onConflict: 'customer_id,provider' });

    if (upsertError) {
      loggers.api.error({ err: upsertError }, 'Failed to save connection');
      return buildRedirect(providerId, 'error', 'Failed to save connection');
    }

    // Clean up state
    await admin.from('accounting_oauth_state').delete().eq('state', state);

    loggers.api.info({ customerId, providerId }, 'OAuth callback success');
    return buildRedirect(providerId, 'success');
  } catch (error) {
    loggers.api.error({ err: error }, 'OAuth callback error');
    return buildRedirect('ACCURATE', 'error', 'Unexpected error');
  }
}
