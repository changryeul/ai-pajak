# Hard Rules Enforcement

**Version**: 1.0
**Date**: 2025-12-23

This document explains how the 6 hard rules are enforced at the database level through Row-Level Security (RLS) policies, triggers, constraints, and schema design.

## Overview

The AI Pajak database enforces 6 critical hard rules to maintain legal compliance and operational integrity:

1. **PLATFORM_ADMIN Cannot Access Tax Data**
2. **Consultant MUST Belong to Jakarta Tax Consulting**
3. **Tax Filing Actor ≠ Platform**
4. **Billing Collector ≠ Service Provider**
5. **Audit Trail Required**
6. **Legal Authorization via Power of Attorney**

Each rule is enforced through multiple layers of defense:
- Database schema constraints
- Row-Level Security (RLS) policies
- Triggers and functions
- Application-level validation

---

## Rule 1: PLATFORM_ADMIN Cannot Access Tax Data

### Purpose
Platform administrators (AI Pajak staff) must have ZERO access to customer tax data to maintain legal separation between the platform and tax service provider.

### Enforcement Layers

#### 1. Row-Level Security (RLS) Policies

**Tax Filing - Complete Blockade**
```sql
CREATE POLICY "Block platform admins from tax filing"
ON tax_filing FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:237-241`
- **Effect**: Platform admins cannot SELECT, INSERT, UPDATE, or DELETE tax filings
- **Scope**: All operations blocked

**Tax Documents - Complete Blockade**
```sql
CREATE POLICY "Block platform admins from tax documents"
ON tax_document FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:317-321`
- **Effect**: Platform admins cannot access tax documents
- **Scope**: All operations blocked

**Consultation Messages - Complete Blockade**
```sql
CREATE POLICY "Block platform admins from consultation messages"
ON consultation_message FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
```
- **Effect**: Platform admins cannot view customer-consultant communications

#### 2. Helper Functions

**Role Detection Function**
```sql
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'PLATFORM_ADMIN'
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:65-74`
- **Purpose**: Efficiently detect PLATFORM_ADMIN role
- **Security**: SECURITY DEFINER ensures consistent execution

#### 3. Allowed Access (Limited)

**Audit Logs - Read Only (Anonymized)**
```sql
CREATE POLICY "Platform admins can view audit logs"
ON tax_activity_log FOR SELECT
TO authenticated
USING (is_platform_admin());
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:374-377`
- **Effect**: Platform admins can view anonymized audit logs
- **Limitation**: No write access, customer data anonymized at application layer

### Testing

**Test Case 1: Platform Admin Attempts to View Tax Filing**
```sql
-- Setup: Login as platform admin
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO '<platform_admin_user_id>';

-- Attempt to view tax filings
SELECT * FROM tax_filing;
-- Expected: Empty result set (RLS blocks access)

-- Verify policy blocks access
SELECT COUNT(*) FROM tax_filing;
-- Expected: 0 (even if filings exist)
```

**Test Case 2: Platform Admin Attempts to Insert Tax Filing**
```sql
INSERT INTO tax_filing (customer_id, consultant_id, tax_type, tax_period, status)
VALUES ('<customer_id>', '<consultant_id>', 'PPh21', '2025-01', 'DRAFT');
-- Expected: ERROR - RLS policy violation
```

### Compliance Impact

- **Legal**: Ensures platform cannot be considered a tax service provider
- **Regulatory**: Meets Indonesian data protection requirements
- **Operational**: Forces strict separation of platform and tax operations

---

## Rule 2: Consultant MUST Belong to Jakarta Tax Consulting

### Purpose
Only consultants employed by Jakarta Tax Consulting (JTC) can process tax filings, ensuring regulatory compliance and quality control.

### Enforcement Layers

#### 1. Database Schema Constraints

**Foreign Key Constraint**
```sql
CREATE TABLE consultant (
    id UUID PRIMARY KEY,
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
    -- ... other fields
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:180-195`
- **Effect**: Every consultant MUST be linked to a tax partner
- **Enforcement**: Database-level referential integrity

#### 2. Row-Level Security (RLS) Policies

**Tax Filing - JTC Consultant Assignment Only**
```sql
CREATE POLICY "Only JTC consultants can be assigned"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
    consultant_id IN (
        SELECT c.id
        FROM consultant c
        JOIN tax_partner tp ON c.tax_partner_id = tp.id
        WHERE tp.name = 'Jakarta Tax Consulting'
        AND c.is_active = true
    )
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:299-310`
- **Effect**: Only active JTC consultants can be assigned to tax filings
- **Validation**: Joins to verify tax partner is JTC

**Consultant Updates**
```sql
CREATE POLICY "JTC consultants can update assigned filings"
ON tax_filing FOR UPDATE
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:286-296`
- **Effect**: Only the assigned JTC consultant can update filings

#### 3. Helper Functions

**JTC Consultant Detection**
```sql
CREATE OR REPLACE FUNCTION is_jtc_consultant()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('CONSULTANT_JTC', 'TAX_ADVISOR_JTC')
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:53-62`
- **Purpose**: Efficiently verify JTC consultant role

**Get Consultant ID**
```sql
CREATE OR REPLACE FUNCTION get_consultant_id()
RETURNS UUID AS $$
    SELECT id
    FROM consultant
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:86-93`
- **Purpose**: Get consultant ID for current user

#### 4. Application-Level Validation

**Email Domain Validation**
```sql
-- Email must match tax partner's email domain
CONSTRAINT consultant_email_domain CHECK (
    email LIKE '%@' || (
        SELECT email_domain FROM tax_partner WHERE id = tax_partner_id
    )
)
```
- **Purpose**: Ensure consultants use official JTC email addresses
- **Implementation**: Application-level validation in Next.js API

### Testing

**Test Case 1: Assign JTC Consultant to Tax Filing**
```sql
-- Valid: JTC consultant assignment
INSERT INTO tax_filing (
    customer_id,
    consultant_id,
    tax_type,
    tax_period,
    status
)
SELECT
    '<customer_id>',
    c.id,
    'PPh21',
    '2025-01',
    'DRAFT'
FROM consultant c
JOIN tax_partner tp ON c.tax_partner_id = tp.id
WHERE tp.name = 'Jakarta Tax Consulting'
AND c.is_active = true
LIMIT 1;
-- Expected: SUCCESS
```

**Test Case 2: Attempt to Assign Non-JTC Consultant**
```sql
-- Invalid: Non-JTC consultant (if future tax partners exist)
INSERT INTO tax_filing (customer_id, consultant_id, tax_type, tax_period)
VALUES ('<customer_id>', '<non_jtc_consultant_id>', 'PPh21', '2025-01');
-- Expected: ERROR - RLS policy violation
```

### Compliance Impact

- **Legal**: Ensures only licensed tax service provider processes filings
- **Regulatory**: Meets Indonesian tax consultant licensing requirements
- **Quality**: Maintains consistent service quality through JTC training

---

## Rule 3: Tax Filing Actor ≠ Platform

### Purpose
The platform (AI Pajak) cannot perform tax filing operations. Only Jakarta Tax Consulting can be the actor for tax-related activities.

### Enforcement Layers

#### 1. Database Schema Design

**Consultant Foreign Key**
```sql
CREATE TABLE tax_filing (
    consultant_id UUID NOT NULL REFERENCES consultant(id),
    -- Consultant MUST be from JTC (enforced by Rule 2)
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:258`
- **Effect**: All tax filings must have a consultant
- **Chain**: consultant → tax_partner → Jakarta Tax Consulting

#### 2. Audit Trail Constraint

**Platform Cannot Be Actor**
```sql
CREATE TABLE tax_activity_log (
    actor_organization_id UUID,
    -- Constraint: Cannot reference platform table
);

-- Check constraint (enforced at application level or trigger)
CREATE POLICY "Prevent platform as tax actor"
ON tax_activity_log FOR INSERT
WITH CHECK (
    actor_organization_id IS NULL OR
    actor_organization_id NOT IN (SELECT id FROM platform)
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000002_rls_policies.sql:347-355`
- **Effect**: Platform organization cannot be logged as actor in tax activities

#### 3. Row-Level Security (RLS)

**Combined with Rule 1**
- Platform admins blocked from accessing tax data (Rule 1)
- Therefore, platform cannot be actor in tax operations
- All tax operations must be performed by JTC consultants

### Testing

**Test Case 1: Verify Actor Organization**
```sql
-- Check that all tax activity logs have JTC as actor organization
SELECT
    tl.id,
    tl.actor_organization_id,
    tp.name as actor_org_name
FROM tax_activity_log tl
LEFT JOIN tax_partner tp ON tl.actor_organization_id = tp.id
WHERE tl.activity_type IN ('CREATE', 'UPDATE', 'FILE', 'REVIEW');
-- Expected: All actor_org_name = 'Jakarta Tax Consulting' or NULL
```

**Test Case 2: Attempt to Create Audit Log with Platform as Actor**
```sql
INSERT INTO tax_activity_log (
    customer_id,
    actor_user_id,
    actor_organization_id,
    actor_role,
    activity_type
)
VALUES (
    '<customer_id>',
    '<user_id>',
    (SELECT id FROM platform LIMIT 1), -- Platform as actor
    'SYSTEM',
    'UPDATE'
);
-- Expected: ERROR - Check constraint violation
```

### Compliance Impact

- **Legal**: Clear separation between platform operator and service provider
- **Liability**: Platform not liable for tax filing errors
- **Audit**: Complete trail showing only JTC performed tax operations

---

## Rule 4: Billing Collector ≠ Service Provider

### Purpose
Mono Flip Global (platform owner) collects payments but does not provide tax services. Jakarta Tax Consulting provides services but does not collect payments directly.

### Enforcement Layers

#### 1. Database Schema Design

**Separate Foreign Keys**
```sql
CREATE TABLE billing_transaction (
    platform_owner_id UUID NOT NULL REFERENCES platform_owner(id), -- Collector
    tax_partner_id UUID REFERENCES tax_partner(id), -- Provider (nullable)
    -- ... other fields
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:338-355`
- **Effect**: Clearly separates collector from service provider
- **Constraint**: Two distinct entities involved in each transaction

#### 2. Check Constraints

**Amount Split Validation**
```sql
CONSTRAINT valid_amount_split CHECK (
    amount_total = platform_fee + tax_service_fee
)
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:354`
- **Effect**: Ensures transparent fee breakdown

**Collector ≠ Provider Validation**
```sql
-- Application-level or trigger validation
CONSTRAINT collector_not_provider CHECK (
    platform_owner_id != tax_partner_id OR tax_partner_id IS NULL
)
```
- **Effect**: Prevents same entity from being both collector and provider

#### 3. Revenue Split Table

**Accounting Separation**
```sql
CREATE TABLE revenue_split (
    billing_transaction_id UUID NOT NULL,
    recipient_organization_id UUID NOT NULL,
    recipient_type revenue_recipient_type NOT NULL, -- PLATFORM_OWNER | TAX_PARTNER
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:367-378`
- **Effect**: Creates separate revenue records for each recipient
- **Audit**: Clear accounting trail for revenue distribution

#### 4. Transaction Type Logic

**Subscription vs Tax Service**
```sql
-- Subscription: platform_fee only
transaction_type = 'SUBSCRIPTION'
→ platform_fee > 0
→ tax_service_fee = 0
→ tax_partner_id IS NULL

-- Tax Service: both fees
transaction_type = 'TAX_SERVICE'
→ platform_fee > 0
→ tax_service_fee > 0
→ tax_partner_id IS NOT NULL
```

### Testing

**Test Case 1: Create Tax Service Transaction**
```sql
-- Valid: Separate collector and provider
INSERT INTO billing_transaction (
    customer_id,
    platform_owner_id,
    tax_partner_id,
    transaction_type,
    amount_total,
    platform_fee,
    tax_service_fee
)
VALUES (
    '<customer_id>',
    (SELECT id FROM platform_owner LIMIT 1), -- Mono Flip
    (SELECT id FROM tax_partner WHERE name = 'Jakarta Tax Consulting'),
    'TAX_SERVICE',
    1000000, -- 1 million IDR
    200000,  -- 20% platform fee
    800000   -- 80% to JTC
);
-- Expected: SUCCESS
```

**Test Case 2: Verify Revenue Splits Created**
```sql
-- Check revenue splits after transaction
SELECT
    rs.recipient_type,
    rs.amount,
    rs.description
FROM revenue_split rs
JOIN billing_transaction bt ON rs.billing_transaction_id = bt.id
WHERE bt.id = '<transaction_id>';
-- Expected:
-- PLATFORM_OWNER | 200000 | Platform Fee
-- TAX_PARTNER    | 800000 | Tax Service Fee
```

**Test Case 3: Attempt Invalid Transaction (Same Collector and Provider)**
```sql
-- Invalid: Same entity as both collector and provider
INSERT INTO billing_transaction (
    platform_owner_id,
    tax_partner_id,
    -- ... other fields
)
VALUES (
    '<same_entity_id>',
    '<same_entity_id>', -- Same as collector
    -- ...
);
-- Expected: ERROR - Check constraint violation
```

### Compliance Impact

- **Legal**: Clear collection agency model
- **Accounting**: Transparent revenue distribution
- **Regulatory**: Meets Indonesian payment processing regulations

---

## Rule 5: Audit Trail Required

### Purpose
All tax-related operations must be logged in an immutable audit trail for legal compliance and accountability.

### Enforcement Layers

#### 1. Database Triggers

**Automatic Audit Log Creation**
```sql
CREATE OR REPLACE FUNCTION log_tax_filing_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id UUID;
    v_actor_role user_role_type;
    v_actor_org_id UUID;
    v_activity_type activity_type;
BEGIN
    -- Get current user from Supabase auth context
    v_actor_user_id := auth.uid();

    -- Get user role and organization
    SELECT role, organization_id INTO v_actor_role, v_actor_org_id
    FROM user_roles
    WHERE user_id = v_actor_user_id AND is_active = true
    LIMIT 1;

    -- Determine activity type based on operation
    IF TG_OP = 'INSERT' THEN
        v_activity_type := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'FILED' AND OLD.status != 'FILED' THEN
            v_activity_type := 'FILE';
        ELSE
            v_activity_type := 'UPDATE';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_activity_type := 'DELETE';
    END IF;

    -- Insert audit log
    INSERT INTO tax_activity_log (
        customer_id,
        tax_filing_id,
        actor_user_id,
        actor_organization_id,
        actor_role,
        activity_type,
        tax_type,
        tax_period,
        activity_details
    ) VALUES (
        COALESCE(NEW.customer_id, OLD.customer_id),
        COALESCE(NEW.id, OLD.id),
        v_actor_user_id,
        v_actor_org_id,
        COALESCE(v_actor_role, 'SYSTEM'),
        v_activity_type,
        COALESCE(NEW.tax_type, OLD.tax_type),
        COALESCE(NEW.tax_period, OLD.tax_period),
        jsonb_build_object(
            'operation', TG_OP,
            'old_status', OLD.status,
            'new_status', NEW.status
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tax_filing_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON tax_filing
FOR EACH ROW EXECUTE FUNCTION log_tax_filing_activity();
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:480-543`
- **Effect**: Automatically creates audit log entries for all tax filing changes
- **Scope**: INSERT, UPDATE, DELETE operations

#### 2. Immutability Enforcement

**No UPDATE or DELETE Allowed**
```sql
-- No UPDATE policy defined for tax_activity_log
-- No DELETE policy defined for tax_activity_log
-- Only SELECT and INSERT policies exist

CREATE TRIGGER prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON tax_activity_log
FOR EACH ROW EXECUTE FUNCTION prevent_modification();
```
- **Effect**: Audit logs cannot be modified or deleted
- **Permanence**: Complete historical record maintained

#### 3. Captured Information

**Audit Log Fields**
- **WHO**: `actor_user_id`, `actor_role`
- **WHICH ORGANIZATION**: `actor_organization_id`
- **WHAT**: `activity_type`, `activity_details` (JSONB)
- **WHEN**: `created_at` (automatic timestamp)
- **WHERE**: `ip_address`, `user_agent`
- **CONTEXT**: `customer_id`, `tax_filing_id`, `tax_type`, `tax_period`

### Testing

**Test Case 1: Create Tax Filing - Verify Audit Log**
```sql
-- Create tax filing
INSERT INTO tax_filing (customer_id, consultant_id, tax_type, tax_period, status)
VALUES ('<customer_id>', '<consultant_id>', 'PPh21', '2025-01', 'DRAFT');

-- Verify audit log created
SELECT
    activity_type,
    actor_role,
    tax_type,
    tax_period,
    activity_details
FROM tax_activity_log
WHERE tax_filing_id = '<filing_id>'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: activity_type = 'CREATE', tax_type = 'PPh21'
```

**Test Case 2: Update Tax Filing Status - Verify Audit Log**
```sql
-- Update filing status
UPDATE tax_filing
SET status = 'FILED'
WHERE id = '<filing_id>';

-- Verify audit log created
SELECT
    activity_type,
    activity_details->'old_status' as old_status,
    activity_details->'new_status' as new_status
FROM tax_activity_log
WHERE tax_filing_id = '<filing_id>'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: activity_type = 'FILE', old_status = 'DRAFT', new_status = 'FILED'
```

**Test Case 3: Attempt to Modify Audit Log**
```sql
-- Attempt to update audit log
UPDATE tax_activity_log
SET activity_details = '{}'
WHERE id = '<log_id>';
-- Expected: ERROR - Trigger prevents modification

-- Attempt to delete audit log
DELETE FROM tax_activity_log
WHERE id = '<log_id>';
-- Expected: ERROR - Trigger prevents deletion
```

### Compliance Impact

- **Legal**: Complete audit trail for regulatory compliance
- **Forensics**: Full history of all tax-related activities
- **Accountability**: Clear attribution of all actions

---

## Rule 6: Legal Authorization via Power of Attorney

### Purpose
Tax filings can only be submitted to DJP (Indonesian tax authority) if there is an active Power of Attorney (POA) authorizing Jakarta Tax Consulting to act on behalf of the customer.

### Enforcement Layers

#### 1. Database Schema Design

**POA Foreign Key**
```sql
CREATE TABLE tax_filing (
    power_of_attorney_id UUID REFERENCES power_of_attorney(id),
    -- Required for FILED status
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000001_initial_schema.sql:256-269`
- **Effect**: Links tax filings to POA

**POA Table**
```sql
CREATE TABLE power_of_attorney (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customer(id),
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
    poa_number VARCHAR(50) UNIQUE NOT NULL,
    scope VARCHAR(50) NOT NULL, -- ALL_TAX_TYPES | PPh21_ONLY | etc.
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(50) NOT NULL, -- DRAFT | ACTIVE | EXPIRED | REVOKED
    document_url TEXT,
    document_hash VARCHAR(64), -- SHA-256 hash
    customer_signed_at TIMESTAMP WITH TIME ZONE,
    tax_partner_signed_at TIMESTAMP WITH TIME ZONE
);
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000004_power_of_attorney.sql`

#### 2. Validation Triggers

**POA Validation Function**
```sql
CREATE OR REPLACE FUNCTION has_active_poa(
    p_customer_id UUID,
    p_tax_type VARCHAR,
    p_tax_partner_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM power_of_attorney
        WHERE customer_id = p_customer_id
        AND tax_partner_id = p_tax_partner_id
        AND status = 'ACTIVE'
        AND CURRENT_DATE BETWEEN valid_from AND valid_to
        AND (scope = 'ALL_TAX_TYPES' OR scope = p_tax_type || '_ONLY')
    );
END;
$$ LANGUAGE plpgsql;
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000004_power_of_attorney.sql`
- **Purpose**: Check if customer has active POA for tax type

**Filing Validation Trigger**
```sql
CREATE OR REPLACE FUNCTION validate_tax_filing_poa()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status is FILED or UNDER_REVIEW
    IF NEW.status IN ('FILED', 'UNDER_REVIEW') THEN
        -- Require POA
        IF NEW.power_of_attorney_id IS NULL THEN
            RAISE EXCEPTION 'Power of Attorney required for status %', NEW.status;
        END IF;

        -- Validate POA is active
        IF NOT has_active_poa(
            NEW.customer_id,
            NEW.tax_type::VARCHAR,
            (SELECT tax_partner_id FROM consultant WHERE id = NEW.consultant_id)
        ) THEN
            RAISE EXCEPTION 'Active Power of Attorney required for tax filing';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_tax_filing_poa
BEFORE INSERT OR UPDATE ON tax_filing
FOR EACH ROW
WHEN (NEW.status IN ('FILED', 'UNDER_REVIEW'))
EXECUTE FUNCTION validate_tax_filing_poa();
```
- **File**: `/Users/tommy/git/ai-pajak/supabase/migrations/20251223000004_power_of_attorney.sql`
- **Effect**: Prevents tax filing submission without active POA

#### 3. POA Status Management

**Auto-Expiration**
```sql
CREATE OR REPLACE FUNCTION auto_expire_poa()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-expire POA if current date > valid_to
    IF CURRENT_DATE > NEW.valid_to AND NEW.status = 'ACTIVE' THEN
        NEW.status := 'EXPIRED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_expire_poa_trigger
BEFORE UPDATE ON power_of_attorney
FOR EACH ROW
EXECUTE FUNCTION auto_expire_poa();
```
- **Effect**: Automatically expires POAs when validity period ends

**Status Validation**
```sql
CREATE OR REPLACE FUNCTION validate_poa_status()
RETURNS TRIGGER AS $$
BEGIN
    -- ACTIVE requires both signatures and valid dates
    IF NEW.status = 'ACTIVE' THEN
        IF NEW.customer_signed_at IS NULL OR NEW.tax_partner_signed_at IS NULL THEN
            RAISE EXCEPTION 'POA requires both signatures to be ACTIVE';
        END IF;
        IF CURRENT_DATE NOT BETWEEN NEW.valid_from AND NEW.valid_to THEN
            RAISE EXCEPTION 'POA dates not valid for ACTIVE status';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 4. Document Verification

**SHA-256 Hashing**
```sql
-- Document hash for integrity verification
document_hash VARCHAR(64) -- SHA-256 hash of POA document
```
- **Purpose**: Ensures POA document hasn't been tampered with
- **Implementation**: Application-level hash generation on upload

### Testing

**Test Case 1: Create POA and File Tax**
```sql
-- Step 1: Create POA
INSERT INTO power_of_attorney (
    customer_id,
    tax_partner_id,
    poa_number,
    scope,
    valid_from,
    valid_to,
    status
)
VALUES (
    '<customer_id>',
    (SELECT id FROM tax_partner WHERE name = 'Jakarta Tax Consulting'),
    'POA-2025-000001',
    'ALL_TAX_TYPES',
    '2025-01-01',
    '2025-12-31',
    'DRAFT'
);

-- Step 2: Customer signs
UPDATE power_of_attorney
SET customer_signed_at = NOW(),
    status = 'PENDING_TAX_PARTNER_SIGNATURE'
WHERE poa_number = 'POA-2025-000001';

-- Step 3: Tax partner signs
UPDATE power_of_attorney
SET tax_partner_signed_at = NOW(),
    status = 'ACTIVE'
WHERE poa_number = 'POA-2025-000001';

-- Step 4: File tax with POA
INSERT INTO tax_filing (
    customer_id,
    consultant_id,
    power_of_attorney_id,
    tax_type,
    tax_period,
    status
)
VALUES (
    '<customer_id>',
    '<consultant_id>',
    (SELECT id FROM power_of_attorney WHERE poa_number = 'POA-2025-000001'),
    'PPh21',
    '2025-01',
    'FILED'
);
-- Expected: SUCCESS
```

**Test Case 2: Attempt to File Without POA**
```sql
-- Attempt to file without POA
INSERT INTO tax_filing (
    customer_id,
    consultant_id,
    power_of_attorney_id, -- NULL
    tax_type,
    tax_period,
    status
)
VALUES (
    '<customer_id>',
    '<consultant_id>',
    NULL,
    'PPh21',
    '2025-01',
    'FILED'
);
-- Expected: ERROR - Power of Attorney required
```

**Test Case 3: Attempt to File with Expired POA**
```sql
-- Create expired POA
INSERT INTO power_of_attorney (
    customer_id,
    tax_partner_id,
    valid_from,
    valid_to,
    status
)
VALUES (
    '<customer_id>',
    '<tax_partner_id>',
    '2024-01-01',
    '2024-12-31', -- Expired
    'EXPIRED'
);

-- Attempt to file with expired POA
INSERT INTO tax_filing (
    customer_id,
    consultant_id,
    power_of_attorney_id,
    status
)
VALUES (..., 'FILED');
-- Expected: ERROR - Active POA required
```

### Compliance Impact

- **Legal**: Meets Indonesian tax law requirements for POA
- **Authorization**: Clear legal authorization before filing
- **Audit**: Complete trail of POA creation, signatures, and usage

---

## Summary Table

| Hard Rule | Primary Enforcement | Secondary Enforcement | Testing Priority |
|-----------|---------------------|----------------------|------------------|
| 1. PLATFORM_ADMIN Cannot Access Tax Data | RLS policies (ALL operations blocked) | Helper functions, Application-level checks | HIGH |
| 2. Consultant MUST Belong to JTC | FK constraint, RLS policies | Email domain validation | HIGH |
| 3. Tax Filing Actor ≠ Platform | Schema design (consultant FK), RLS policies | Audit log constraints | MEDIUM |
| 4. Billing Collector ≠ Service Provider | Separate FK columns, Revenue split table | Check constraints | HIGH |
| 5. Audit Trail Required | Automatic triggers, Immutability policies | No DELETE/UPDATE policies | HIGH |
| 6. Legal Authorization via POA | POA validation triggers, Status management | Document hashing, Auto-expiration | HIGH |

---

## Verification Queries

### Verify Rule 1: Platform Admins Blocked
```sql
-- Check RLS policies exist
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('tax_filing', 'tax_document', 'consultation_message')
AND policyname LIKE '%platform admin%';
```

### Verify Rule 2: All Consultants from JTC
```sql
-- Verify all consultants belong to JTC
SELECT
    c.id,
    c.full_name,
    tp.name as tax_partner_name
FROM consultant c
JOIN tax_partner tp ON c.tax_partner_id = tp.id
WHERE tp.name != 'Jakarta Tax Consulting';
-- Expected: Empty result set
```

### Verify Rule 4: Revenue Splits Correct
```sql
-- Verify revenue splits sum to transaction amount
SELECT
    bt.id,
    bt.amount_total,
    SUM(rs.amount) as split_total,
    bt.amount_total - SUM(rs.amount) as difference
FROM billing_transaction bt
JOIN revenue_split rs ON rs.billing_transaction_id = bt.id
GROUP BY bt.id, bt.amount_total
HAVING bt.amount_total != SUM(rs.amount);
-- Expected: Empty result set
```

### Verify Rule 5: Audit Logs Immutable
```sql
-- Check no UPDATE or DELETE policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'tax_activity_log'
AND cmd IN ('UPDATE', 'DELETE');
-- Expected: Empty result set
```

### Verify Rule 6: FILED Filings Have POA
```sql
-- Check all FILED filings have active POA
SELECT
    tf.id,
    tf.status,
    tf.power_of_attorney_id,
    poa.status as poa_status
FROM tax_filing tf
LEFT JOIN power_of_attorney poa ON tf.power_of_attorney_id = poa.id
WHERE tf.status IN ('FILED', 'UNDER_REVIEW')
AND (tf.power_of_attorney_id IS NULL OR poa.status != 'ACTIVE');
-- Expected: Empty result set
```

---

## Next Steps

- Review [erd-overview.md](erd-overview.md) for complete ERD
- Review [data-dictionary.md](data-dictionary.md) for schema details
- Review [schema-migrations.md](schema-migrations.md) for implementation
- Run verification queries to validate enforcement
