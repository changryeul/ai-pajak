# AI Pajak - Operations Manual
**Version**: 1.0
**Date**: 2025-12-23
**Status**: Production Ready

---

## 🔐 1. SYSTEM Account Credential Management

### 1.1 SYSTEM Account Policy

The `SYSTEM` role is used **EXCLUSIVELY** for automated billing operations and must follow strict credential management protocols.

#### **SYSTEM Account Restrictions**

```
✅ ALLOWED:
- Server-to-server API calls only
- Billing transaction creation
- Revenue split processing
- Payment webhook handling
- Scheduled billing tasks

❌ PROHIBITED:
- Human login
- Frontend access
- Customer data access
- Tax data access
- Interactive sessions
```

#### **Authentication Method**

```typescript
// ⚠️ NOTE: Auth 솔루션 TBD (AWS Cognito / Supabase Auth / Clerk)
// 아래 코드는 Auth 결정 후 업데이트 필요

// SYSTEM accounts use Service Role Key (NOT user login)
// File: src/lib/auth/system.ts

// Auth 클라이언트 초기화 (예시 - 실제 구현은 선택된 Auth 솔루션에 따라 다름)
import { initializeAdminAuth } from './auth-provider'; // TBD

// ✅ CORRECT: Service role key for SYSTEM operations
const authAdmin = initializeAdminAuth({
  serviceAccountKey: process.env.AUTH_SERVICE_ROLE_KEY!, // ← Service role key
  options: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ❌ WRONG: SYSTEM should NEVER use regular user auth
const authClient = createBrowserClient(...); // Never for SYSTEM
```

#### **Credential Storage**

```bash
# ⚠️ NOTE: Auth 솔루션 TBD (AWS Cognito / Supabase Auth / Clerk)
# 환경 변수명은 선택된 Auth 솔루션에 따라 변경됨

# Environment Variables (REQUIRED)
AUTH_SERVICE_ROLE_KEY=<service-role-key>  # Auth provider service key

# ✅ Storage Requirements:
# - Stored in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
# - Never committed to git
# - Encrypted at rest
# - Access logged and audited
# - Different keys per environment (dev/staging/prod)

# ❌ NEVER:
# - Store in .env.local (local dev only)
# - Commit to repository
# - Share via email/chat
# - Log in plain text
```

#### **Key Rotation Policy**

```
Rotation Schedule: Every 90 days
Process Owner: DevOps Team
Notification: 14 days before expiry

Steps:
1. Generate new service role key in Auth provider dashboard (Cognito/Supabase/Clerk)
2. Update key in AWS Secrets Manager
3. Deploy to all environments (staging → production)
4. Verify billing operations still work
5. Revoke old key
6. Document rotation in audit log
```

#### **Key Rotation Checklist**

- [ ] New key generated in Auth provider dashboard
- [ ] New key stored in AWS Secrets Manager
- [ ] Environment variables updated (staging)
- [ ] Billing operations tested (staging)
- [ ] Environment variables updated (production)
- [ ] Billing operations verified (production)
- [ ] Old key revoked
- [ ] Rotation documented in security log
- [ ] Next rotation date scheduled (90 days)

#### **SYSTEM Account Monitoring**

```typescript
// All SYSTEM operations must be logged
// File: src/lib/billing/system-operations.ts

async function systemBillingOperation(data: BillingData) {
  console.info('[SYSTEM]', {
    operation: 'BILLING_TRANSACTION_CREATE',
    timestamp: new Date().toISOString(),
    amount: data.amount,
    customerId: data.customerId, // Hashed in logs
    transactionId: data.transactionId,
  });

  // Perform operation
  const result = await createBillingTransaction(data);

  // Audit trail
  console.info('[SYSTEM] Completed', {
    operation: 'BILLING_TRANSACTION_CREATE',
    status: 'success',
    transactionId: result.id,
  });

  return result;
}
```

#### **Emergency Procedures**

**If SYSTEM key is compromised:**

1. **Immediate Actions** (within 1 hour)
   - [ ] Revoke compromised key in Auth provider dashboard (Cognito/Supabase/Clerk)
   - [ ] Generate new service role key
   - [ ] Update production secrets in AWS Secrets Manager
   - [ ] Deploy emergency update to production
   - [ ] Verify billing operations restored

2. **Investigation** (within 24 hours)
   - [ ] Review all SYSTEM operations in past 7 days
   - [ ] Check for unauthorized billing transactions
   - [ ] Audit all revenue splits created
   - [ ] Review access logs for anomalies
   - [ ] Document findings in security incident report

3. **Follow-up** (within 7 days)
   - [ ] Root cause analysis
   - [ ] Update security procedures
   - [ ] Conduct team security training
   - [ ] Review and update key rotation policy

---

## 📋 2. Power of Attorney (POA) Validation

### 2.1 POA Validation Placement

**POA validation is enforced at THREE levels:**

1. **Middleware Level** (API Gateway) - **RECOMMENDED PRIMARY CHECK**
2. **Handler Level** (Business Logic) - Secondary validation
3. **Database Level** (Trigger) - Final enforcement

#### **Level 1: Middleware (Recommended)**

```typescript
// File: src/middleware/requireValidPOA.ts

/**
 * Middleware: Require Valid Power of Attorney
 *
 * Validates that customer has active POA with tax partner
 * before allowing tax filing operations
 *
 * This is the PRIMARY POA check - executed before handler
 */
export function requireValidPOA() {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const body = await request.json();
    const { customerId, taxType } = body;

    // Get session
    const { session } = request;

    // Get consultant's tax partner
    const consultant = await getConsultant(session.userId);
    if (!consultant) {
      return NextResponse.json(
        { error: 'Consultant not found' },
        { status: 404 }
      );
    }

    // Check for active POA (using Prisma ORM)
    const poa = await prisma.powerOfAttorney.findFirst({
      where: {
        customer_id: customerId,
        tax_partner_id: consultant.tax_partner_id,
        status: 'ACTIVE',
        valid_to: { gte: new Date() },
        valid_from: { lte: new Date() }
      },
      select: { id: true, scope: true, valid_from: true, valid_to: true }
    });

    if (error || !poa) {
      console.warn('[POA] No active POA found', {
        customerId,
        taxPartnerId: consultant.tax_partner_id,
        taxType,
      });

      return NextResponse.json(
        {
          error: 'No active Power of Attorney',
          message:
            'Customer must authorize Jakarta Tax Consulting via Power of Attorney before tax filing.',
          action: 'CREATE_POA',
          requiredFields: {
            customerId,
            taxPartnerId: consultant.tax_partner_id,
            scope: taxType,
          },
        },
        { status: 400 }
      );
    }

    // Validate POA scope
    const validScopes = ['ALL_TAX_TYPES', `${taxType}_ONLY`, 'CUSTOM'];
    if (!validScopes.includes(poa.scope)) {
      return NextResponse.json(
        {
          error: 'POA scope mismatch',
          message: `Power of Attorney does not cover ${taxType}`,
          poaScope: poa.scope,
          requiredScope: taxType,
        },
        { status: 400 }
      );
    }

    // Attach POA to request
    request.poa = poa;

    // Continue to handler
    return handler(request);
  };
}
```

#### **Usage: Tax Filing Submission**

```typescript
// File: src/app/api/tax/file/route.ts

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_ADVISOR_JTC),
    requireValidPOA(),              // ← POA validation BEFORE handler
    withAudit('TAX_FILING_SUBMIT')
  )(request as RequestWithSession, async (req) => {
    // Handler implementation
    // POA already validated - guaranteed to exist
    const { poa } = req;

    // Update tax filing status (using Prisma ORM)
    const data = await prisma.taxFiling.update({
      where: { id: req.body.taxFilingId },
      data: {
        status: 'FILED',
        filed_at: new Date(),
        power_of_attorney_id: poa.id, // ← Use validated POA
      }
    });

    return NextResponse.json({ data });
  });
}
```

#### **Level 2: Handler (Secondary Validation)**

```typescript
// Inside handler - additional business logic validation
async function handler(req: RequestWithSession) {
  // Middleware already validated POA exists
  // Handler can add business-specific checks

  const { poa, body } = req;

  // Example: Check POA was signed recently
  const poaAge = Date.now() - new Date(poa.customer_signed_at).getTime();
  const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year

  if (poaAge > maxAge) {
    console.warn('[POA] POA older than 1 year', { poaId: poa.id, poaAge });
    // Warning but allow (business decision)
  }

  // Proceed with filing
  await fileTax(body);
}
```

#### **Level 3: Database (Final Enforcement)**

```sql
-- Database trigger (already implemented)
-- File: prisma/migrations/20251223000004_power_of_attorney.sql

CREATE TRIGGER validate_tax_filing_poa_trigger
BEFORE INSERT OR UPDATE ON tax_filing
FOR EACH ROW EXECUTE FUNCTION validate_tax_filing_poa();

-- This is the LAST line of defense
-- Prevents ANY tax filing without valid POA
-- Even if middleware/handler bypassed (should never happen)
```

### 2.2 POA Validation Decision Matrix

| Scenario | Middleware Check | Handler Check | DB Trigger |
|----------|------------------|---------------|------------|
| Normal filing | ✅ Primary | ✅ Business rules | ✅ Final safety |
| Bulk filing | ✅ Per filing | ✅ Batch validation | ✅ Per row |
| API bypass attempt | ❌ Skipped | ❌ Skipped | ✅ **BLOCKS** |
| Invalid POA scope | ✅ **BLOCKS** | N/A | ✅ Backup |
| Expired POA | ✅ **BLOCKS** | N/A | ✅ Backup |

**Recommendation**: Always use middleware `requireValidPOA()` as primary check.

---

## 👁️ 3. PLATFORM_ADMIN Data Access Policy

### 3.1 Access Principles

PLATFORM_ADMIN can access **metadata and analytics ONLY** - never raw customer tax data.

```
PLATFORM_ADMIN Access Model:
┌────────────────────────────────────────┐
│ ✅ ALLOWED                             │
├────────────────────────────────────────┤
│ - Anonymized user counts               │
│ - Aggregated revenue metrics           │
│ - System health dashboards             │
│ - Platform usage statistics            │
│ - Billing summaries (bucketed)         │
│ - Audit logs (read-only, hashed IDs)   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ❌ PROHIBITED                          │
├────────────────────────────────────────┤
│ - Customer tax filings                 │
│ - Tax documents                        │
│ - Customer PII (names, NPWP, etc.)     │
│ - Specific transaction amounts         │
│ - Power of Attorney documents          │
│ - Consultant-customer conversations    │
└────────────────────────────────────────┘
```

### 3.2 Data Masking Rules

#### **Customer Identifiers**

```typescript
// File: src/lib/admin/data-masking.ts

/**
 * Mask customer identifier for platform admin view
 */
export function maskCustomerId(customerId: string): string {
  // Show only first 8 chars of UUID
  return customerId.substring(0, 8) + '...';
}

/**
 * Hash customer NPWP for analytics
 */
export function hashNPWP(npwp: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(npwp + process.env.NPWP_SALT!);
  return hash.digest('hex').substring(0, 16);
}

// Example usage in admin dashboard
const customerList = customers.map(c => ({
  id: maskCustomerId(c.id),           // "a1b2c3d4..."
  npwpHash: hashNPWP(c.npwp),         // "e8f9a1b2c3d4e5f6"
  status: c.status,                   // "ACTIVE"
  createdAt: c.created_at,            // "2025-01-15"
}));
```

#### **Financial Amounts**

```typescript
/**
 * Bucket financial amounts for platform admin view
 */
export function bucketAmount(amount: number): string {
  if (amount < 1000000) return '< 1M';
  if (amount < 5000000) return '1M - 5M';
  if (amount < 10000000) return '5M - 10M';
  if (amount < 50000000) return '10M - 50M';
  return '> 50M';
}

// Example: Admin billing dashboard
const billingStats = transactions.map(t => ({
  id: maskCustomerId(t.customer_id),
  amountBucket: bucketAmount(t.amount_total), // "5M - 10M"
  status: t.payment_status,
  date: t.created_at.toISOString().split('T')[0],
}));
```

#### **Audit Logs**

```typescript
/**
 * Sanitize audit logs for platform admin view
 */
export function sanitizeAuditLog(log: AuditLog): SanitizedAuditLog {
  return {
    id: log.id,
    activityType: log.activity_type,           // "TAX_FILING_SUBMIT"
    actorRole: log.actor_role,                 // "TAX_ADVISOR_JTC"
    customerIdHash: hashCustomerId(log.customer_id), // Hashed
    timestamp: log.created_at,
    ipAddress: log.ip_address,                 // Keep for security
    // ❌ EXCLUDED:
    // - tax_filing_id (sensitive)
    // - activity_details (contains tax data)
    // - customer name/NPWP
  };
}
```

### 3.3 Platform Admin Dashboard Queries

```typescript
// File: src/app/api/admin/dashboard/route.ts

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN)
  )(request as RequestWithSession, async (req) => {
    // ✅ ALLOWED: Aggregated metrics (using Prisma raw query)
    const stats = await prisma.$queryRaw`SELECT * FROM get_platform_stats()`;
    // RPC function returns aggregated data only

    return NextResponse.json({
      totalCustomers: stats.total_customers,
      activeConsultants: stats.active_consultants,
      monthlyRevenue: bucketAmount(stats.monthly_revenue),
      taxFilingsThisMonth: stats.tax_filings_count,
      averageFilingTime: stats.avg_filing_time_hours,
    });
  });
}
```

```sql
-- Database function for platform admin dashboard
-- File: prisma/migrations/20251223000005_admin_functions.sql

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  total_customers BIGINT,
  active_consultants BIGINT,
  monthly_revenue NUMERIC,
  tax_filings_count BIGINT,
  avg_filing_time_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM customer WHERE created_at >= NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM consultant WHERE is_active = true),
    (SELECT COALESCE(SUM(amount_total), 0) FROM billing_transaction WHERE created_at >= NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM tax_filing WHERE created_at >= NOW() - INTERVAL '30 days'),
    (SELECT AVG(EXTRACT(EPOCH FROM (filed_at - created_at)) / 3600) FROM tax_filing WHERE filed_at IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to platform admins only
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;

-- RLS will ensure only PLATFORM_ADMIN can call this
```

### 3.4 Audit Log Access for Platform Admin

```typescript
// File: src/app/api/admin/audit-logs/route.ts

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN)
  )(request as RequestWithSession, async (req) => {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // RLS policies allow PLATFORM_ADMIN to read audit logs (using Prisma ORM)
    const logs = await prisma.taxActivityLog.findMany({
      select: { id: true, activity_type: true, actor_role: true, created_at: true, ip_address: true },
      orderBy: { created_at: 'desc' },
      take: limit
    });

    // Sanitize logs (remove customer identifiers)
    const sanitizedLogs = logs.map(log => ({
      id: log.id,
      activityType: log.activity_type,
      actorRole: log.actor_role,
      timestamp: log.created_at,
      ipAddress: log.ip_address,
      // ❌ customer_id, tax_filing_id, activity_details are excluded
    }));

    return NextResponse.json({ logs: sanitizedLogs });
  });
}
```

### 3.5 PLATFORM_ADMIN Access Monitoring

All PLATFORM_ADMIN data access must be logged:

```typescript
// Middleware: Log platform admin access
export function logPlatformAdminAccess(endpoint: string) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    if (session.role === UserRole.PLATFORM_ADMIN) {
      console.info('[PLATFORM_ADMIN_ACCESS]', {
        userId: session.userId,
        email: session.email,
        endpoint,
        timestamp: new Date().toISOString(),
        ipAddress: request.headers.get('x-forwarded-for'),
      });
    }

    return handler(request);
  };
}

// Usage
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN),
    logPlatformAdminAccess('/api/admin/dashboard')
  )(request, handler);
}
```

---

## 📊 4. Operational Metrics

### 4.1 Key Performance Indicators (KPIs)

**Security Metrics**:
- PLATFORM_ADMIN blocked access attempts (target: 0 per week)
- SYSTEM key rotation compliance (target: 100%)
- POA validation failure rate (target: < 5%)
- Audit log completeness (target: 100%)

**Performance Metrics**:
- Tax filing submission time (target: < 5 seconds)
- POA validation latency (target: < 500ms)
- API response time (target: < 2 seconds for 95th percentile)

### 4.2 Alerting Rules

```yaml
# Alerts configuration
alerts:
  - name: platform_admin_blocked_access
    condition: blockPlatformAdmin returns 403
    threshold: 1 per hour
    severity: WARNING
    action: Log to security team

  - name: system_key_expiry
    condition: SYSTEM key age > 80 days
    severity: CRITICAL
    action: Email DevOps team

  - name: poa_validation_failure_spike
    condition: POA validation failures > 10% of filings
    severity: WARNING
    action: Alert product team

  - name: audit_log_gap
    condition: No audit logs for tax_filing in 1 hour
    severity: CRITICAL
    action: Page on-call engineer
```

---

## 🔍 5. Compliance & Audit

### 5.1 Monthly Security Checklist

- [ ] Review all PLATFORM_ADMIN access logs
- [ ] Verify SYSTEM key rotation on schedule
- [ ] Audit POA validation error rates
- [ ] Check for any tax_activity_log deletions (should be 0)
- [ ] Review blocked access attempts
- [ ] Verify RLS policies still enforced
- [ ] Test middleware stack with security scenarios

### 5.2 Quarterly Compliance Review

- [ ] External security audit
- [ ] Review and update credential rotation policy
- [ ] Penetration testing
- [ ] Review data masking effectiveness
- [ ] Update disaster recovery procedures
- [ ] Staff security training
- [ ] Document any security incidents

---

## 📞 6. Emergency Contacts

| Incident Type | Contact | Response Time SLA |
|---------------|---------|-------------------|
| SYSTEM key compromised | DevOps on-call | 1 hour |
| Data breach suspected | Security team | 2 hours |
| RLS policy bypass | Engineering lead | 4 hours |
| POA validation failure | Product team | 1 business day |

---

**Version**: 1.0
**Last Updated**: 2025-12-23
**Next Review**: 2025-03-23
