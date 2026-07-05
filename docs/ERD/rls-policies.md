# Row Level Security (RLS) Policies

> Last Updated: 2026-02-12

---

## Overview

AI Pajak uses Supabase Row Level Security (RLS) to enforce data access control at the database level. This provides an additional layer of security beyond API middleware.

---

## Tables with RLS

### Core Tables (14)

| Table | RLS | Migration |
|-------|-----|-----------|
| `platform_owner` | Enabled | 20251223000002 |
| `platform` | Enabled | 20251223000002 |
| `tax_partner` | Enabled | 20251223000002 |
| `user_roles` | Enabled | 20251223000002 |
| `consultant` | Enabled | 20251223000002 |
| `tax_advisor` | Enabled | 20251223000002 |
| `customer` | Enabled | 20251223000002 |
| `tax_filing` | Enabled | 20251223000002 |
| `tax_document` | Enabled | 20251223000002 |
| `tax_activity_log` | Enabled | 20251223000002 |
| `billing_transaction` | Enabled | 20251223000002 |
| `revenue_split` | Enabled | 20251223000002 |
| `subscription` | Enabled | 20251223000002 |
| `consultation_message` | Enabled | 20251223000002 |

### Extended Tables (10)

| Table | RLS | Migration |
|-------|-----|-----------|
| `document` | Enabled | 20251223000019 |
| `notification` | Enabled | 20251223000024 |
| `notification_preferences` | Enabled | 20251223000024 |
| `audit_log` | Enabled | 20251223000018 |
| `power_of_attorney` | Enabled | 20251223000004 |
| `customer_consultant` | Enabled | 20251223000010 |
| `tax_calculation` | Enabled | 20251223000017 |
| `tax_law_analyses` | Enabled | 20251223000008 |
| `tax_law_applications` | Enabled | 20251223000008 |
| `dynamic_tax_rates` | Enabled | 20251223000008 |

### Reference Tables (2)

| Table | RLS | Migration |
|-------|-----|-----------|
| `klu_codes` | Enabled | 20251223000026 |
| `luxury_item_classifications` | Enabled | 20251223000026 |

---

## Helper Functions

```sql
-- Get current user's role
get_user_role() RETURNS user_role_type

-- Check if user is a customer
is_customer() RETURNS BOOLEAN

-- Check if user is a JTC consultant
is_jtc_consultant() RETURNS BOOLEAN

-- Check if user is a platform admin
is_platform_admin() RETURNS BOOLEAN

-- Get customer ID for current user
get_customer_id() RETURNS UUID

-- Get consultant ID for current user
get_consultant_id() RETURNS UUID
```

---

## 5 Hard Rules Enforcement

### Rule #1: PLATFORM_ADMIN Cannot Access Customer Tax Data

**Tables Protected:**
- `tax_filing`
- `tax_document`
- `tax_activity_log`
- `document`
- `tax_calculation`

**Policy Example:**
```sql
CREATE POLICY "Block platform admins from tax filing"
ON tax_filing FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
```

### Rule #2: Consultant Must Belong to Jakarta Tax Consulting

**Enforcement:**
- Foreign key constraint: `consultant.tax_partner_id → tax_partner`
- INSERT policy checks consultant belongs to JTC

**Policy Example:**
```sql
CREATE POLICY "Only JTC consultants can be assigned"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
  consultant_id IN (
    SELECT c.id FROM consultant c
    JOIN tax_partner tp ON c.tax_partner_id = tp.id
    WHERE tp.name = 'Jakarta Tax Consulting'
    AND c.is_active = true
  )
);
```

### Rule #3: Tax Filing Actor ≠ Platform

**Enforcement:**
- Consultant ID foreign key (links to JTC only)
- Audit log policy prevents platform organization_id as actor

**Policy Example:**
```sql
CREATE POLICY "Prevent platform as tax actor"
ON tax_activity_log FOR INSERT
TO authenticated
WITH CHECK (
  actor_organization_id IS NULL OR
  actor_organization_id NOT IN (SELECT id FROM platform)
);
```

### Rule #4: Billing Collector ≠ Service Provider

**Enforcement:**
- Separate FKs: `platform_owner_id` vs `tax_partner_id`
- INSERT policy prevents `platform_owner_id = tax_partner_id`
- `revenue_split` table separates accounting

**Policy Example:**
```sql
CREATE POLICY "Enforce collector not provider"
ON billing_transaction FOR INSERT
TO authenticated
WITH CHECK (
  platform_owner_id != tax_partner_id OR
  tax_partner_id IS NULL
);
```

### Rule #5: Audit Trail Required

**Enforcement:**
- Automatic triggers on `tax_filing` table
- No DELETE policy on `tax_activity_log` (permanent record)
- Only SECURITY DEFINER functions can insert logs

---

## Role-Based Access Matrix

### Customer Data Access

| Role | Own Data | Assigned Customer | All Customers |
|------|----------|-------------------|---------------|
| CUSTOMER | Yes | - | No |
| CONSULTANT | - | Yes | No |
| TAX_ADVISOR | - | Yes | No |
| PLATFORM_ADMIN | **No** | **No** | **No** |
| SYSTEM | - | - | Yes* |

*SYSTEM access for billing and automated operations only.

### Tax Filing Access

| Role | View | Create | Update | File to DJP |
|------|------|--------|--------|-------------|
| CUSTOMER | Own | Draft | Draft only | No |
| CONSULTANT | Assigned | Yes | Yes | No |
| TAX_ADVISOR | Assigned | Yes | Yes | Yes |
| PLATFORM_ADMIN | **No** | **No** | **No** | **No** |

### Audit Log Access

| Role | View | Create | Delete |
|------|------|--------|--------|
| CUSTOMER | Own | No | No |
| CONSULTANT | Assigned | No | No |
| TAX_ADVISOR | Assigned | No | No |
| PLATFORM_ADMIN | **No** | No | No |
| SYSTEM | - | Yes | No |

---

## Migration Files

| Migration | Purpose |
|-----------|---------|
| `20251223000002_rls_policies.sql` | Core RLS policies |
| `20251223000004_power_of_attorney.sql` | POA table RLS |
| `20251223000008_tax_law_ai_system.sql` | Tax law tables RLS |
| `20251223000010_customer_consultant.sql` | Assignment table RLS |
| `20251223000017_add_tax_calculation_table.sql` | Tax calculation RLS |
| `20251223000018_add_audit_log_table.sql` | Audit log RLS |
| `20251223000019_add_document_table.sql` | Document table RLS |
| `20251223000024_notification_tables.sql` | Notification RLS |
| `20251223000026_add_reference_tables_rls.sql` | Reference data RLS |

---

## Testing RLS

### E2E Tests

```bash
# Run all security tests
npm run test:e2e -- --grep "CANNOT"

# Run platform admin security tests
npm run test:e2e -- --grep "Platform admin"

# Run role-based access tests
npm run test:e2e -- --grep "Role Tests"
```

### Manual Verification

```sql
-- Test as a specific user
SET LOCAL "request.jwt.claims" = '{"sub": "user-uuid", "role": "authenticated"}';

-- Verify platform admin cannot see tax filings
SELECT * FROM tax_filing; -- Should return empty or error
```

---

## Related Documentation

- [Hard Rules Enforcement](./hard-rules-enforcement.md)
- [Data Dictionary](./data-dictionary.md)
- [Schema Migrations](./schema-migrations.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-12
**Maintained By:** Database Team
