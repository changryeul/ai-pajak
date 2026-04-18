import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { LOCALES, DEFAULT_LOCALE } from '@/config/constants';
import { withRateLimit } from '@/middleware/rate-limit';
import { getRequestId, REQUEST_ID_HEADER } from '@/middleware/request-id';
type OnboardingState = {
  customerType: 'INDIVIDUAL' | 'COMPANY' | null;
  onboardingStep: number | null;
};

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

/**
 * Security headers for all responses
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Only allow HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Content Security Policy (CSP) for XSS protection
  const isDev = process.env.NODE_ENV === 'development';
  const supabaseConnect = isDev
    ? 'http://localhost:54321 http://127.0.0.1:54321 https://*.supabase.co'
    : 'https://*.supabase.co';

  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://api.midtrans.com https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect} https://api.midtrans.com https://*.sentry.io https://www.googletagmanager.com https://www.google-analytics.com https://*.analytics.google.com https://www.google.com`,
    "frame-src 'self' https://app.midtrans.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  return response;
}

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/tax', '/documents', '/reports', '/settings', '/subscription'];

// Routes that should redirect to dashboard if already authenticated.
// NOTE: /register/terms and /register/mandate are part of the onboarding flow
// and require an authenticated session. The check below uses startsWith on the
// exact '/register' prefix, so we keep /register here and add an explicit
// exemption for the onboarding sub-routes.
const authRoutes = ['/login', '/register', '/forgot-password'];

// Onboarding sub-routes that an INDIVIDUAL customer uses AFTER signup.
// Accessible while authenticated; not blocked by the authRoutes redirect.
const onboardingRoutes = ['/register/terms', '/register/mandate'];

/**
 * Map onboarding_step to the URL the user should be on.
 *
 *   step 1 (account created)       → /register/terms   (agree to ToS next)
 *   step 2 (ToS agreed)            → /register/mandate (sign the mandate next)
 *   step 3 (mandate signed = done) → no redirect
 */
function expectedOnboardingPath(step: number, locale: string): string | null {
  if (step >= 3) return null;
  if (step <= 1) return `/${locale}/register/terms`;
  return `/${locale}/register/mandate`;
}

/**
 * Fetch customer_type + onboarding_step for the current user. Always hits
 * Postgres (~5-10ms) — module-level caching does not work across the
 * middleware ↔ API route boundary (they may run in different isolates on
 * Vercel, and even locally under Turbopack). If this becomes a hot path a
 * shared Redis/KV is the right next step; don't reintroduce per-process
 * Map caches.
 */
async function fetchOnboardingState(
  request: NextRequest,
  userId: string,
): Promise<OnboardingState | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {}, // middleware response handles writes elsewhere
        },
      },
    );

    const { data } = await supabase
      .from('customer')
      .select('customer_type, onboarding_step')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      customerType: (data?.customer_type as OnboardingState['customerType']) ?? null,
      onboardingStep: (data?.onboarding_step as number | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate or extract request ID for all requests
  const requestId = getRequestId(request);

  // Handle API routes with rate limiting and request ID
  if (pathname.startsWith('/api/')) {
    // Skip rate limiting for health check
    if (pathname === '/api/health') {
      const response = NextResponse.next();
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return addSecurityHeaders(response);
    }

    // Apply rate limiting to API routes
    const rateLimitResponse = await withRateLimit(request);
    if (rateLimitResponse) {
      rateLimitResponse.headers.set(REQUEST_ID_HEADER, requestId);
      return addSecurityHeaders(rateLimitResponse);
    }

    // Add request ID to response headers
    const response = NextResponse.next();
    response.headers.set(REQUEST_ID_HEADER, requestId);

    // Pass request ID to API handlers via request headers
    response.headers.set('x-middleware-request-id', requestId);

    // Add security headers for API responses
    // Override X-Frame-Options to DENY for API routes
    const securedResponse = addSecurityHeaders(response);
    securedResponse.headers.set('X-Frame-Options', 'DENY');

    return securedResponse;
  }

  // Apply i18n middleware for non-API routes
  const intlResponse = intlMiddleware(request);

  // Check if it's a protected or auth route
  const locale = pathname.split('/')[1];
  const pathWithoutLocale = pathname.replace(`/${locale}`, '');

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathWithoutLocale.startsWith(route)
  );
  const isOnboardingRoute = onboardingRoutes.some((route) =>
    pathWithoutLocale.startsWith(route)
  );
  // /register itself is an auth route that kicks logged-in users to /dashboard,
  // BUT its /register/terms and /register/mandate sub-routes are onboarding
  // steps the user should reach AFTER signing up.
  const isAuthRoute =
    !isOnboardingRoute &&
    authRoutes.some((route) => pathWithoutLocale.startsWith(route));

  // Update Supabase session
  const { supabaseResponse, user } = await updateSession(request);

  // Redirect logic
  if (isProtectedRoute && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // INDIVIDUAL onboarding enforcement:
  //   step < 3 means the user has not yet signed the mandate. Prevent access
  //   to protected routes until onboarding is complete, and funnel them to
  //   the expected step URL. COMPANY and existing customers (onboarding_step
  //   NULL) are unaffected.
  if (user && (isProtectedRoute || isOnboardingRoute)) {
    const state = await fetchOnboardingState(request, user.id);
    if (state?.customerType === 'INDIVIDUAL' && state.onboardingStep !== null) {
      const expected = expectedOnboardingPath(state.onboardingStep, locale);
      if (expected && !pathname.startsWith(expected)) {
        return NextResponse.redirect(new URL(expected, request.url));
      }
    }
  }

  // Merge cookies from supabase response to intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Add security headers to page responses
  return addSecurityHeaders(intlResponse);
}

export const config = {
  // Include API routes in the matcher for rate limiting
  matcher: [
    '/((?!_next|_vercel|.*\\..*).*)',
    '/api/:path*',
  ],
};
