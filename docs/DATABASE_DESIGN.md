# AI Pajak Database Design
**Version**: 1.0
**Date**: 2025-12-23
**Status**: Initial Design

## Overview

This database design enforces the legal and operational structure defined in [LEGAL_STRUCTURE.md](LEGAL_STRUCTURE.md), ensuring strict separation between:
- **Platform Operator** (Mono Flip Global) - billing collection only
- **Platform** (AI Pajak) - software platform, no tax data access for admins
- **Tax Service Provider** (Jakarta Tax Consulting) - sole authority for tax filing
- **Customers** - end users

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    %% Core Entities
    PLATFORM_OWNER {
        uuid id PK
        varchar name "Mono Flip Global"
        varchar legal_name
        varchar npwp
        varchar address
        timestamp created_at
    }

    PLATFORM {
        uuid id PK
        uuid platform_owner_id FK
        varchar name "AI Pajak"
        varchar domain "ai-pajak.com"
        varchar service_agreement_url
        boolean is_active
        timestamp created_at
    }

    TAX_PARTNER {
        uuid id PK
        uuid platform_id FK
        varchar name "Jakarta Tax Consulting"
        varchar legal_name
        varchar tax_license_number "REQUIRED"
        varchar npwp
        varchar email_domain "jakartatax.co.id"
        varchar address
        boolean is_active
        timestamp partnership_start_date
        timestamp created_at
    }

    CONSULTANT {
        uuid id PK
        uuid tax_partner_id FK "MUST be JTC"
        uuid user_id FK
        varchar employee_id
        varchar full_name
        varchar email
        boolean is_active
        timestamp employment_start_date
        timestamp created_at
    }

    TAX_ADVISOR {
        uuid id PK
        uuid consultant_id FK
        varchar license_number "REQUIRED"
        varchar license_type "Brevet A/B/C, CPA"
        date license_expiry_date
        boolean is_verified
        timestamp created_at
    }

    CUSTOMER {
        uuid id PK
        uuid user_id FK
        varchar customer_type "INDIVIDUAL | COMPANY"
        varchar npwp
        varchar full_name
        varchar company_name "nullable"
        varchar email
        varchar phone
        timestamp created_at
    }

    %% Authentication & Authorization
    USERS {
        uuid id PK
        varchar email UK
        varchar encrypted_password
        timestamp email_confirmed_at
        timestamp last_sign_in_at
        timestamp created_at
    }

    USER_ROLES {
        uuid id PK
        uuid user_id FK
        varchar role "CUSTOMER | CONSULTANT_JTC | TAX_ADVISOR_JTC | PLATFORM_ADMIN | SYSTEM"
        uuid organization_id FK "nullable, points to TAX_PARTNER or PLATFORM"
        varchar organization_type "TAX_PARTNER | PLATFORM | NULL"
        boolean is_active
        timestamp created_at
    }

    %% Tax Data - PROTECTED
    POWER_OF_ATTORNEY {
        uuid id PK
        uuid customer_id FK
        uuid tax_partner_id FK
        varchar poa_number UK "POA-YYYY-NNNNNN"
        varchar scope "ALL_TAX_TYPES | PPh21_ONLY | etc"
        date valid_from
        date valid_to
        varchar status "DRAFT | ACTIVE | EXPIRED | REVOKED"
        text document_url "Signed POA document"
        varchar document_hash "SHA-256 hash"
        timestamp customer_signed_at
        timestamp tax_partner_signed_at
        timestamp created_at
    }

    TAX_FILING {
        uuid id PK
        uuid customer_id FK
        uuid consultant_id FK "MUST be from JTC"
        uuid tax_advisor_id FK "nullable, licensed advisor"
        uuid power_of_attorney_id FK "REQUIRED for FILED status"
        varchar tax_type "PPh21 | PPh23 | PPh_FINAL | PPN | SPT_MASA | SPT_TAHUNAN"
        varchar tax_period "YYYY-MM or YYYY"
        varchar status "DRAFT | UNDER_REVIEW | FILED | REJECTED"
        jsonb tax_data "encrypted sensitive data"
        varchar bpe_number "nullable, from DJP"
        timestamp filed_at
        timestamp created_at
        timestamp updated_at
    }

    TAX_DOCUMENT {
        uuid id PK
        uuid tax_filing_id FK
        uuid uploaded_by_user_id FK
        varchar document_type "INVOICE | RECEIPT | SALARY_SLIP | etc"
        varchar file_path "encrypted storage path"
        varchar file_name
        varchar mime_type
        integer file_size_bytes
        jsonb ocr_data "nullable"
        timestamp uploaded_at
    }

    %% Audit Trail - MANDATORY
    TAX_ACTIVITY_LOG {
        uuid id PK
        uuid customer_id FK
        uuid tax_filing_id FK "nullable"
        uuid actor_user_id FK "WHO did it"
        uuid actor_organization_id FK "WHICH organization"
        varchar actor_role "CONSULTANT_JTC | TAX_ADVISOR_JTC | CUSTOMER"
        varchar activity_type "CREATE | UPDATE | REVIEW | FILE | DOWNLOAD | DELETE"
        varchar tax_type
        varchar tax_period
        jsonb activity_details
        varchar ip_address
        varchar user_agent
        timestamp created_at
    }

    %% Billing & Payments - Collection Agency Model
    BILLING_TRANSACTION {
        uuid id PK
        uuid customer_id FK
        uuid platform_owner_id FK "Mono Flip Global - Collector"
        uuid tax_partner_id FK "JTC - Service Provider"
        varchar transaction_type "SUBSCRIPTION | TAX_SERVICE"
        decimal amount_total
        decimal platform_fee "to AI Pajak / Mono Flip"
        decimal tax_service_fee "pass-through to JTC"
        varchar currency "IDR"
        varchar payment_status "PENDING | PAID | FAILED | REFUNDED"
        varchar payment_method
        varchar payment_reference
        timestamp paid_at
        timestamp created_at
    }

    REVENUE_SPLIT {
        uuid id PK
        uuid billing_transaction_id FK
        uuid recipient_organization_id FK
        varchar recipient_type "PLATFORM_OWNER | TAX_PARTNER"
        decimal amount
        varchar description "Platform Fee | Tax Service Fee"
        varchar accounting_status "PENDING | RECOGNIZED | TRANSFERRED"
        timestamp transferred_at
        timestamp created_at
    }

    %% Subscription Management
    SUBSCRIPTION {
        uuid id PK
        uuid customer_id FK
        varchar plan_type "FREE | BASIC | PROFESSIONAL | ENTERPRISE"
        varchar billing_cycle "MONTHLY | ANNUAL"
        decimal price
        timestamp current_period_start
        timestamp current_period_end
        boolean is_active
        timestamp created_at
    }

    %% Communication & Support
    CONSULTATION_MESSAGE {
        uuid id PK
        uuid customer_id FK
        uuid consultant_id FK "nullable"
        uuid tax_filing_id FK "nullable"
        varchar message_type "QUESTION | RESPONSE | DOCUMENT_REQUEST"
        text message_content
        boolean is_from_customer
        boolean is_read
        timestamp sent_at
    }

    %% Relationships
    PLATFORM_OWNER ||--o{ PLATFORM : "owns"
    PLATFORM ||--o{ TAX_PARTNER : "partners with"
    TAX_PARTNER ||--o{ CONSULTANT : "employs"
    CONSULTANT ||--o| TAX_ADVISOR : "may be licensed as"

    USERS ||--o{ USER_ROLES : "has roles"
    USERS ||--o| CUSTOMER : "customer profile"
    USERS ||--o| CONSULTANT : "consultant profile"

    CUSTOMER ||--o{ POWER_OF_ATTORNEY : "authorizes"
    TAX_PARTNER ||--o{ POWER_OF_ATTORNEY : "receives authorization"

    CUSTOMER ||--o{ TAX_FILING : "submits"
    CONSULTANT ||--o{ TAX_FILING : "processes"
    TAX_ADVISOR ||--o{ TAX_FILING : "reviews/approves"
    POWER_OF_ATTORNEY ||--o{ TAX_FILING : "authorizes"

    TAX_FILING ||--o{ TAX_DOCUMENT : "contains"
    TAX_FILING ||--o{ TAX_ACTIVITY_LOG : "tracked by"

    CUSTOMER ||--o{ BILLING_TRANSACTION : "pays"
    PLATFORM_OWNER ||--o{ BILLING_TRANSACTION : "collects payment"
    TAX_PARTNER ||--o{ BILLING_TRANSACTION : "provides service"
    BILLING_TRANSACTION ||--o{ REVENUE_SPLIT : "split into"

    CUSTOMER ||--o| SUBSCRIPTION : "subscribes to"
    CUSTOMER ||--o{ CONSULTATION_MESSAGE : "sends/receives"
    CONSULTANT ||--o{ CONSULTATION_MESSAGE : "sends/receives"
```

## Key Design Principles

### 1. **Hard Rule Enforcement**

#### Rule 1: PLATFORM_ADMIN Cannot Access Tax Data
- Enforced via RLS policies on `TAX_FILING`, `TAX_DOCUMENT`, `TAX_ACTIVITY_LOG`
- `USER_ROLES` with role `PLATFORM_ADMIN` are blocked from SELECT/INSERT/UPDATE/DELETE on tax tables

#### Rule 2: Consultant MUST Belong to Jakarta Tax Consulting
- Foreign key constraint: `consultant.tax_partner_id` → `tax_partner.id`
- Check constraint: Only consultants from JTC can be assigned to tax filings
- Application-level validation in consultation assignment logic

#### Rule 3: Tax Filing Actor ≠ Platform
- `TAX_FILING.consultant_id` → `CONSULTANT` → `TAX_PARTNER` (must be JTC)
- `TAX_ACTIVITY_LOG.actor_organization_id` cannot reference Platform entity
- RLS policies prevent any user with `PLATFORM_ADMIN` role from modifying tax data

#### Rule 4: Billing Collector ≠ Service Provider
- `BILLING_TRANSACTION.platform_owner_id` → Mono Flip Global (collector)
- `BILLING_TRANSACTION.tax_partner_id` → Jakarta Tax Consulting (provider)
- `REVENUE_SPLIT` table clearly separates platform fees from tax service fees

#### Rule 5: Audit Trail Required
- `TAX_ACTIVITY_LOG` table captures all actions on tax data
- Database triggers on `TAX_FILING`, `TAX_DOCUMENT`, and `POWER_OF_ATTORNEY` auto-create audit entries
- Cannot delete audit logs (RLS policy: no DELETE permission)

#### Rule 6: Legal Authorization via Power of Attorney (NEW)
- `POWER_OF_ATTORNEY` table establishes legal relationship between customer and tax partner
- Tax filings with status `FILED` or `UNDER_REVIEW` **REQUIRE** an active POA
- Database trigger validates POA before allowing tax filing submission
- POA status automatically updated based on validity dates
- Customers can revoke POA at any time (creates audit trail)
- Digital signatures captured with IP address for legal compliance

### 2. **Power of Attorney (POA) Workflow**

```
Customer Journey:
1. Customer creates POA (status: DRAFT)
2. Customer uploads/signs POA document (status: PENDING_SIGNATURE)
3. Tax Partner reviews and signs POA
4. POA becomes ACTIVE (both parties signed, within valid dates)
5. Tax Filing can now proceed (references POA)
6. POA automatically expires when valid_to date passes
7. Customer can manually revoke POA at any time

Database Enforcement:
- tax_filing.power_of_attorney_id FK → power_of_attorney.id
- Trigger: validate_tax_filing_poa() checks active POA before FILED status
- Function: has_active_poa() validates POA scope matches tax type
- Auto-expiration: update_poa_status() runs daily (via cron or application)
```

### 3. **Data Access Matrix**

| Role | Tax Filing | Tax Documents | POA | Customer Data | Billing | Audit Logs |
|------|-----------|---------------|-----|---------------|---------|------------|
| CUSTOMER | Own only | Own only | Own (manage) | Own only | Own only | Own only (read) |
| CONSULTANT_JTC | Assigned cases | Assigned cases | Partner POAs | Assigned cases | No | Write |
| TAX_ADVISOR_JTC | All JTC cases | All JTC cases | Partner POAs | All JTC cases | No | Write |
| PLATFORM_ADMIN | **NO ACCESS** | **NO ACCESS** | View only | Anonymized only | All | Read only |
| SYSTEM | No | No | No | No | All | Write |

### 4. **Entity Constraints**

- **PLATFORM_OWNER**: Single row (Mono Flip Global)
- **PLATFORM**: Single row (AI Pajak)
- **TAX_PARTNER**: Single row (Jakarta Tax Consulting) - extensible for future partners
- **CONSULTANT**: Must have `tax_partner_id` = JTC
- **TAX_ADVISOR**: Must reference valid `consultant_id` with verified license
- **POWER_OF_ATTORNEY**: Must have both customer and tax partner signatures to be ACTIVE
- **TAX_FILING**: Must have `consultant_id` from JTC consultants AND active `power_of_attorney_id` for FILED status

## Implementation Files

### Migration Files

All migration files are located in [../supabase/migrations/](../supabase/migrations/)

1. **[20251223000001_initial_schema.sql](../supabase/migrations/20251223000001_initial_schema.sql)**
   - Core table definitions
   - Enums and type safety
   - Foreign key constraints
   - Indexes for performance
   - Triggers for audit trail
   - **Lines of Code**: ~650
   - **Estimated Run Time**: ~500ms

2. **[20251223000002_rls_policies.sql](../supabase/migrations/20251223000002_rls_policies.sql)**
   - Row Level Security policies
   - Helper functions for role checking
   - Enforcement of all 5 hard rules
   - **Lines of Code**: ~550
   - **Estimated Run Time**: ~300ms

3. **[20251223000003_seed_data.sql](../supabase/migrations/20251223000003_seed_data.sql)**
   - Initial platform entities
   - Mono Flip Global, AI Pajak, Jakarta Tax Consulting
   - Data verification queries
   - **Lines of Code**: ~100
   - **Estimated Run Time**: ~100ms

4. **[20251223000004_power_of_attorney.sql](../supabase/migrations/20251223000004_power_of_attorney.sql)** ⭐ NEW
   - Power of Attorney table and workflows
   - POA status management (DRAFT → ACTIVE → EXPIRED/REVOKED)
   - Validation trigger: requires active POA before tax filing
   - Digital signature tracking with IP address
   - RLS policies for POA management
   - Audit trail integration for POA activities
   - **Lines of Code**: ~450
   - **Estimated Run Time**: ~200ms

### Documentation

- **[../supabase/README.md](../supabase/README.md)** - Complete guide for:
  - Database architecture
  - Migration usage
  - RLS policy testing
  - Common queries
  - Security considerations
  - Performance optimization
  - Troubleshooting

## Hard Rule Implementation Details

### Rule 1: PLATFORM_ADMIN Cannot Access Tax Data
**SQL Implementation**:
```sql
-- Block all PLATFORM_ADMIN access
CREATE POLICY "Block platform admins from tax filing"
ON tax_filing FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
```
**File**: [20251223000002_rls_policies.sql:181-185](../supabase/migrations/20251223000002_rls_policies.sql#L181-L185)

### Rule 2: Consultant MUST Belong to Jakarta Tax Consulting
**SQL Implementation**:
```sql
-- FK constraint ensures consultant belongs to tax_partner
CREATE TABLE consultant (
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
    -- ... other fields
);

-- Policy ensures only JTC consultants assigned
CREATE POLICY "Only JTC consultants can be assigned"
ON tax_filing FOR INSERT
WITH CHECK (
    consultant_id IN (
        SELECT c.id FROM consultant c
        JOIN tax_partner tp ON c.tax_partner_id = tp.id
        WHERE tp.name = 'Jakarta Tax Consulting'
    )
);
```
**Files**:
- [20251223000001_initial_schema.sql:157](../supabase/migrations/20251223000001_initial_schema.sql#L157)
- [20251223000002_rls_policies.sql:270-280](../supabase/migrations/20251223000002_rls_policies.sql#L270-L280)

### Rule 3: Tax Filing Actor ≠ Platform
**SQL Implementation**:
```sql
-- Audit log policy prevents platform organization as actor
CREATE POLICY "Prevent platform as tax actor"
ON tax_activity_log FOR INSERT
WITH CHECK (
    actor_organization_id IS NULL OR
    actor_organization_id NOT IN (SELECT id FROM platform)
);
```
**File**: [20251223000002_rls_policies.sql:347-355](../supabase/migrations/20251223000002_rls_policies.sql#L347-L355)

### Rule 4: Billing Collector ≠ Service Provider
**SQL Implementation**:
```sql
-- Separate columns for collector and provider
CREATE TABLE billing_transaction (
    platform_owner_id UUID NOT NULL REFERENCES platform_owner(id),
    tax_partner_id UUID REFERENCES tax_partner(id),
    -- ... other fields
);

-- Policy prevents same entity as both
CREATE POLICY "Enforce collector not provider"
ON billing_transaction FOR INSERT
WITH CHECK (platform_owner_id != tax_partner_id OR tax_partner_id IS NULL);
```
**Files**:
- [20251223000001_initial_schema.sql:292-310](../supabase/migrations/20251223000001_initial_schema.sql#L292-L310)
- [20251223000002_rls_policies.sql:385-392](../supabase/migrations/20251223000002_rls_policies.sql#L385-L392)

### Rule 5: Audit Trail Required
**SQL Implementation**:
```sql
-- Trigger auto-creates audit entries
CREATE TRIGGER tax_filing_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON tax_filing
FOR EACH ROW EXECUTE FUNCTION log_tax_filing_activity();

-- No DELETE policy = permanent audit trail
-- (Only SELECT policies exist for tax_activity_log)
```
**File**: [20251223000001_initial_schema.sql:519-571](../supabase/migrations/20251223000001_initial_schema.sql#L519-L571)

## Testing & Verification

### Automated Tests

```bash
# Run all migrations
cd /Users/tommy/git/ai-pajak
supabase db reset

# Verify tables created
psql $DATABASE_URL -c "\dt"

# Verify RLS enabled
psql $DATABASE_URL -c "
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
"

# Verify seed data
psql $DATABASE_URL -c "
SELECT 'platform_owner' as entity, COUNT(*) FROM platform_owner
UNION ALL
SELECT 'platform', COUNT(*) FROM platform
UNION ALL
SELECT 'tax_partner', COUNT(*) FROM tax_partner;
"
```

### Manual Testing Checklist

- [ ] PLATFORM_ADMIN cannot SELECT from `tax_filing`
- [ ] PLATFORM_ADMIN cannot SELECT from `tax_document`
- [ ] CUSTOMER can only see own tax filings
- [ ] CONSULTANT_JTC can only see assigned cases
- [ ] Audit log entries auto-created on tax_filing changes
- [ ] Audit logs cannot be deleted
- [ ] Billing transaction requires platform_owner_id ≠ tax_partner_id
- [ ] Revenue split correctly separates fees

## Next Steps

1. ✅ **ERD Design** - Completed
2. ✅ **Migration SQL** - Completed (3 files)
3. ✅ **RLS Policies** - Completed
4. ✅ **Seed Data** - Completed
5. ⏭️ **API Middleware** - Implement Next.js middleware for role enforcement
6. ⏭️ **Supabase Client Setup** - Configure client-side auth integration
7. ⏭️ **Testing Suite** - Create automated tests for RLS policies
8. ⏭️ **Documentation Review** - Review with Legal, Product, Engineering teams

## References

- [PRD.md](PRD.md) - Product Requirements Document v3.2
- [LEGAL_STRUCTURE.md](LEGAL_STRUCTURE.md) - Legal & Operational Framework
- [UPDATE_SUMMARY_2025-12-23.md](UPDATE_SUMMARY_2025-12-23.md) - Recent updates
- [../supabase/README.md](../supabase/README.md) - Database Usage Guide
