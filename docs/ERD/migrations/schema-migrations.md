# Schema Migrations Guide

**Version**: 1.0
**Date**: 2025-12-23

Complete guide for database migration files, how to run them, and troubleshooting.

## Table of Contents

1. [Migration Files Overview](#migration-files-overview)
2. [Migration Execution Order](#migration-execution-order)
3. [How to Run Migrations](#how-to-run-migrations)
4. [Testing Migrations](#testing-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)

---

## Migration Files Overview

All migration files are located in `/Users/tommy/git/ai-pajak/supabase/migrations/`.

### Migration Files

| File | Purpose | LOC | Est. Runtime | Dependencies |
|------|---------|-----|--------------|--------------|
| `20251223000001_initial_schema.sql` | Core tables, constraints, indexes, triggers | ~650 | ~500ms | None |
| `20251223000002_rls_policies.sql` | Row-Level Security policies, helper functions | ~550 | ~300ms | 000001 |
| `20251223000003_seed_data.sql` | Initial platform data (Mono Flip, AI Pajak, JTC) | ~100 | ~100ms | 000001 |
| `20251223000004_power_of_attorney.sql` | POA table, workflows, validation triggers | ~450 | ~200ms | 000001, 000002 |
| `20251223000005_klu_codes.sql` | Indonesian business classification codes | ~200 | ~150ms | 000001 |
| `20251223000006_luxury_items.sql` | Luxury goods tax reference data | ~200 | ~150ms | 000001 |
| `20251223000008_tax_law_ai_system.sql` | AI tax law reference system | ~250 | ~200ms | 000001 |

**Total Estimated Runtime**: ~1.65 seconds

---

## Migration Execution Order

Migrations are executed in chronological order based on the timestamp prefix:

```
1. 20251223000001_initial_schema.sql
   ↓
2. 20251223000002_rls_policies.sql
   ↓
3. 20251223000003_seed_data.sql
   ↓
4. 20251223000004_power_of_attorney.sql
   ↓
5. 20251223000005_klu_codes.sql
   ↓
6. 20251223000006_luxury_items.sql
   ↓
7. 20251223000008_tax_law_ai_system.sql
```

**Critical Dependencies**:
- `000002` depends on `000001` (RLS policies need tables)
- `000003` depends on `000001` (seed data needs tables)
- `000004` depends on `000001` and `000002` (POA needs tables and RLS)
- `000005-000008` depend on `000001` (reference data needs tables)

---

## Migration 1: Initial Schema

**File**: `20251223000001_initial_schema.sql`

### Purpose
Creates core database structure including:
- PostgreSQL extensions (uuid-ossp, pgcrypto)
- Enum types for type safety
- Core organizational entities
- User authentication integration
- Tax filing entities
- Billing entities
- Communication entities
- Audit triggers

### Key Components

#### Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

#### Enum Types
- `user_role_type` - User role types
- `customer_type` - Individual or company
- `tax_type` - Tax filing types
- `tax_filing_status` - Filing status workflow
- `transaction_type` - Billing transaction types
- `payment_status` - Payment status workflow
- `organization_type` - Organization types
- `subscription_plan` - Subscription tiers
- `billing_cycle` - Monthly or annual
- `activity_type` - Audit activity types
- `revenue_recipient_type` - Revenue recipients
- `accounting_status` - Accounting status

#### Core Tables
1. **Organizational Entities**
   - `platform_owner` - Mono Flip Global
   - `platform` - AI Pajak
   - `tax_partner` - Jakarta Tax Consulting

2. **User Management**
   - `user_roles` - Multi-role authorization
   - `consultant` - JTC consultants
   - `tax_advisor` - Licensed advisors
   - `customer` - End users

3. **Tax Operations (PROTECTED)**
   - `tax_filing` - Tax submissions
   - `tax_document` - Supporting documents
   - `tax_activity_log` - Audit trail

4. **Billing**
   - `billing_transaction` - Payments
   - `revenue_split` - Revenue distribution
   - `subscription` - Subscription plans

5. **Communication**
   - `consultation_message` - Customer-consultant messaging

#### Triggers
- `update_updated_at_column()` - Auto-update timestamps
- `log_tax_filing_activity()` - Audit trail creation

### Verification

```sql
-- Verify tables created
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: 14 tables

-- Verify enum types created
SELECT typname
FROM pg_type
WHERE typtype = 'e'
ORDER BY typname;
-- Expected: 12 enum types

-- Verify extensions enabled
SELECT extname
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto');
-- Expected: 2 extensions
```

---

## Migration 2: RLS Policies

**File**: `20251223000002_rls_policies.sql`

### Purpose
Implements Row-Level Security policies enforcing the 6 hard rules.

### Key Components

#### Helper Functions
```sql
get_user_role()                 -- Get current user's role
get_user_organization_id()      -- Get user's organization
get_user_organization_type()    -- Get organization type
is_customer()                   -- Check if user is customer
is_jtc_consultant()             -- Check if user is JTC consultant
is_platform_admin()             -- Check if user is platform admin
get_customer_id()               -- Get customer ID for current user
get_consultant_id()             -- Get consultant ID for current user
```

#### RLS Policies by Table

**Organizational Entities**
- Public read access for authenticated users
- SYSTEM-only modifications

**Tax Filing (HARD RULE 1)**
- Complete blockade of PLATFORM_ADMIN
- Customer: own filings only
- JTC Consultant: assigned cases only

**Tax Documents (HARD RULE 1)**
- Complete blockade of PLATFORM_ADMIN
- Customer: own documents only
- JTC Consultant: assigned cases only

**Tax Activity Log (HARD RULE 5)**
- Platform Admin: read-only (anonymized)
- Customer: own logs
- JTC Consultant: assigned cases
- No UPDATE or DELETE allowed

**Billing**
- Customer: own transactions
- Platform Admin: all transactions
- Tax Partner: service transactions

**Consultation Messages (HARD RULE 1)**
- Complete blockade of PLATFORM_ADMIN
- Customer: own messages
- JTC Consultant: assigned messages

### Verification

```sql
-- Verify RLS enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
-- Expected: All 14 tables

-- Verify policies created
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Expected: ~40 policies

-- Verify helper functions created
SELECT proname, pronargs
FROM pg_proc
WHERE proname LIKE 'get_%' OR proname LIKE 'is_%'
ORDER BY proname;
-- Expected: 8 helper functions
```

---

## Migration 3: Seed Data

**File**: `20251223000003_seed_data.sql`

### Purpose
Populates initial platform entities required for system operation.

### Seed Data

#### Platform Owner (Mono Flip Global)
```sql
INSERT INTO platform_owner (name, legal_name, npwp, address, email, phone)
VALUES (
    'Mono Flip Global',
    'PT Mono Flip Global Indonesia',
    '01.234.567.8-901.000',
    'Jakarta, Indonesia',
    'finance@monoflip.com',
    '+62-21-XXXXXXXX'
);
```

#### Platform (AI Pajak)
```sql
INSERT INTO platform (platform_owner_id, name, domain, is_active)
VALUES (
    (SELECT id FROM platform_owner LIMIT 1),
    'AI Pajak',
    'ai-pajak.com',
    true
);
```

#### Tax Partner (Jakarta Tax Consulting)
```sql
INSERT INTO tax_partner (
    platform_id,
    name,
    legal_name,
    tax_license_number,
    npwp,
    email_domain,
    address,
    email,
    phone,
    partnership_start_date
)
VALUES (
    (SELECT id FROM platform LIMIT 1),
    'Jakarta Tax Consulting',
    'PT Jakarta Tax Consulting',
    'TAX-LIC-2024-001',
    '01.234.567.8-902.000',
    'jakartatax.co.id',
    'Jakarta, Indonesia',
    'info@jakartatax.co.id',
    '+62-21-XXXXXXXX',
    '2024-01-01'
);
```

### Verification

```sql
-- Verify platform owner created
SELECT name, legal_name FROM platform_owner;
-- Expected: 1 row (Mono Flip Global)

-- Verify platform created
SELECT name, domain FROM platform;
-- Expected: 1 row (AI Pajak)

-- Verify tax partner created
SELECT name, legal_name, tax_license_number FROM tax_partner;
-- Expected: 1 row (Jakarta Tax Consulting)

-- Verify relationships
SELECT
    po.name as platform_owner,
    p.name as platform,
    tp.name as tax_partner
FROM platform_owner po
JOIN platform p ON p.platform_owner_id = po.id
JOIN tax_partner tp ON tp.platform_id = p.id;
-- Expected: Mono Flip Global → AI Pajak → Jakarta Tax Consulting
```

---

## Migration 4: Power of Attorney

**File**: `20251223000004_power_of_attorney.sql`

### Purpose
Implements Power of Attorney (POA) system for legal authorization before tax filing.

### Key Components

#### POA Table
```sql
CREATE TABLE power_of_attorney (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    tax_partner_id UUID NOT NULL,
    poa_number VARCHAR(50) UNIQUE,
    scope VARCHAR(50) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    document_url TEXT,
    document_hash VARCHAR(64),
    customer_signed_at TIMESTAMP WITH TIME ZONE,
    tax_partner_signed_at TIMESTAMP WITH TIME ZONE,
    customer_ip_address INET,
    tax_partner_ip_address INET
);
```

#### Validation Functions
```sql
has_active_poa(customer_id, tax_type, tax_partner_id)
-- Checks if customer has active POA for tax type

validate_tax_filing_poa()
-- Validates POA before allowing FILED status

auto_expire_poa()
-- Auto-expires POA when valid_to date passes

validate_poa_status()
-- Validates POA status transitions
```

#### RLS Policies
- Customer: manage own POAs
- Tax Partner: sign partner POAs
- Platform Admin: view only (anonymized)

### Verification

```sql
-- Verify POA table created
SELECT tablename FROM pg_tables WHERE tablename = 'power_of_attorney';
-- Expected: 1 row

-- Verify POA functions created
SELECT proname FROM pg_proc WHERE proname LIKE '%poa%' ORDER BY proname;
-- Expected: has_active_poa, validate_tax_filing_poa, auto_expire_poa, validate_poa_status

-- Verify POA triggers created
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%poa%' ORDER BY tgname;
-- Expected: auto_expire_poa_trigger, validate_poa_status_trigger, validate_tax_filing_poa
```

---

## How to Run Migrations

### Option 1: Supabase CLI (Recommended)

#### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
supabase --version
```

#### Initialize Supabase Project
```bash
cd /Users/tommy/git/ai-pajak
supabase init
```

#### Link to Remote Project (Production)
```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Verify link
supabase projects list
```

#### Run All Migrations
```bash
# Reset database (WARNING: Destroys all data)
supabase db reset

# Or apply pending migrations only
supabase db push
```

#### Run Specific Migration
```bash
# Apply specific migration file
psql $DATABASE_URL -f supabase/migrations/20251223000001_initial_schema.sql
```

### Option 2: Manual SQL Execution

#### Using psql
```bash
# Connect to database
psql $DATABASE_URL

# Run migrations in order
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000003_seed_data.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000004_power_of_attorney.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000005_klu_codes.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000006_luxury_items.sql
\i /Users/tommy/git/ai-pajak/supabase/migrations/20251223000008_tax_law_ai_system.sql
```

#### Using Supabase Dashboard
1. Navigate to Supabase Dashboard
2. Go to SQL Editor
3. Copy/paste each migration file content
4. Execute in order

### Option 3: Automated Script

```bash
#!/bin/bash
# run-migrations.sh

set -e

MIGRATIONS_DIR="/Users/tommy/git/ai-pajak/supabase/migrations"
DATABASE_URL="your-database-url"

echo "Starting migrations..."

for file in $MIGRATIONS_DIR/*.sql; do
    echo "Running $(basename $file)..."
    psql $DATABASE_URL -f "$file"
    echo "✓ Completed $(basename $file)"
done

echo "All migrations completed successfully!"
```

Run:
```bash
chmod +x run-migrations.sh
./run-migrations.sh
```

---

## Testing Migrations

### Test Suite

#### 1. Schema Validation
```sql
-- Verify all tables exist
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
-- Expected: 14+ tables

-- Verify all enum types exist
SELECT COUNT(*) FROM pg_type WHERE typtype = 'e';
-- Expected: 12+ enum types

-- Verify all indexes exist
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Expected: 50+ indexes

-- Verify all triggers exist
SELECT COUNT(*) FROM pg_trigger WHERE tgname NOT LIKE 'RI_%';
-- Expected: 15+ triggers
```

#### 2. RLS Policy Validation
```sql
-- Verify RLS enabled on all tables
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 14+ tables

-- Verify policies exist for protected tables
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('tax_filing', 'tax_document', 'tax_activity_log')
GROUP BY tablename;
-- Expected: Each table has multiple policies
```

#### 3. Seed Data Validation
```sql
-- Verify platform entities
SELECT 'platform_owner' as entity, COUNT(*) FROM platform_owner
UNION ALL
SELECT 'platform', COUNT(*) FROM platform
UNION ALL
SELECT 'tax_partner', COUNT(*) FROM tax_partner;
-- Expected: 1 row each
```

#### 4. Hard Rules Validation
See [hard-rules-enforcement.md](hard-rules-enforcement.md) for complete validation queries.

### Automated Testing Script

```sql
-- test-migrations.sql

DO $$
DECLARE
    v_table_count INTEGER;
    v_enum_count INTEGER;
    v_policy_count INTEGER;
    v_seed_count INTEGER;
BEGIN
    -- Test 1: Table count
    SELECT COUNT(*) INTO v_table_count
    FROM pg_tables WHERE schemaname = 'public';

    IF v_table_count < 14 THEN
        RAISE EXCEPTION 'Table count mismatch: expected >= 14, got %', v_table_count;
    END IF;
    RAISE NOTICE '✓ Table count: %', v_table_count;

    -- Test 2: Enum count
    SELECT COUNT(*) INTO v_enum_count
    FROM pg_type WHERE typtype = 'e';

    IF v_enum_count < 12 THEN
        RAISE EXCEPTION 'Enum count mismatch: expected >= 12, got %', v_enum_count;
    END IF;
    RAISE NOTICE '✓ Enum count: %', v_enum_count;

    -- Test 3: RLS policy count
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE schemaname = 'public';

    IF v_policy_count < 40 THEN
        RAISE EXCEPTION 'Policy count mismatch: expected >= 40, got %', v_policy_count;
    END IF;
    RAISE NOTICE '✓ Policy count: %', v_policy_count;

    -- Test 4: Seed data count
    SELECT COUNT(*) INTO v_seed_count
    FROM platform_owner;

    IF v_seed_count != 1 THEN
        RAISE EXCEPTION 'Seed data mismatch: expected 1 platform_owner, got %', v_seed_count;
    END IF;
    RAISE NOTICE '✓ Seed data validated';

    RAISE NOTICE '✓✓✓ All migration tests passed!';
END $$;
```

Run:
```bash
psql $DATABASE_URL -f test-migrations.sql
```

---

## Rollback Procedures

### Strategy 1: Database Reset (Development Only)

```bash
# WARNING: Destroys all data
supabase db reset
```

### Strategy 2: Manual Rollback (Production)

Create rollback migration files:

#### Rollback 4: Power of Attorney
```sql
-- rollback_20251223000004_power_of_attorney.sql
DROP TRIGGER IF EXISTS validate_tax_filing_poa ON tax_filing;
DROP TRIGGER IF EXISTS auto_expire_poa_trigger ON power_of_attorney;
DROP FUNCTION IF EXISTS has_active_poa(UUID, VARCHAR, UUID);
DROP FUNCTION IF EXISTS validate_tax_filing_poa();
DROP FUNCTION IF EXISTS auto_expire_poa();
DROP TABLE IF EXISTS power_of_attorney CASCADE;
```

#### Rollback 3: Seed Data
```sql
-- rollback_20251223000003_seed_data.sql
DELETE FROM tax_partner;
DELETE FROM platform;
DELETE FROM platform_owner;
```

#### Rollback 2: RLS Policies
```sql
-- rollback_20251223000002_rls_policies.sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ALL ON ' || r.tablename;
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS get_user_organization_id();
DROP FUNCTION IF EXISTS is_customer();
DROP FUNCTION IF EXISTS is_jtc_consultant();
DROP FUNCTION IF EXISTS is_platform_admin();
DROP FUNCTION IF EXISTS get_customer_id();
DROP FUNCTION IF EXISTS get_consultant_id();
```

#### Rollback 1: Initial Schema
```sql
-- rollback_20251223000001_initial_schema.sql
DROP TABLE IF EXISTS consultation_message CASCADE;
DROP TABLE IF EXISTS subscription CASCADE;
DROP TABLE IF EXISTS revenue_split CASCADE;
DROP TABLE IF EXISTS billing_transaction CASCADE;
DROP TABLE IF EXISTS tax_activity_log CASCADE;
DROP TABLE IF EXISTS tax_document CASCADE;
DROP TABLE IF EXISTS tax_filing CASCADE;
DROP TABLE IF EXISTS customer CASCADE;
DROP TABLE IF EXISTS tax_advisor CASCADE;
DROP TABLE IF EXISTS consultant CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS tax_partner CASCADE;
DROP TABLE IF EXISTS platform CASCADE;
DROP TABLE IF EXISTS platform_owner CASCADE;

DROP TYPE IF EXISTS accounting_status;
DROP TYPE IF EXISTS revenue_recipient_type;
DROP TYPE IF EXISTS activity_type;
DROP TYPE IF EXISTS billing_cycle;
DROP TYPE IF EXISTS subscription_plan;
DROP TYPE IF EXISTS organization_type;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS transaction_type;
DROP TYPE IF EXISTS tax_filing_status;
DROP TYPE IF EXISTS tax_type;
DROP TYPE IF EXISTS customer_type;
DROP TYPE IF EXISTS user_role_type;
```

### Strategy 3: Backup and Restore

#### Before Migration (Backup)
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase
supabase db dump > backup.sql
```

#### After Failed Migration (Restore)
```bash
# Restore from backup
psql $DATABASE_URL < backup_20251223_100000.sql

# Or using Supabase
supabase db reset
psql $DATABASE_URL < backup.sql
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Extension Not Found
```
ERROR: extension "uuid-ossp" does not exist
```

**Solution**:
```sql
-- Enable extensions manually
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

#### Issue 2: Duplicate Key Error (Seed Data)
```
ERROR: duplicate key value violates unique constraint
```

**Solution**:
```sql
-- Check if seed data already exists
SELECT * FROM platform_owner;

-- If exists, skip seed data or update instead
UPDATE platform_owner SET ...;
```

#### Issue 3: RLS Policy Blocks Own Access
```
ERROR: new row violates row-level security policy
```

**Solution**:
```sql
-- Temporarily disable RLS for migration
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;

-- Run migration

-- Re-enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

#### Issue 4: Trigger Function Not Found
```
ERROR: function <function_name> does not exist
```

**Solution**:
```sql
-- Verify function exists
SELECT proname FROM pg_proc WHERE proname = '<function_name>';

-- Re-run migration file that creates function
\i /path/to/migration.sql
```

#### Issue 5: Foreign Key Constraint Violation
```
ERROR: insert or update on table violates foreign key constraint
```

**Solution**:
```sql
-- Check migration order
-- Ensure parent tables exist before child tables

-- Verify seed data order
-- platform_owner → platform → tax_partner
```

### Debug Queries

#### List All Tables
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

#### List All Policies
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

#### List All Triggers
```sql
SELECT
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname NOT LIKE 'RI_%'
ORDER BY tgrelid::regclass::text, tgname;
```

#### List All Functions
```sql
SELECT
    proname as function_name,
    pronargs as arg_count,
    prorettype::regtype as return_type
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;
```

#### Check Migration Status (Supabase)
```bash
supabase migration list
```

---

## Best Practices

### Development Environment

1. **Use Local Supabase Instance**
   ```bash
   supabase start
   supabase db reset  # Safe in local environment
   ```

2. **Test Migrations Locally First**
   ```bash
   # Run migrations locally
   supabase db reset

   # Verify all tests pass
   psql $LOCAL_DB_URL -f test-migrations.sql
   ```

3. **Version Control**
   - Always commit migration files to git
   - Never modify existing migration files
   - Create new migration files for changes

### Production Environment

1. **Backup Before Migration**
   ```bash
   pg_dump $PROD_DB_URL > prod_backup_$(date +%Y%m%d).sql
   ```

2. **Run During Low Traffic**
   - Schedule migrations during maintenance windows
   - Monitor for long-running queries

3. **Test Rollback Procedure**
   - Have rollback scripts ready
   - Test rollback in staging first

4. **Monitor After Migration**
   ```sql
   -- Check for errors
   SELECT * FROM pg_stat_activity
   WHERE state = 'idle in transaction'
   OR wait_event_type IS NOT NULL;

   -- Check slow queries
   SELECT * FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   ```

---

## Next Steps

- Review [data-dictionary.md](data-dictionary.md) for complete schema reference
- Review [hard-rules-enforcement.md](hard-rules-enforcement.md) for compliance testing
- Review [erd-overview.md](erd-overview.md) for architecture understanding
- Set up automated migration testing in CI/CD pipeline
