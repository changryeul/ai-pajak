# Data Masking Policy for Platform Admin

**Version**: 1.0
**Date**: 2025-12-23
**Status**: ✅ Active

---

## Overview

This document defines the **data masking and anonymization standards** for PLATFORM_ADMIN access to AI Pajak platform data.

**HARD RULE #1**: PLATFORM_ADMIN cannot access raw customer tax data, customer PII, or individual filing details.

Platform administrators can only access:
- ✅ Aggregated metrics
- ✅ Anonymized data
- ✅ System health indicators
- ✅ Bucketed financial amounts

Platform administrators cannot access:
- ❌ Customer names, NPWP, addresses
- ❌ Tax filing details
- ❌ Individual transaction amounts
- ❌ Customer tax documents

---

## 1️⃣ Customer Identifiers

### UUID Masking

**Rule**: Show first 8 characters + "..."

**Function**: `maskCustomerId()`

```typescript
maskCustomerId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
// Returns: 'a1b2c3d4...'
```

**Rationale**:
- Provides partial identifier for debugging
- Cannot be reversed to full UUID
- Sufficient for correlation without exposing full ID

---

### NPWP Hashing

**Rule**: SHA-256 hash with salt (first 16 characters)

**Function**: `hashNPWP()`

```typescript
hashNPWP('1234567890123456')
// Returns: 'e8f9a1b2c3d4e5f6'  // Deterministic hash
```

**Rationale**:
- Same NPWP always produces same hash (for analytics)
- Cannot be reversed to actual NPWP
- 16 characters sufficient for uniqueness

**Security**:
- Salt stored in environment variable (`NPWP_SALT`)
- Different salt per environment (dev, staging, production)
- Salt rotated annually

---

### Email Masking

**Rule**: Show first 2 characters + "***@domain"

**Function**: `maskEmail()`

```typescript
maskEmail('john.doe@example.com')
// Returns: 'jo***@example.com'
```

**Rationale**:
- Domain visible (useful for debugging email deliverability)
- Local part masked to prevent identification
- First 2 chars provide hint without revealing identity

---

### Phone Number Masking

**Rule**: Show country code + "*******" + last 2 digits

**Function**: `maskPhoneNumber()`

```typescript
maskPhoneNumber('+628123456789')
// Returns: '+62*******89'
```

**Rationale**:
- Country code visible (useful for regional analytics)
- Middle digits completely hidden
- Last 2 digits provide hint for verification purposes

---

### Customer Name Masking

**Rule**: Show initials only

**Function**: `maskCustomerName()`

```typescript
maskCustomerName('John Doe')
// Returns: 'J. D.'

maskCustomerName('PT Sinar Jaya Abadi')
// Returns: 'P. S. J. A.'
```

**Rationale**:
- Completely anonymized
- Cannot identify individual
- Maintains record distinction

---

## 2️⃣ Financial Amounts

### Amount Bucketing

**Rule**: Group amounts into predefined ranges

**Function**: `bucketAmount()`

```typescript
bucketAmount(0)           // Returns: '0'
bucketAmount(750_000)     // Returns: '< 1M'
bucketAmount(3_500_000)   // Returns: '1M - 5M'
bucketAmount(8_000_000)   // Returns: '5M - 10M'
bucketAmount(25_000_000)  // Returns: '10M - 50M'
bucketAmount(75_000_000)  // Returns: '> 50M'
```

**Bucket Ranges**:

| Range | Bucket |
|-------|--------|
| 0 | `0` |
| 1 - 999,999 | `< 1M` |
| 1,000,000 - 4,999,999 | `1M - 5M` |
| 5,000,000 - 9,999,999 | `5M - 10M` |
| 10,000,000 - 49,999,999 | `10M - 50M` |
| ≥ 50,000,000 | `> 50M` |

**Rationale**:
- Prevents exact amount disclosure
- Provides sufficient granularity for business insights
- Aligned with common Indonesian business reporting ranges

---

### Percentage Metrics

**Rule**: Percentages are allowed (not exact amounts)

**Examples**:
```typescript
// ✅ ALLOWED
{
  paymentSuccessRate: 94.5,      // Percentage OK
  effectiveTaxRate: 15.2,        // Percentage OK
  growthRate: 12.5               // Percentage OK
}

// ❌ NOT ALLOWED
{
  totalRevenue: 150_000_000,     // Exact amount NOT OK
  averageTransaction: 1_500_000  // Exact amount NOT OK
}
```

**Rationale**:
- Percentages don't reveal exact amounts
- Useful for operational metrics
- Cannot be reversed to individual transactions

---

## 3️⃣ Time Periods

### Aggregation Periods

**Rule**: Aggregate by day, week, or month (NOT specific timestamps)

**Allowed Granularity**:

```typescript
// ✅ ALLOWED
{
  totalFilingsToday: 45,
  filingsThisWeek: 312,
  filingsThisMonth: 1_234,
  customersByMonth: {
    "2025-01": 150,
    "2025-02": 165,
    "2025-03": 178
  }
}

// ❌ NOT ALLOWED
{
  filings: [
    { filedAt: "2025-12-23T10:30:45Z", customerId: "...", amount: 1_500_000 },
    { filedAt: "2025-12-23T11:15:20Z", customerId: "...", amount: 2_300_000 }
  ]
}
```

**Rationale**:
- Prevents tracking individual customer activity
- Aggregated counts sufficient for business insights
- Specific timestamps reveal customer behavior

---

### Timestamp Anonymization

**Rule**: No specific timestamps for individual actions

**Example**:

```typescript
// ✅ ALLOWED - Aggregated
{
  filingsByHour: {
    "09:00-10:00": 12,
    "10:00-11:00": 15,
    "11:00-12:00": 18
  }
}

// ❌ NOT ALLOWED - Individual
{
  lastFilingTime: "2025-12-23T10:30:45Z",  // Specific timestamp
  customerLastSeen: "2025-12-23T11:15:20Z"  // Tracks individual
}
```

---

## 4️⃣ Aggregation Rules

### Allowed Aggregations

#### ✅ Counts

```typescript
{
  totalCustomers: 1500,
  activeCustomers: 1350,
  totalFilings: 3450,
  filingsThisMonth: 285
}
```

**Rationale**: Counts don't reveal individual customer data.

---

#### ✅ Averages

```typescript
{
  averageFilingsPerCustomer: 2.3,
  averageConsultantsPerPartner: 8.5,
  averageResponseTime: "4.2 hours"
}
```

**Rationale**: Averages don't expose individual values.

---

#### ✅ Distributions

```typescript
{
  filingsByType: {
    PPh21: 1500,
    PPh23: 800,
    PPN: 900,
    other: 250
  },
  customersByType: {
    individual: 1100,
    company: 400
  }
}
```

**Rationale**: Distributions show patterns without individual data.

---

### Prohibited Aggregations

#### ❌ Individual Records

```typescript
// NOT ALLOWED
{
  recentFilings: [
    { customerId: "uuid", filedAt: "...", amount: 1_500_000 },
    { customerId: "uuid", filedAt: "...", amount: 2_300_000 }
  ]
}
```

**Rationale**: Reveals individual customer activity.

---

#### ❌ Exact Amounts

```typescript
// NOT ALLOWED
{
  totalRevenue: 150_000_000,        // Exact total
  largestTransaction: 5_000_000,   // Specific amount
  topCustomerRevenue: 12_000_000   // Individual customer revenue
}
```

**Rationale**: Exact amounts are sensitive business data.

---

#### ❌ Top-N Lists

```typescript
// NOT ALLOWED
{
  topCustomers: [
    { customerId: "a1b2c3d4...", revenue: "10M - 50M" },  // Still identifies customers
    { customerId: "e5f6g7h8...", revenue: "10M - 50M" }
  ]
}
```

**Rationale**: Even with bucketed amounts, ranking identifies customers.

---

## 5️⃣ Audit Log Sanitization

### Allowed Fields

**Function**: `sanitizeAuditLog()`

```typescript
{
  id: "log-id",
  activityType: "TAX_FILING_SUBMIT",
  actorRole: "TAX_ADVISOR_JTC",
  customerIdHash: "e8f9a1b2c3d4e5f6",  // ← Hashed
  timestamp: "2025-12-23T10:30:00Z",
  ipAddress: "192.168.1.1"              // Keep for security analysis
}
```

---

### Excluded Fields

**Sensitive data removed from audit logs shown to platform admin**:

```typescript
// ❌ EXCLUDED
{
  customer_id: "uuid",              // Raw customer ID
  tax_filing_id: "uuid",            // Filing ID
  actor_user_id: "uuid",            // Consultant ID
  activity_details: {...},          // Contains tax data
  tax_type: "PPh21",                // Links to customer
  tax_period: "2025-01"             // Links to customer
}
```

**Rationale**:
- IP address kept for security incident investigation
- All customer-identifiable data removed
- Activity type and role sufficient for audit overview

---

## 6️⃣ Data Validation

### Validation Function

**Function**: `validateMaskedData()`

**Purpose**: Ensure no sensitive data leaked to platform admin

**Sensitive Fields Detected**:
```typescript
const sensitiveFields = [
  'npwp',
  'full_name',
  'company_name',
  'address',
  'phone',
  'tax_data'
];
```

**Usage**:
```typescript
const dashboardData = {
  totalCustomers: 1500,
  // ... other data
};

// Throws error if sensitive fields found
validateMaskedData(dashboardData);
```

**Error Example**:
```
Error: Sensitive field detected: customer.npwp
       Data must be masked before sending to platform admin.
```

---

## 7️⃣ Implementation Examples

### Dashboard API Response

```typescript
// Platform Admin Dashboard
GET /api/admin/dashboard

// ✅ CORRECT RESPONSE
{
  platformMetrics: {
    totalCustomers: 1500,           // Count OK
    activeCustomers: 1350,          // Count OK
    newCustomersThisMonth: 120      // Count OK
  },

  billingMetrics: {
    totalRevenue: "> 50M",          // ← BUCKETED
    monthlyRevenue: "10M - 50M",    // ← BUCKETED
    transactionCount: 3450,         // Count OK
    paymentSuccessRate: 94.5        // Percentage OK
  },

  warning: "All data is aggregated and anonymized. Customer PII and tax data are not accessible to platform administrators."
}
```

---

### Individual Customer Query

```typescript
// Platform Admin tries to query individual customer
GET /api/admin/customer/{customerId}

// ❌ BLOCKED BY MIDDLEWARE
{
  error: "Forbidden",
  message: "Platform administrators cannot access individual customer data",
  detail: "This endpoint contains sensitive customer information."
}
```

---

## 8️⃣ Compliance Checklist

### Before Exposing Data to Platform Admin

- [ ] ✅ Customer IDs masked (first 8 chars only)
- [ ] ✅ NPWP hashed (SHA-256)
- [ ] ✅ Email addresses masked
- [ ] ✅ Phone numbers masked
- [ ] ✅ Customer names masked (initials only)
- [ ] ✅ Financial amounts bucketed (no exact values)
- [ ] ✅ Timestamps aggregated (no specific times)
- [ ] ✅ Data validated with `validateMaskedData()`
- [ ] ✅ Access logged in audit trail
- [ ] ✅ Warning message included in response

---

## 9️⃣ Security Controls

### Environment Variables

```bash
# Different salt per environment
NPWP_SALT=random-salt-production-xxx
ID_HASH_SALT=random-salt-production-yyy
```

**Security Requirements**:
- ✅ Stored in secrets vault (AWS Secrets Manager / HashiCorp Vault)
- ✅ Different per environment (dev, staging, production)
- ✅ Rotated annually
- ✅ Never committed to git
- ✅ Access restricted to DevOps team

---

### Access Logging

All platform admin data access is logged:

```typescript
console.warn('[PLATFORM_ADMIN_ACCESS] Dashboard accessed', {
  userId: session.userId,
  email: session.email,
  timestamp: new Date().toISOString(),
  ipAddress: request.headers.get('x-forwarded-for'),
});
```

**Monitoring**:
- Alert if > 10 dashboard accesses per hour by single admin
- Weekly review of all platform admin access logs
- Monthly audit of masked data exposure

---

## 🔟 Enforcement

### Middleware Blocking

```typescript
// Tax data endpoints MUST use blockPlatformAdmin middleware
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,  // ← CRITICAL: Blocks platform admin
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC),
  )(request as RequestWithSession, handler);
}
```

---

### Database RLS Policies

```sql
-- Platform admin cannot query tax_filing table
CREATE POLICY "platform_admin_no_tax_filing_access"
ON tax_filing
FOR ALL
TO authenticated
USING (
  current_user_role() != 'PLATFORM_ADMIN'
);
```

---

### Response Validation

```typescript
// Before returning response to platform admin
validateMaskedData(response);

// Returns error if sensitive fields detected
// Error: Sensitive field detected: customer.npwp
```

---

## 1️⃣1️⃣ Violation Response

### If Sensitive Data Leaked

**Immediate Actions** (within 1 hour):
1. Revoke platform admin access
2. Identify affected data scope
3. Review access logs (past 30 days)
4. Notify security team

**Short-term Actions** (within 24 hours):
1. Root cause analysis
2. Code review of affected endpoints
3. Update validation rules
4. Deploy fixes

**Long-term Actions** (within 7 days):
1. Security audit of all platform admin endpoints
2. Update data masking policies
3. Team training on data privacy
4. Implement additional monitoring

---

## 1️⃣2️⃣ Testing Requirements

### Unit Tests

```typescript
describe('Data Masking', () => {
  test('maskCustomerId masks UUID correctly', () => {
    expect(maskCustomerId('a1b2c3d4-e5f6-7890-abcd-ef1234567890'))
      .toBe('a1b2c3d4...');
  });

  test('bucketAmount returns correct range', () => {
    expect(bucketAmount(3_500_000)).toBe('1M - 5M');
    expect(bucketAmount(75_000_000)).toBe('> 50M');
  });

  test('validateMaskedData throws on sensitive fields', () => {
    expect(() => validateMaskedData({ npwp: '1234567890123456' }))
      .toThrow('Sensitive field detected: npwp');
  });
});
```

---

### Integration Tests

```typescript
describe('Platform Admin Dashboard', () => {
  test('returns only aggregated data', async () => {
    const response = await GET('/api/admin/dashboard', {
      role: 'PLATFORM_ADMIN'
    });

    // Should pass validation
    expect(() => validateMaskedData(response.body)).not.toThrow();

    // Should have bucketed amounts
    expect(response.body.billingMetrics.totalRevenue).toMatch(/^(< 1M|1M - 5M|5M - 10M|10M - 50M|> 50M)$/);
  });

  test('blocks platform admin from tax filing endpoint', async () => {
    const response = await GET('/api/tax/file/{id}', {
      role: 'PLATFORM_ADMIN'
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });
});
```

---

## 1️⃣3️⃣ Documentation References

- [OPERATIONS_MANUAL.md](OPERATIONS_MANUAL.md) - Platform admin access policy
- [AUTH_RBAC_IMPLEMENTATION.md](AUTH_RBAC_IMPLEMENTATION.md) - Role-based access control
- [API_IMPLEMENTATION_SUMMARY.md](API_IMPLEMENTATION_SUMMARY.md) - Admin dashboard API

---

## 1️⃣4️⃣ Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-23 | Initial version with complete anonymization standards |

---

**Status**: ✅ Active and Enforced
**Next Review**: 2026-01-23 (Monthly review)
