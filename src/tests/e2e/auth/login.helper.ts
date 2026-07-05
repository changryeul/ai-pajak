import { APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Also load from .playwright-env.json if available (written by global-setup)
try {
  const envPath = path.resolve(process.cwd(), '.playwright-env.json');
  if (fs.existsSync(envPath)) {
    const envData = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
    // Merge into process.env (don't override existing values)
    for (const [key, value] of Object.entries(envData)) {
      if (!process.env[key] && value) {
        process.env[key] = value as string;
      }
    }
  }
} catch {
  // Ignore errors
}

/**
 * Authentication Helper for E2E Tests
 *
 * Handles login for different user roles and returns access tokens
 */

// Token cache to avoid redundant logins
const tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

/**
 * Create a test user if they don't exist
 *
 * @param request - Playwright APIRequestContext
 * @param email - User email
 * @param password - User password
 * @returns true if user was created or already exists
 */
async function ensureUserExists(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<boolean> {
  // Try to sign up the user
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
    {
      data: {
        email,
        password,
        email_confirm: true, // Auto-confirm for testing
      },
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    }
  );

  // If signup succeeds or user already exists, return true
  if (response.ok()) {
    return true;
  }

  const body = await response.json();

  // If user already exists, that's fine
  if (body.error_code === 'user_already_exists' || body.msg?.includes('already registered')) {
    return true;
  }

  // For other errors, log and continue (will fail at login if there's a real problem)
  console.warn(`Signup warning for ${email}:`, body);
  return true;
}

/**
 * Login as a regular user (CUSTOMER, CONSULTANT, TAX_ADVISOR, PLATFORM_ADMIN)
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
  // Check cache first
  const cached = tokenCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // First, ensure the user exists
  await ensureUserExists(request, email, password);

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
      timeout: 30000, // 30 second timeout for login
    }
  );

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Login failed for ${email}: ${error}`);
  }

  const body = await response.json();
  const token = body.access_token;

  // Cache token for 50 minutes (tokens usually expire in 1 hour)
  tokenCache.set(email, {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });

  return token;
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
