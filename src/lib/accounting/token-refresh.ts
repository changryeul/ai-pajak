/**
 * OAuth Token Refresh for Accounting Providers
 *
 * Checks if access_token is about to expire (within 5 minutes)
 * and refreshes using refresh_token if available.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getOAuthConfig, getRedirectUri } from './oauth-config';
import type { AccountingProviderId } from './types';
import { loggers } from '@/lib/logger';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface ConnectionRow {
  id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  session_key: string;
  host: string;
}

/**
 * Check and refresh token if needed. Returns the (possibly refreshed) access_token.
 */
export async function ensureFreshToken(connection: ConnectionRow): Promise<string> {
  // If no expiry set or no refresh_token, return as-is
  if (!connection.token_expires_at || !connection.refresh_token) {
    return connection.access_token;
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();

  // Not expired yet (with buffer)
  if (expiresAt - now > REFRESH_BUFFER_MS) {
    return connection.access_token;
  }

  // Token is expired or about to expire — refresh
  loggers.api.info({ connectionId: connection.id, provider: connection.provider }, 'Refreshing OAuth token');

  try {
    const providerId = connection.provider as AccountingProviderId;
    const cfg = getOAuthConfig(providerId);

    // Accurate requires Basic Auth header for token operations
    const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    });

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      loggers.api.error({ status: res.status, body: text }, 'Token refresh failed');
      return connection.access_token; // Return old token, let it fail naturally
    }

    const data = await res.json();
    const newToken = data.access_token;
    const newRefresh = data.refresh_token || connection.refresh_token;
    const newExpiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    // Update DB
    const admin = getSupabaseAdmin();
    await admin.from('accounting_connection').update({
      access_token: newToken,
      refresh_token: newRefresh,
      token_expires_at: newExpiry,
    }).eq('id', connection.id);

    loggers.api.info({ connectionId: connection.id }, 'Token refreshed successfully');
    return newToken;
  } catch (error) {
    loggers.api.error({ err: error }, 'Token refresh error');
    return connection.access_token;
  }
}
