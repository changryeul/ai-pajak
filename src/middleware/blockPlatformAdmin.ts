import { NextResponse } from 'next/server';
import { RequestWithSession, UserRole } from '@/types/auth';
import { loggers } from '@/lib/logger';

/**
 * CRITICAL SECURITY MIDDLEWARE
 *
 * Blocks MonoFlip platform roles (PLATFORM_ADMIN + PLATFORM_MASTER) from
 * accessing tax data endpoints.
 *
 * P6.1 (2026-07-07): PLATFORM_MASTER 추가. MonoFlip 사업 최고권한도 세무
 * 실무 데이터 접근 불가 — 세무신고 대행 자격 없음.
 *
 * This is enforced at TWO levels:
 * 1. API level (this middleware)
 * 2. Database level (RLS policies)
 *
 * HARD RULE #1 + #6: MonoFlip 사이드 role (ADMIN/MASTER) can NEVER access
 * customer tax data or perform tax filing actions.
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
 *     requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT)
 *   )(request, handler);
 * }
 */
const MONOFLIP_ROLES: UserRole[] = [UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_MASTER];

export async function blockPlatformAdmin(
  request: RequestWithSession,
  handler: (req: RequestWithSession) => Promise<Response>
): Promise<Response> {
  const { session } = request;

  if (MONOFLIP_ROLES.includes(session.role)) {
    // Security logging
    loggers.api.warn({
      userId: session.userId,
      email: session.email,
      role: session.role,
      url: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }, 'SECURITY: MonoFlip role attempted to access tax data');

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'MonoFlip platform roles cannot access tax data',
        detail:
          'This endpoint contains sensitive customer tax information. ' +
          'MonoFlip platform administrators and business masters do not have ' +
          'access to customer tax data. Only JTC (Jakarta Tax Consulting) ' +
          'personnel or the customer themselves can access tax data.',
      },
      { status: 403 }
    );
  }

  return handler(request);
}
