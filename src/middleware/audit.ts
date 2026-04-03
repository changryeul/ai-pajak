import { RequestWithSession, AuditContext } from '@/types/auth';
import { loggers } from '@/lib/logger';

/**
 * Audit trail middleware
 *
 * Attaches audit context to request for all tax-related operations
 * Logs security-relevant events for compliance and forensics
 *
 * This complements the database-level audit triggers
 * (Database triggers also create audit_log entries automatically)
 *
 * HARD RULE #5: All tax operations must have an audit trail
 *
 * @param action - Action being performed (e.g., 'TAX_FILING_SUBMIT', 'POA_SIGN')
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return composeMiddleware(
 *     requireAuth,
 *     blockPlatformAdmin,
 *     requireRole(UserRole.TAX_ADVISOR_JTC),
 *     withAudit('TAX_FILING_SUBMIT')  // ← Creates audit trail
 *   )(request, handler);
 * }
 */
export function withAudit(action: string) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    // Get client IP and user agent for audit trail
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Attach audit context to request
    const auditContext: AuditContext = {
      action,
      actorUserId: session.userId,
      actorOrganizationId: session.organizationId,
      actorRole: session.role,
      timestamp: new Date(),
      ipAddress,
      userAgent,
    };

    request.audit = auditContext;

    // Log audit event
    loggers.audit.info({
      action,
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      ipAddress,
      timestamp: auditContext.timestamp.toISOString(),
      url: request.url,
      method: request.method,
    }, `Audit: ${action}`);

    // Execute handler
    const response = await handler(request);

    // Log completion status
    loggers.audit.info({
      action,
      userId: session.userId,
      status: response.status,
    }, `Audit completed: ${action}`);

    return response;
  };
}

/**
 * Activity type constants for common audit actions
 */
export const AuditActions = {
  // Tax Filing
  TAX_FILING_CREATE: 'TAX_FILING_CREATE',
  TAX_FILING_UPDATE: 'TAX_FILING_UPDATE',
  TAX_FILING_SUBMIT: 'TAX_FILING_SUBMIT',
  TAX_FILING_DELETE: 'TAX_FILING_DELETE',
  TAX_FILING_VIEW: 'TAX_FILING_VIEW',

  // Tax Documents
  TAX_DOCUMENT_UPLOAD: 'TAX_DOCUMENT_UPLOAD',
  TAX_DOCUMENT_DOWNLOAD: 'TAX_DOCUMENT_DOWNLOAD',
  TAX_DOCUMENT_DELETE: 'TAX_DOCUMENT_DELETE',

  // Power of Attorney
  POA_CREATE: 'POA_CREATE',
  POA_SIGN_CUSTOMER: 'POA_SIGN_CUSTOMER',
  POA_SIGN_TAX_PARTNER: 'POA_SIGN_TAX_PARTNER',
  POA_ACTIVATE: 'POA_ACTIVATE',
  POA_REVOKE: 'POA_REVOKE',

  // Tax Calculation
  TAX_CALCULATE: 'TAX_CALCULATE',
  TAX_ESTIMATE: 'TAX_ESTIMATE',

  // Billing
  BILLING_CREATE: 'BILLING_CREATE',
  BILLING_UPDATE: 'BILLING_UPDATE',

  // User Management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];
