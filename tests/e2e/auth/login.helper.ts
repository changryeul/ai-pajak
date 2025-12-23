import { APIRequestContext } from '@playwright/test';

/**
 * Authentication Helper for E2E Tests
 *
 * Handles login for different user roles and returns access tokens
 */

/**
 * Login as a regular user (CUSTOMER, CONSULTANT_JTC, TAX_ADVISOR_JTC, PLATFORM_ADMIN)
 *
 * @param request - Playwright APIRequestContext
 * @param email - User email
 * @param password - User password
 * @returns Access token for authenticated requests
 */
export async function loginAs(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      data: {
        email,
        password,
      },
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Login failed for ${email}: ${error}`);
  }

  const body = await response.json();
  return body.access_token;
}

/**
 * Get SYSTEM service role key
 *
 * SYSTEM account doesn't use username/password login
 * It uses service role key for authentication
 *
 * @returns Service role key
 */
export function getSystemServiceKey(): string {
  const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      'TEST_SUPABASE_SERVICE_ROLE_KEY environment variable not set'
    );
  }

  return serviceKey;
}

/**
 * Create authenticated API request headers
 *
 * @param token - Access token from loginAs() or service key
 * @returns Headers object for API requests
 */
export function createAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Logout user (invalidate session)
 *
 * @param request - Playwright APIRequestContext
 * @param token - Access token to invalidate
 */
export async function logout(
  request: APIRequestContext,
  token: string
): Promise<void> {
  await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    }
  );
}

/**
 * Wait for user session to be established
 *
 * Useful when testing after login to ensure session is ready
 *
 * @param request - Playwright APIRequestContext
 * @param token - Access token
 * @returns true if session is valid
 */
export async function waitForSession(
  request: APIRequestContext,
  token: string
): Promise<boolean> {
  const response = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    }
  );

  return response.ok();
}
