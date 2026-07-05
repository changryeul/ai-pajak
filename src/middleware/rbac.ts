import { NextResponse } from 'next/server';
import { RequestWithSession } from '@/types/auth';
import { UserRole } from '@/types/auth';

/**
 * Role-Based Access Control (RBAC) middleware
 *
 * Restricts endpoint access to specific user roles
 * Returns 403 if user role is not in the allowed list
 *
 * @param allowedRoles - Array of roles that can access this endpoint
 *
 * @example
 * // Only tax advisors can file tax
 * requireRole(UserRole.TAX_ADVISOR)
 *
 * @example
 * // Customers and consultants can view data
 * requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT, UserRole.TAX_ADVISOR)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this resource',
          requiredRoles: allowedRoles,
          currentRole: session.role,
        },
        { status: 403 }
      );
    }

    return handler(request);
  };
}
