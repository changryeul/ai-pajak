import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LOCALES, DEFAULT_LOCALE } from '@/config/constants';
import { withRateLimit } from '@/middleware/rate-limit';
import { getRequestId, REQUEST_ID_HEADER } from '@/middleware/request-id';

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://api.midtrans.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect} https://api.midtrans.com https://*.sentry.io`,
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

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register', '/forgot-password'];

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
  const isAuthRoute = authRoutes.some((route) =>
    pathWithoutLocale.startsWith(route)
  );

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
