import { RequestWithSession, AuditContext } from '@/types/auth';
import { loggers } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Fallback enum value used when the supplied `action` string is not part of
 * the `activity_type` Postgres enum. The original action is preserved in
 * `activity_details.scope` so the data is not lost.
 */
const FALLBACK_ACTIVITY_TYPE = 'TAX_CALCULATION';

/**
 * Insert one row into audit_log without throwing. Audit failure must NEVER
 * propagate to the request handler — losing the request because of an audit
 * problem is far worse than missing one audit row. Instead we log the
 * failure to pino and move on.
 *
 * Exported so non-middleware code (the new try/catch billing endpoints in
 * Phase B/K/D, which do not yet use composeMiddleware) can call it directly.
 */
export async function recordAudit(input: {
  action: string;
  actorUserId: string | null;
  actorRole?: string | null;
  customerId?: string | null;
  taxFilingId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const baseRow = {
      customer_id: input.customerId ?? null,
      tax_filing_id: input.taxFilingId ?? null,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      activity_details: { ...(input.details ?? {}), action: input.action },
    };

    // Try inserting with the supplied action as the activity_type enum
    // value first. If it is not in the enum, retry with FALLBACK_ACTIVITY_TYPE
    // and preserve the original action in activity_details.action (already set).
    const { error } = await admin
      .from('audit_log')
      .insert({ ...baseRow, activity_type: input.action });

    if (error) {
      const isEnumError =
        /invalid input value for enum/i.test(error.message) ||
        error.code === '22P02';
      if (isEnumError) {
        const { error: fallbackError } = await admin
          .from('audit_log')
          .insert({ ...baseRow, activity_type: FALLBACK_ACTIVITY_TYPE });
        if (fallbackError) {
          loggers.audit.warn(
            { err: fallbackError, action: input.action },
            'audit_log insert failed even with fallback activity_type',
          );
        }
        return;
      }
      loggers.audit.warn(
        { err: error, action: input.action },
        'audit_log insert failed',
      );
    }
  } catch (err) {
    loggers.audit.warn({ err, action: input.action }, 'audit_log insert threw');
  }
}

/**
 * Audit trail middleware.
 *
 * 1. Builds an `AuditContext` and attaches it to the request so handlers can
 *    enrich the audit log with extra fields after the fact.
 * 2. Persists a row to the `audit_log` table via {@link recordAudit}. The
 *    persistence is non-blocking — if the row cannot be written, the request
 *    still proceeds. The pino `loggers.audit` channel records both the entry
 *    and the completion of the request as a backup signal.
 *
 * HARD RULE #5: All tax operations must have an audit trail. Up to G3 this
 * middleware only emitted application logs and never wrote to the table —
 * the table was empty in production. This implementation closes that gap.
 *
 * @param action - Action being performed (e.g. `TAX_FILING_SUBMIT`,
 *                 `POA_SIGN`). Should match a value in the `activity_type`
 *                 enum where possible; unknown strings are inserted with
 *                 the fallback enum value plus the original action stored
 *                 in `activity_details.action`.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return composeMiddleware(
 *     requireAuth,
 *     blockPlatformAdmin,
 *     requireRole(UserRole.TAX_ADVISOR_JTC),
 *     withAudit('TAX_FILING_SUBMIT')  // ← persists to audit_log
 *   )(request, handler);
 * }
 */
export function withAudit(action: string) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      null;

    const userAgent = request.headers.get('user-agent') || null;

    const auditContext: AuditContext = {
      action,
      actorUserId: session.userId,
      actorOrganizationId: session.organizationId,
      actorRole: session.role,
      timestamp: new Date(),
      ipAddress: ipAddress ?? 'unknown',
      userAgent: userAgent ?? 'unknown',
    };

    request.audit = auditContext;

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

    // Persist the audit row BEFORE handler execution so that even if the
    // handler crashes mid-flight we still have the "intent" recorded. The
    // call is non-blocking on failure (`recordAudit` swallows errors).
    await recordAudit({
      action,
      actorUserId: session.userId,
      actorRole: session.role,
      details: {
        method: request.method,
        url: request.url,
      },
      ipAddress,
      userAgent,
    });

    const response = await handler(request);

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
