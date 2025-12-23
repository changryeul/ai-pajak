import { RequestWithSession } from '@/types/auth';

/**
 * Middleware type definition
 */
export type Middleware = (
  request: RequestWithSession,
  handler: (req: RequestWithSession) => Promise<Response>
) => Promise<Response>;

/**
 * Compose multiple middleware functions into a single middleware chain
 *
 * Middleware are executed left-to-right (top-to-bottom)
 * Each middleware can:
 * - Modify the request
 * - Return early (authentication/authorization failures)
 * - Pass to next middleware in chain
 *
 * @param middlewares - Middleware functions to compose
 * @returns Composed middleware function
 *
 * @example
 * // Complete protection stack for tax filing
 * export async function POST(request: NextRequest) {
 *   return composeMiddleware(
 *     requireAuth,                          // 1. Check authentication
 *     blockPlatformAdmin,                   // 2. Block platform admin
 *     requireRole(UserRole.TAX_ADVISOR_JTC),// 3. Require tax advisor role
 *     withAudit('TAX_FILING_SUBMIT')        // 4. Create audit trail
 *   )(request as RequestWithSession, async (req) => {
 *     // Handler implementation
 *     // RLS policies provide final database-level protection
 *   });
 * }
 */
export function composeMiddleware(...middlewares: Middleware[]) {
  return async (
    request: RequestWithSession,
    finalHandler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    // Build middleware chain from right to left
    // This allows middlewares to be executed left to right (top to bottom)
    const handler = middlewares.reduceRight(
      (next, middleware) => (req: RequestWithSession) => middleware(req, next),
      finalHandler
    );

    return handler(request);
  };
}

/**
 * Common middleware stacks for reuse
 */

import { requireAuth } from './auth';
import { blockPlatformAdmin } from './blockPlatformAdmin';
import { requireRole } from './rbac';
import { withAudit } from './audit';
import { requireValidPOA } from './requireValidPOA';
import { UserRole } from '@/types/auth';

/**
 * Tax data read endpoint (customers, consultants, tax advisors)
 */
export const taxDataRead = () =>
  composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)
  );

/**
 * Tax data write endpoint (consultants, tax advisors)
 */
export const taxDataWrite = (auditAction: string) =>
  composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
    withAudit(auditAction)
  );

/**
 * Tax filing submission (tax advisors only)
 * Includes POA validation
 */
export const taxFilingSubmit = (auditAction: string) =>
  composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_ADVISOR_JTC),
    requireValidPOA(),              // ← POA validation
    withAudit(auditAction)
  );

/**
 * Billing operations (system only)
 */
export const billingOperation = (auditAction: string) =>
  composeMiddleware(
    requireAuth,
    requireRole(UserRole.SYSTEM),
    withAudit(auditAction)
  );

/**
 * Platform admin operations (platform admin only)
 */
export const platformAdminOperation = () =>
  composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN)
  );

/**
 * Customer-only operations
 */
export const customerOperation = (auditAction?: string) => {
  const middlewares: Middleware[] = [
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  ];

  if (auditAction) {
    middlewares.push(withAudit(auditAction));
  }

  return composeMiddleware(...middlewares);
};
