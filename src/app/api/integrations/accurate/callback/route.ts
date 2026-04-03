import { NextRequest, NextResponse } from 'next/server';
import { AccurateService } from '@/lib/accurate';
import { loggers } from '@/lib/logger';

/**
 * GET /api/integrations/accurate/callback
 * OAuth2 callback from Accurate Online
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?tab=integrations&error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/settings?tab=integrations&error=missing_params`
    );
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for token
    const token = await AccurateService.exchangeCode(code);

    // Get available databases
    const databases = await AccurateService.listDatabases(token.accessToken);

    // Redirect to settings with token info (stored temporarily in URL hash)
    const callbackData = encodeURIComponent(JSON.stringify({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      databases,
      customerId: stateData.customerId,
    }));

    return NextResponse.redirect(
      `${appUrl}/settings?tab=integrations&accurate_connected=true&data=${callbackData}`
    );
  } catch (err) {
    loggers.api.error({ err }, 'Accurate callback error');
    return NextResponse.redirect(
      `${appUrl}/settings?tab=integrations&error=auth_failed`
    );
  }
}
