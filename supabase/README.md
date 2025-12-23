# AI Pajak - Supabase Database

## Overview

This directory contains the complete database schema, migrations, and Row Level Security (RLS) policies for the AI Pajak platform.

**Key Design Principle**: Strict separation between Platform (AI Pajak) and Tax Service Provider (Jakarta Tax Consulting) to ensure legal compliance and data security.

## Directory Structure

```
supabase/
├── migrations/
│   ├── 20251223000001_initial_schema.sql    # Core tables and constraints
│   ├── 20251223000002_rls_policies.sql      # Row Level Security policies
│   └── 20251223000003_seed_data.sql         # Initial platform entities
└── README.md                                  # This file
```

## Database Architecture

### Entity Relationship Summary

```
Platform Owner (Mono Flip Global)
  └── Platform (AI Pajak)
        └── Tax Partner (Jakarta Tax Consulting)
              └── Consultant
                    └── Tax Advisor (optional, licensed)

Customer ──> Tax Filing ──> Tax Document
                 │
                 └──> Tax Activity Log (Audit Trail)
```

### 5 Hard Rules Enforced

#### 1. PLATFORM_ADMIN Cannot Access Customer Tax Data
- **Implementation**: RLS policies block all access to `tax_filing`, `tax_document` tables
- **Code**: [20251223000002_rls_policies.sql:181-185](20251223000002_rls_policies.sql#L181-L185)
- **Enforcement Level**: Database (RLS) + Application middleware

#### 2. Consultant MUST Belong to Jakarta Tax Consulting
- **Implementation**: Foreign key constraint + INSERT policy validation
- **Code**: [20251223000001_initial_schema.sql:157](20251223000001_initial_schema.sql#L157)
- **Enforcement Level**: Database (FK + RLS)

#### 3. Tax Filing Actor ≠ Platform
- **Implementation**: `consultant_id` FK ensures only JTC consultants can file
- **Code**: [20251223000002_rls_policies.sql:270-280](20251223000002_rls_policies.sql#L270-L280)
- **Enforcement Level**: Database (FK + RLS + Audit log policies)

#### 4. Billing Collector ≠ Service Provider
- **Implementation**: Separate FKs for `platform_owner_id` (collector) and `tax_partner_id` (provider)
- **Code**: [20251223000001_initial_schema.sql:292-310](20251223000001_initial_schema.sql#L292-L310)
- **Enforcement Level**: Database (Schema design + RLS)

#### 5. Audit Trail Required
- **Implementation**: Automatic triggers + No DELETE policy on audit logs
- **Code**: [20251223000001_initial_schema.sql:519-571](20251223000001_initial_schema.sql#L519-L571)
- **Enforcement Level**: Database (Triggers + RLS)

## Migration Files

### 1. Initial Schema (`20251223000001_initial_schema.sql`)

**What it does**:
- Creates all core tables
- Defines enums for type safety
- Adds foreign key constraints
- Creates indexes for performance
- Adds triggers for `updated_at` columns
- Implements audit trail trigger

**Key Tables**:
- **Organizational**: `platform_owner`, `platform`, `tax_partner`
- **Users**: `user_roles`, `consultant`, `tax_advisor`, `customer`
- **Tax Data** (Protected): `tax_filing`, `tax_document`, `tax_activity_log`
- **Billing**: `billing_transaction`, `revenue_split`, `subscription`
- **Communication**: `consultation_message`

**Run time**: ~500ms

### 2. RLS Policies (`20251223000002_rls_policies.sql`)

**What it does**:
- Enables RLS on all tables
- Creates helper functions for role checking
- Implements policies for each user role
- Enforces all 5 hard rules at database level

**Role-Based Access**:
- `CUSTOMER`: Own data only
- `CONSULTANT_JTC`: Assigned cases only
- `TAX_ADVISOR_JTC`: All JTC cases
- `PLATFORM_ADMIN`: Platform management, NO tax data access
- `SYSTEM`: Billing and system operations

**Run time**: ~300ms

### 3. Seed Data (`20251223000003_seed_data.sql`)

**What it does**:
- Creates initial platform owner (Mono Flip Global)
- Creates platform instance (AI Pajak)
- Creates tax partner (Jakarta Tax Consulting)
- Verifies seed data integrity

**Run time**: ~100ms

## How to Use

### Local Development with Supabase CLI

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Initialize Supabase**:
   ```bash
   supabase init
   ```

3. **Start local Supabase**:
   ```bash
   supabase start
   ```

4. **Apply migrations**:
   ```bash
   supabase db reset
   ```

5. **View local database**:
   ```bash
   supabase db diff
   ```

### Production Deployment

1. **Link to Supabase project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push migrations**:
   ```bash
   supabase db push
   ```

3. **Verify deployment**:
   ```bash
   supabase db remote commit
   ```

## Testing RLS Policies

### Test Scenarios

```sql
-- Test 1: PLATFORM_ADMIN should NOT access tax_filing
SET ROLE authenticated;
SET request.jwt.claims.role = 'PLATFORM_ADMIN';
SELECT * FROM tax_filing; -- Should return 0 rows

-- Test 2: CUSTOMER should only see own data
SET request.jwt.claims.role = 'CUSTOMER';
SET request.jwt.claims.sub = '<customer_user_id>';
SELECT * FROM tax_filing; -- Should return only customer's filings

-- Test 3: CONSULTANT_JTC should only see assigned cases
SET request.jwt.claims.role = 'CONSULTANT_JTC';
SET request.jwt.claims.sub = '<consultant_user_id>';
SELECT * FROM tax_filing; -- Should return only assigned filings

-- Test 4: Audit log cannot be deleted
DELETE FROM tax_activity_log WHERE id = '<some_id>'; -- Should fail (no policy)

-- Test 5: Billing collector ≠ provider
INSERT INTO billing_transaction (
    customer_id, platform_owner_id, tax_partner_id, ...
) VALUES (
    ..., '<same_id>', '<same_id>', ... -- Should fail (CHECK constraint)
);
```

## Data Access Matrix

| Role              | Tax Filing | Tax Documents | Customer Data | Billing | Audit Logs |
|-------------------|------------|---------------|---------------|---------|------------|
| CUSTOMER          | Own only   | Own only      | Own only      | Own     | Own (read) |
| CONSULTANT_JTC    | Assigned   | Assigned      | Assigned      | No      | Write      |
| TAX_ADVISOR_JTC   | All JTC    | All JTC       | All JTC       | No      | Write      |
| PLATFORM_ADMIN    | **NO**     | **NO**        | Anonymized    | All     | Read only  |
| SYSTEM            | No         | No            | No            | All     | Write      |

## Common Queries

### Get customer's tax filings
```sql
SELECT
    tf.*,
    c.full_name as consultant_name,
    ta.license_number as tax_advisor_license
FROM tax_filing tf
JOIN consultant c ON tf.consultant_id = c.id
LEFT JOIN tax_advisor ta ON tf.tax_advisor_id = ta.id
WHERE tf.customer_id = '<customer_id>'
ORDER BY tf.created_at DESC;
```

### Get consultant's workload
```sql
SELECT
    c.full_name,
    COUNT(tf.id) as total_cases,
    COUNT(CASE WHEN tf.status = 'DRAFT' THEN 1 END) as draft_cases,
    COUNT(CASE WHEN tf.status = 'UNDER_REVIEW' THEN 1 END) as review_cases,
    COUNT(CASE WHEN tf.status = 'FILED' THEN 1 END) as filed_cases
FROM consultant c
LEFT JOIN tax_filing tf ON c.id = tf.consultant_id
WHERE c.is_active = true
GROUP BY c.id, c.full_name;
```

### Audit trail for a customer
```sql
SELECT
    tal.*,
    u.email as actor_email,
    ur.role as actor_role
FROM tax_activity_log tal
JOIN auth.users u ON tal.actor_user_id = u.id
JOIN user_roles ur ON u.id = ur.user_id
WHERE tal.customer_id = '<customer_id>'
ORDER BY tal.created_at DESC;
```

### Revenue split summary
```sql
SELECT
    rs.recipient_type,
    SUM(rs.amount) as total_amount,
    COUNT(DISTINCT rs.billing_transaction_id) as transaction_count
FROM revenue_split rs
WHERE rs.accounting_status = 'RECOGNIZED'
GROUP BY rs.recipient_type;
```

## Security Considerations

### Encryption
- **At Rest**: Supabase encrypts all data at rest (AES-256)
- **In Transit**: All connections use TLS 1.2+
- **Application Level**: Sensitive fields in `tax_data` JSONB should be encrypted before storage

### Secrets Management
- Never commit credentials to git
- Use environment variables for connection strings
- Rotate service role keys regularly

### Audit & Compliance
- All tax activities are logged in `tax_activity_log`
- Logs are immutable (no DELETE policy)
- Include IP address and user agent for forensics

## Performance Optimization

### Indexes Created
- User lookups: `user_id` on all user-related tables
- Tax filing queries: `customer_id`, `consultant_id`, `status`, `tax_period`
- Audit trail: `customer_id`, `created_at DESC`
- Billing: `customer_id`, `payment_status`, `created_at DESC`

### Query Optimization Tips
1. Use `LIMIT` for pagination
2. Add indexes for frequently filtered columns
3. Use `EXPLAIN ANALYZE` to check query plans
4. Consider materialized views for complex reports

## Troubleshooting

### Migration Fails
```bash
# Reset local database
supabase db reset

# Check migration status
supabase migration list

# Apply specific migration
supabase migration up --version 20251223000001
```

### RLS Policy Issues
```sql
-- Check current user role
SELECT get_user_role();

-- Disable RLS temporarily (DANGEROUS - dev only)
ALTER TABLE tax_filing DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE tax_filing ENABLE ROW LEVEL SECURITY;
```

### Performance Issues
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND correlation < 0.5;
```

## References

- [PRD.md](../docs/PRD.md) - Product Requirements
- [LEGAL_STRUCTURE.md](../docs/LEGAL_STRUCTURE.md) - Legal Framework
- [DATABASE_DESIGN.md](../docs/DATABASE_DESIGN.md) - ERD and Design Docs
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Support

For database-related issues:
1. Check migration logs
2. Review RLS policies
3. Verify seed data
4. Contact: dev@ai-pajak.com
