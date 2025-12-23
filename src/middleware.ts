import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LOCALES, DEFAULT_LOCALE } from '@/config/constants';

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/tax', '/documents', '/reports', '/settings', '/subscription'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply i18n middleware first
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

  // TODO: Enable auth check when Supabase is configured
  // For development, skip auth check
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    // Update Supabase session
    const { user } = await updateSession(request);

    // Redirect logic
    if (isProtectedRoute && !user) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
