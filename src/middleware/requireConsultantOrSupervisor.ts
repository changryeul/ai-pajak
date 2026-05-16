/**
 * requireConsultantOrSupervisor middleware
 *
 * Used by Consultant ERP endpoints (`/api/consultant-erp/*`) to restrict
 * access to roles that can drive a session through its 5-step workflow:
 *   • CONSULTANT_JTC, TAX_ADVISOR_JTC — create sessions, upload, submit
 *   • TAX_OPERATOR_SUPERVISOR — approve/reject sessions for their tax_partner
 *
 * Other roles (CUSTOMER, TAX_OPERATOR, TAX_OPERATOR_LEAD, TAX_OPERATOR_MASTER,
 * PLATFORM_ADMIN, SYSTEM) are rejected with 403.
 *
 * Compose pattern (see middleware/compose.ts):
 *   composeMiddleware(
 *     requireAuth,
 *     blockPlatformAdmin,
 *     requireConsultantOrSupervisor,
 *     withAudit('CONSULTANT_ERP_*'),
 *   )(request, handler)
 */

import { NextResponse } from 'next/server';
import { UserRole, type RequestWithSession } from '@/types/auth';

const ALLOWED_ROLES = new Set<UserRole>([
  UserRole.CONSULTANT_JTC,
  UserRole.TAX_ADVISOR_JTC,
  UserRole.TAX_OPERATOR_SUPERVISOR,
]);

export async function requireConsultantOrSupervisor(
  req: RequestWithSession,
  next: (req: RequestWithSession) => Promise<Response>,
): Promise<Response> {
  const { session } = req;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json(
      {
        error: 'Consultant ERP is restricted to consultants and supervisors',
        role: session.role,
      },
      { status: 403 },
    );
  }
  return next(req);
}
