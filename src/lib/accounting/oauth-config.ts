/**
 * OAuth configuration per provider.
 * Client ID/Secret come from Vercel environment variables.
 */
import type { AccountingProviderId } from './types';

export interface OAuthConfig {
  providerId: AccountingProviderId;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  defaultScope: string;
}

/**
 * Resolve OAuth config for a given provider at runtime.
 * Throws if required env vars are missing so the issue surfaces clearly.
 */
export function getOAuthConfig(provider: AccountingProviderId): OAuthConfig {
  if (provider === 'ACCURATE') {
    const clientId = process.env.ACCURATE_CLIENT_ID;
    const clientSecret = process.env.ACCURATE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('ACCURATE_CLIENT_ID / ACCURATE_CLIENT_SECRET env var not configured');
    }
    return {
      providerId: 'ACCURATE',
      authorizeUrl: 'https://account.accurate.id/oauth/authorize',
      tokenUrl: 'https://account.accurate.id/oauth/token',
      clientId,
      clientSecret,
      defaultScope: 'item_view sales_invoice_view purchase_invoice_view customer_view vendor_view',
    };
  }

  if (provider === 'MEKARI') {
    const clientId = process.env.MEKARI_CLIENT_ID;
    const clientSecret = process.env.MEKARI_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('MEKARI_CLIENT_ID / MEKARI_CLIENT_SECRET env var not configured');
    }
    return {
      providerId: 'MEKARI',
      authorizeUrl: 'https://api.mekari.com/oauth/authorize',
      tokenUrl: 'https://api.mekari.com/oauth/token',
      clientId,
      clientSecret,
      defaultScope: 'sales_invoice:read purchase_invoice:read contact:read',
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Compute the single redirect URI our callback handler lives at.
 * Must match the URI registered in the provider's OAuth app settings.
 */
export function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app';
  return `${appUrl}/api/accounting/callback`;
}

/**
 * Build the provider's authorize URL with our state and redirect.
 */
export function buildAuthorizeUrl(provider: AccountingProviderId, state: string): string {
  const cfg = getOAuthConfig(provider);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: getRedirectUri(),
    scope: cfg.defaultScope,
    state,
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an auth code for an access token.
 */
export async function exchangeCodeForToken(
  provider: AccountingProviderId,
  code: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const cfg = getOAuthConfig(provider);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}
