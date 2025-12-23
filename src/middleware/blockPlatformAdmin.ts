import { NextResponse } from 'next/server';
import { RequestWithSession, UserRole } from '@/types/auth';

/**
 * CRITICAL SECURITY MIDDLEWARE
 *
 * Blocks PLATFORM_ADMIN from accessing tax data endpoints
 *
 * This is enforced at TWO levels:
 * 1. API level (this middleware)
 * 2. Database level (RLS policies)
 *
 * HARD RULE #1: PLATFORM_ADMIN can NEVER access customer tax data
 *
 * Use this middleware on ALL endpoints that handle:
 * - tax_filing
 * - tax_document
 * - power_of_attorney
 * - tax_activity_log (write operations)
 * - Any customer PII related to tax
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return composeMiddleware(
 *     requireAuth,
 *     blockPlatformAdmin,  // ← CRITICAL
 *     requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC)
 *   )(request, handler);
 * }
 */
export async function blockPlatformAdmin(
  request: RequestWithSession,
  handler: (req: RequestWithSession) => Promise<Response>
): Promise<Response> {
  const { session } = request;

  if (session.role === UserRole.PLATFORM_ADMIN) {
    // Security logging
    console.warn(
      '[SECURITY] PLATFORM_ADMIN attempted to access tax data',
      {
        userId: session.userId,
        email: session.email,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    );

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Platform administrators cannot access tax data',
        detail:
          'This endpoint contains sensitive customer tax information. ' +
          'Platform administrators do not have access to customer tax data. ' +
          'Only Jakarta Tax Consulting personnel can access tax data.',
      },
      { status: 403 }
    );
  }

  return handler(request);
}
