# Data Dictionary

**Version**: 1.0
**Date**: 2025-12-23

Complete reference for all database tables, columns, data types, constraints, and indexes.

## Table of Contents

### Core Entities
- [platform_owner](#platform_owner)
- [platform](#platform)
- [tax_partner](#tax_partner)
- [user_roles](#user_roles)
- [consultant](#consultant)
- [tax_advisor](#tax_advisor)
- [customer](#customer)

### Tax Operations
- [power_of_attorney](#power_of_attorney)
- [tax_filing](#tax_filing)
- [tax_document](#tax_document)
- [tax_activity_log](#tax_activity_log)

### Billing
- [billing_transaction](#billing_transaction)
- [revenue_split](#revenue_split)
- [subscription](#subscription)

### Communication
- [consultation_message](#consultation_message)

### Enumerations
- [ENUM Types](#enum-types)

---

## Core Entities

### platform_owner

**Purpose**: Represents Mono Flip Global, the legal entity that owns the platform and collects payments.

**Hard Rule**: Single instance entity (enforced by unique index).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `name` | VARCHAR(255) | NO | 'Mono Flip Global' | | Display name |
| `legal_name` | VARCHAR(255) | NO | | | Full legal entity name |
| `npwp` | VARCHAR(16) | NO | | UNIQUE | Indonesian tax ID |
| `address` | TEXT | YES | | | Legal business address |
| `email` | VARCHAR(255) | YES | | | Contact email |
| `phone` | VARCHAR(50) | YES | | | Contact phone |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_single_platform_owner` UNIQUE on `((1))` - enforces single row

**Triggers**:
- `update_platform_owner_updated_at` - Updates `updated_at` on changes

**Comments**: "Mono Flip Global - Billing collection entity (NOT service provider)"

---

### platform

**Purpose**: Represents AI Pajak, the software platform operated by the platform owner.

**Hard Rule**: Single instance entity (enforced by unique index).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `platform_owner_id` | UUID | NO | | FK → platform_owner(id) | Platform owner reference |
| `name` | VARCHAR(255) | NO | 'AI Pajak' | | Display name |
| `domain` | VARCHAR(255) | NO | 'ai-pajak.com' | UNIQUE | Platform domain |
| `service_agreement_url` | TEXT | YES | | | Terms of service URL |
| `is_active` | BOOLEAN | NO | true | | Active status |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_single_platform` UNIQUE on `((1))` - enforces single row
- Foreign key index on `platform_owner_id`

**Triggers**:
- `update_platform_updated_at` - Updates `updated_at` on changes

**Comments**: "AI Pajak - Software platform (NO tax filing authority)"

---

### tax_partner

**Purpose**: Represents Jakarta Tax Consulting, the licensed tax service provider.

**Hard Rule**: Single active instance (Jakarta Tax Consulting), extensible for future partners.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `platform_id` | UUID | NO | | FK → platform(id) | Platform reference |
| `name` | VARCHAR(255) | NO | 'Jakarta Tax Consulting' | | Display name |
| `legal_name` | VARCHAR(255) | NO | | | Full legal entity name |
| `tax_license_number` | VARCHAR(100) | NO | | UNIQUE | Tax filing license |
| `npwp` | VARCHAR(16) | NO | | UNIQUE | Indonesian tax ID |
| `email_domain` | VARCHAR(100) | NO | | UNIQUE | Official email domain |
| `address` | TEXT | YES | | | Legal business address |
| `email` | VARCHAR(255) | YES | | | Contact email |
| `phone` | VARCHAR(50) | YES | | | Contact phone |
| `is_active` | BOOLEAN | NO | true | | Active status |
| `partnership_start_date` | DATE | NO | | | Partnership start date |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_tax_license` UNIQUE on `tax_license_number`
- `unique_npwp` UNIQUE on `npwp`
- Foreign key index on `platform_id`
- Index on `email_domain`

**Triggers**:
- `update_tax_partner_updated_at` - Updates `updated_at` on changes

**Comments**: "Jakarta Tax Consulting - Tax service provider (SOLE authority for tax filing)"

---

### user_roles

**Purpose**: Multi-role authorization system linking users to organizations and permissions.

**Authentication**: Integrates with Auth provider's users table (TBD: Firebase/Supabase/Clerk).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `user_id` | UUID | NO | | FK → auth.users(id) ON DELETE CASCADE | User reference |
| `role` | user_role_type | NO | | ENUM | Role type |
| `organization_id` | UUID | YES | | | Organization reference (polymorphic) |
| `organization_type` | organization_type | YES | | ENUM | TAX_PARTNER or PLATFORM |
| `is_active` | BOOLEAN | NO | true | | Role active status |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Role assignment timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_user_role` UNIQUE on `(user_id, role, organization_id)`
- `idx_user_roles_user_id` on `user_id`
- `idx_user_roles_role` on `role`
- `idx_user_roles_organization` on `(organization_id, organization_type)`

**Triggers**:
- `update_user_roles_updated_at` - Updates `updated_at` on changes

---

### consultant

**Purpose**: Tax consultants employed by Jakarta Tax Consulting to process customer tax filings.

**Hard Rule**: Must be employed by Jakarta Tax Consulting (enforced by RLS and application logic).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `tax_partner_id` | UUID | NO | | FK → tax_partner(id) | Must be JTC |
| `user_id` | UUID | NO | | FK → auth.users(id) ON DELETE CASCADE, UNIQUE | User reference |
| `employee_id` | VARCHAR(50) | YES | | | JTC employee ID |
| `full_name` | VARCHAR(255) | NO | | | Full legal name |
| `email` | VARCHAR(255) | NO | | UNIQUE | Official JTC email |
| `phone` | VARCHAR(50) | YES | | | Contact phone |
| `is_active` | BOOLEAN | NO | true | | Employment status |
| `employment_start_date` | DATE | NO | | | Employment start date |
| `employment_end_date` | DATE | YES | | | Employment end date |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Profile creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_consultant_user` UNIQUE on `user_id`
- `unique_consultant_email` UNIQUE on `email`
- `idx_consultant_tax_partner` on `tax_partner_id`
- `idx_consultant_user` on `user_id`
- `idx_consultant_active` on `is_active WHERE is_active = true`

**Triggers**:
- `update_consultant_updated_at` - Updates `updated_at` on changes

**Comments**: "Employees of Jakarta Tax Consulting who process tax filings"

---

### tax_advisor

**Purpose**: Licensed tax advisors who can review and approve tax filings.

**Hard Rule**: Must reference a valid consultant with verified license.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `consultant_id` | UUID | NO | | FK → consultant(id), UNIQUE | Consultant reference |
| `license_number` | VARCHAR(100) | NO | | UNIQUE | Tax advisor license number |
| `license_type` | VARCHAR(100) | NO | | | Brevet A/B/C, CPA, etc. |
| `license_expiry_date` | DATE | YES | | | License expiration date |
| `is_verified` | BOOLEAN | NO | false | | Manual verification status |
| `verified_by_user_id` | UUID | YES | | FK → auth.users(id) | Verifier reference |
| `verified_at` | TIMESTAMP WITH TIME ZONE | YES | | | Verification timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | License registration timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_license_number` UNIQUE on `license_number`
- `unique_consultant_advisor` UNIQUE on `consultant_id`
- `idx_tax_advisor_consultant` on `consultant_id`
- `idx_tax_advisor_verified` on `is_verified WHERE is_verified = true`

**Triggers**:
- `update_tax_advisor_updated_at` - Updates `updated_at` on changes

**Comments**: "Licensed tax professionals (Brevet/CPA) who review/approve filings"

---

### customer

**Purpose**: Customer profile information for individuals and companies using the platform.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `user_id` | UUID | NO | | FK → auth.users(id) ON DELETE CASCADE, UNIQUE | User reference |
| `customer_type` | customer_type | NO | | ENUM | INDIVIDUAL or COMPANY |
| `npwp` | VARCHAR(16) | YES | | | Indonesian tax ID (15 digits) |
| `full_name` | VARCHAR(255) | NO | | | Full legal name |
| `company_name` | VARCHAR(255) | YES | | | Company name (if COMPANY type) |
| `email` | VARCHAR(255) | NO | | | Contact email |
| `phone` | VARCHAR(50) | YES | | | Contact phone number |
| `address` | TEXT | YES | | | Contact address |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Profile creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_customer_user` UNIQUE on `user_id`
- `idx_customer_user` on `user_id`
- `idx_customer_npwp` on `npwp WHERE npwp IS NOT NULL`
- `idx_customer_type` on `customer_type`

**Constraints**:
- `company_requires_name` CHECK: If `customer_type = 'COMPANY'`, then `company_name IS NOT NULL`

**Triggers**:
- `update_customer_updated_at` - Updates `updated_at` on changes

---

## Tax Operations

### power_of_attorney

**Purpose**: Legal authorization document allowing Jakarta Tax Consulting to file taxes on behalf of customers.

**Hard Rule**: Required before tax filing can be submitted to DJP (status: FILED).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer granting authorization |
| `tax_partner_id` | UUID | NO | | FK → tax_partner(id) | Tax partner receiving authorization |
| `poa_number` | VARCHAR(50) | NO | | UNIQUE | POA-YYYY-NNNNNN format |
| `scope` | VARCHAR(50) | NO | | ENUM | Authorization scope |
| `valid_from` | DATE | NO | | | Authorization start date |
| `valid_to` | DATE | NO | | CHECK: > valid_from | Authorization end date |
| `status` | VARCHAR(50) | NO | 'DRAFT' | ENUM | POA status |
| `document_url` | TEXT | YES | | | Signed POA document URL |
| `document_hash` | VARCHAR(64) | YES | | | SHA-256 hash of document |
| `customer_signed_at` | TIMESTAMP WITH TIME ZONE | YES | | | Customer signature timestamp |
| `tax_partner_signed_at` | TIMESTAMP WITH TIME ZONE | YES | | | Tax partner signature timestamp |
| `customer_ip_address` | INET | YES | | | Customer IP at signing |
| `tax_partner_ip_address` | INET | YES | | | Tax partner IP at signing |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_poa_number` UNIQUE on `poa_number`
- `idx_poa_customer` on `customer_id`
- `idx_poa_tax_partner` on `tax_partner_id`
- `idx_poa_status` on `status`
- `idx_poa_validity` on `(valid_from, valid_to)`
- Composite index on `(customer_id, status, valid_to)`

**Triggers**:
- `validate_poa_status()` - Validates status transitions
- `auto_expire_poa()` - Auto-expires POA when current date > valid_to
- `audit_poa_changes()` - Creates audit log entries

**Migration File**: `prisma/migrations/20251223000004_power_of_attorney.sql`

---

### tax_filing

**Purpose**: Represents a customer's tax filing submission, processed by JTC consultants.

**Hard Rule**:
- Consultant must be from Jakarta Tax Consulting
- Must have active POA for FILED status
- PLATFORM_ADMIN has NO ACCESS

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer submitting filing |
| `consultant_id` | UUID | NO | | FK → consultant(id) | JTC consultant processing |
| `tax_advisor_id` | UUID | YES | | FK → tax_advisor(id) | Licensed advisor (optional) |
| `power_of_attorney_id` | UUID | YES | | FK → power_of_attorney(id) | Required for FILED status |
| `tax_type` | tax_type | NO | | ENUM | Type of tax filing |
| `tax_period` | VARCHAR(7) | NO | | | YYYY-MM or YYYY format |
| `status` | tax_filing_status | NO | 'DRAFT' | ENUM | Filing status |
| `tax_data` | JSONB | NO | '{}' | | Encrypted sensitive tax data |
| `bpe_number` | VARCHAR(50) | YES | | UNIQUE | BPE number from DJP |
| `filed_at` | TIMESTAMP WITH TIME ZONE | YES | | | Submission timestamp to DJP |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_customer_tax_period` UNIQUE on `(customer_id, tax_type, tax_period)`
- `idx_tax_filing_customer` on `customer_id`
- `idx_tax_filing_consultant` on `consultant_id`
- `idx_tax_filing_tax_advisor` on `tax_advisor_id`
- `idx_tax_filing_status` on `status`
- `idx_tax_filing_period` on `tax_period`
- `idx_tax_filing_type` on `tax_type`
- GIN index on `tax_data` (JSONB queries)

**Triggers**:
- `validate_consultant_jtc()` - Ensures consultant belongs to JTC
- `validate_tax_filing_poa()` - Validates active POA before FILED status
- `audit_tax_filing_changes()` - Creates audit log entries (see `tax_filing_audit_trigger`)
- `update_tax_filing_updated_at` - Updates `updated_at` on changes

**Comments**: "PROTECTED: Tax filing data - PLATFORM_ADMIN has NO ACCESS"

---

### tax_document

**Purpose**: Supporting documents uploaded for tax filing.

**Hard Rule**: PLATFORM_ADMIN has NO ACCESS.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `tax_filing_id` | UUID | NO | | FK → tax_filing(id) ON DELETE CASCADE | Tax filing reference |
| `uploaded_by_user_id` | UUID | NO | | FK → auth.users(id) | User who uploaded |
| `document_type` | VARCHAR(100) | NO | | | Document type (enum-like) |
| `file_path` | TEXT | NO | | | Encrypted storage path |
| `file_name` | VARCHAR(255) | NO | | | Original filename |
| `mime_type` | VARCHAR(100) | NO | | | File MIME type |
| `file_size_bytes` | INTEGER | NO | | CHECK: > 0 | File size in bytes |
| `ocr_data` | JSONB | YES | | | Extracted OCR data |
| `uploaded_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Upload timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Creation timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_tax_document_filing` on `tax_filing_id`
- `idx_tax_document_uploaded_by` on `uploaded_by_user_id`
- `idx_tax_document_type` on `document_type`
- GIN index on `ocr_data` (JSONB queries)

**Triggers**:
- `audit_document_upload()` - Creates audit log entry on upload
- `cascade_delete_document()` - Deletes file from storage on record deletion

**Comments**: "PROTECTED: Tax documents - PLATFORM_ADMIN has NO ACCESS"

---

### tax_activity_log

**Purpose**: Comprehensive audit trail for all tax-related activities.

**Hard Rule**:
- MANDATORY for all tax operations
- IMMUTABLE (cannot be modified or deleted)
- Platform cannot be actor organization

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer whose data is accessed |
| `tax_filing_id` | UUID | YES | | FK → tax_filing(id) | Related tax filing (if applicable) |
| `actor_user_id` | UUID | NO | | FK → auth.users(id) | WHO did it |
| `actor_organization_id` | UUID | YES | | | Organization ID (polymorphic) |
| `actor_role` | user_role_type | NO | | ENUM | Actor's role at time of action |
| `activity_type` | activity_type | NO | | ENUM | Type of activity |
| `tax_type` | tax_type | YES | | ENUM | Tax type (if applicable) |
| `tax_period` | VARCHAR(7) | YES | | | Tax period (if applicable) |
| `activity_details` | JSONB | YES | '{}' | | Additional context |
| `ip_address` | INET | YES | | | Actor's IP address |
| `user_agent` | TEXT | YES | | | Actor's user agent |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Activity timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_tax_log_customer` on `customer_id`
- `idx_tax_log_filing` on `tax_filing_id`
- `idx_tax_log_actor` on `actor_user_id`
- `idx_tax_log_organization` on `actor_organization_id`
- `idx_tax_log_activity_type` on `activity_type`
- `idx_tax_log_created_at` on `created_at DESC`
- GIN index on `activity_details` (JSONB queries)

**Constraints**:
- CHECK: `actor_organization_id NOT IN (SELECT id FROM platform)` (Hard Rule 3)

**Triggers**:
- `prevent_audit_log_modification()` - Blocks UPDATE and DELETE operations

**Comments**: "MANDATORY: Audit trail for all tax activities - Cannot be deleted"

---

## Billing

### billing_transaction

**Purpose**: Records all financial transactions between customers, platform owner (collector), and tax partner (service provider).

**Hard Rule**: Platform Owner (collector) ≠ Tax Partner (service provider).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer making payment |
| `platform_owner_id` | UUID | NO | | FK → platform_owner(id) | Mono Flip Global (collector) |
| `tax_partner_id` | UUID | YES | | FK → tax_partner(id) | JTC (service provider) |
| `transaction_type` | transaction_type | NO | | ENUM | SUBSCRIPTION or TAX_SERVICE |
| `amount_total` | DECIMAL(15,2) | NO | | CHECK: > 0 | Total amount in IDR |
| `platform_fee` | DECIMAL(15,2) | NO | 0 | CHECK: >= 0 | Fee to platform owner |
| `tax_service_fee` | DECIMAL(15,2) | NO | 0 | CHECK: >= 0 | Fee to tax partner |
| `currency` | VARCHAR(3) | NO | 'IDR' | CHECK: = 'IDR' | Currency code |
| `payment_status` | payment_status | NO | 'PENDING' | ENUM | Payment status |
| `payment_method` | VARCHAR(50) | YES | | | Payment method used |
| `payment_reference` | VARCHAR(255) | YES | | UNIQUE | Payment gateway reference |
| `paid_at` | TIMESTAMP WITH TIME ZONE | YES | | | Payment completion timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Transaction creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_billing_customer` on `customer_id`
- `idx_billing_platform_owner` on `platform_owner_id`
- `idx_billing_tax_partner` on `tax_partner_id`
- `idx_billing_status` on `payment_status`
- `idx_billing_created_at` on `created_at DESC`
- UNIQUE index on `payment_reference`

**Constraints**:
- `valid_amount_split` CHECK: `amount_total = platform_fee + tax_service_fee`
- CHECK: `platform_owner_id != tax_partner_id OR tax_partner_id IS NULL` (Hard Rule 4)

**Triggers**:
- `create_revenue_splits()` - Auto-creates revenue split records on PAID status
- `update_subscription_status()` - Updates subscription status on payment
- `audit_transaction_changes()` - Creates audit log entries
- `update_billing_transaction_updated_at` - Updates `updated_at` on changes

**Comments**: "Payment collection by Mono Flip Global (collector ≠ provider)"

---

### revenue_split

**Purpose**: Tracks revenue distribution from billing transactions to recipient organizations.

**Hard Rule**: Automatic creation when transaction status = PAID, immutable after creation.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `billing_transaction_id` | UUID | NO | | FK → billing_transaction(id) | Source transaction |
| `recipient_organization_id` | UUID | NO | | | Recipient ID (polymorphic) |
| `recipient_type` | revenue_recipient_type | NO | | ENUM | PLATFORM_OWNER or TAX_PARTNER |
| `amount` | DECIMAL(15,2) | NO | | CHECK: > 0 | Amount to recipient |
| `description` | TEXT | YES | | | Description of split |
| `accounting_status` | accounting_status | NO | 'PENDING' | ENUM | Accounting status |
| `transferred_at` | TIMESTAMP WITH TIME ZONE | YES | | | Transfer completion timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Split creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_revenue_split_transaction` on `billing_transaction_id`
- `idx_revenue_split_recipient` on `recipient_organization_id`
- `idx_revenue_split_status` on `accounting_status`
- Composite index on `(recipient_type, accounting_status, created_at DESC)`

**Triggers**:
- `validate_revenue_split_sum()` - Ensures splits sum to transaction amount
- `prevent_revenue_split_modification()` - Blocks updates and deletes
- `update_revenue_split_updated_at` - Updates `updated_at` on changes

**Comments**: "Accounting separation: platform fees vs tax service fees"

---

### subscription

**Purpose**: Manages customer subscription plans for platform access and features.

**Hard Rule**: One active subscription per customer.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer reference |
| `plan_type` | subscription_plan | NO | 'FREE' | ENUM | Subscription plan |
| `billing_cycle` | billing_cycle | YES | | ENUM | MONTHLY or ANNUAL |
| `price` | DECIMAL(15,2) | NO | 0 | CHECK: >= 0 | Plan price per cycle |
| `current_period_start` | TIMESTAMP WITH TIME ZONE | YES | | | Current billing period start |
| `current_period_end` | TIMESTAMP WITH TIME ZONE | YES | | CHECK: > period_start | Current billing period end |
| `is_active` | BOOLEAN | NO | true | | Subscription active status |
| `cancelled_at` | TIMESTAMP WITH TIME ZONE | YES | | | Cancellation timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Subscription creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Last update timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `unique_active_subscription` UNIQUE on `customer_id WHERE is_active = true`
- `idx_subscription_customer` on `customer_id`
- `idx_subscription_plan` on `plan_type`
- `idx_subscription_active` on `is_active WHERE is_active = true`

**Triggers**:
- `auto_create_free_subscription()` - Creates FREE subscription on customer registration
- `renew_subscription()` - Auto-renews subscription on period end
- `create_subscription_transaction()` - Creates billing transaction on renewal
- `update_subscription_updated_at` - Updates `updated_at` on changes

---

## Communication

### consultation_message

**Purpose**: Enables communication between customers and JTC consultants for tax-related questions and support.

**Hard Rule**: PLATFORM_ADMIN has NO ACCESS to message content.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| `customer_id` | UUID | NO | | FK → customer(id) | Customer in conversation |
| `consultant_id` | UUID | YES | | FK → consultant(id) | JTC consultant (NULL if unassigned) |
| `tax_filing_id` | UUID | YES | | FK → tax_filing(id) | Related tax filing (optional) |
| `message_type` | VARCHAR(50) | NO | | | Message type (enum-like) |
| `message_content` | TEXT | NO | | CHECK: length 1-5000 | Message body |
| `is_from_customer` | BOOLEAN | NO | | | Direction indicator |
| `is_read` | BOOLEAN | NO | false | | Read status |
| `sent_at` | TIMESTAMP WITH TIME ZONE | NO | NOW() | | Message send timestamp |
| `read_at` | TIMESTAMP WITH TIME ZONE | YES | | | Message read timestamp |

**Indexes**:
- `PRIMARY KEY` on `id`
- `idx_consultation_customer` on `customer_id`
- `idx_consultation_consultant` on `consultant_id`
- `idx_consultation_filing` on `tax_filing_id`
- `idx_consultation_unread` on `is_read WHERE is_read = false`
- `idx_consultation_sent_at` on `sent_at DESC`
- Composite index on `(customer_id, sent_at DESC)`
- Composite index on `(is_from_customer, is_read, sent_at DESC)`

**Triggers**:
- `auto_assign_consultant()` - Auto-assigns available consultant if NULL
- `notify_recipient()` - Sends notification to recipient (email/push)
- `audit_message_access()` - Logs message access (read events)

---

## ENUM Types

### user_role_type
```sql
CREATE TYPE user_role_type AS ENUM (
    'CUSTOMER',
    'CONSULTANT_JTC',
    'TAX_ADVISOR_JTC',
    'PLATFORM_ADMIN',
    'SYSTEM'
);
```

### customer_type
```sql
CREATE TYPE customer_type AS ENUM (
    'INDIVIDUAL',
    'COMPANY'
);
```

### tax_type
```sql
CREATE TYPE tax_type AS ENUM (
    'PPh21',     -- Income tax article 21 (employee)
    'PPh23',     -- Income tax article 23 (services)
    'PPh_FINAL', -- Final income tax
    'PPN',       -- Value-added tax
    'SPT_MASA',  -- Monthly tax return
    'SPT_TAHUNAN' -- Annual tax return
);
```

### tax_filing_status
```sql
CREATE TYPE tax_filing_status AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'FILED',
    'REJECTED'
);
```

### transaction_type
```sql
CREATE TYPE transaction_type AS ENUM (
    'SUBSCRIPTION',
    'TAX_SERVICE'
);
```

### payment_status
```sql
CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);
```

### organization_type
```sql
CREATE TYPE organization_type AS ENUM (
    'PLATFORM_OWNER',
    'PLATFORM',
    'TAX_PARTNER'
);
```

### subscription_plan
```sql
CREATE TYPE subscription_plan AS ENUM (
    'FREE',
    'BASIC',
    'PROFESSIONAL',
    'ENTERPRISE'
);
```

### billing_cycle
```sql
CREATE TYPE billing_cycle AS ENUM (
    'MONTHLY',
    'ANNUAL'
);
```

### activity_type
```sql
CREATE TYPE activity_type AS ENUM (
    'CREATE',
    'UPDATE',
    'REVIEW',
    'FILE',
    'DOWNLOAD',
    'DELETE',
    'VIEW'
);
```

### revenue_recipient_type
```sql
CREATE TYPE revenue_recipient_type AS ENUM (
    'PLATFORM_OWNER',
    'TAX_PARTNER'
);
```

### accounting_status
```sql
CREATE TYPE accounting_status AS ENUM (
    'PENDING',
    'RECOGNIZED',
    'TRANSFERRED'
);
```

---

## Migration Files Reference

All schema definitions are implemented in SQL migration files:

1. `prisma/migrations/20251223000001_initial_schema.sql`
   - Core table definitions
   - Enums and type safety
   - Foreign key constraints
   - Indexes for performance
   - Triggers for audit trail

2. `prisma/migrations/20251223000002_rls_policies.sql`
   - Row Level Security policies
   - Helper functions for role checking
   - Enforcement of all hard rules

3. `prisma/migrations/20251223000003_seed_data.sql`
   - Initial platform entities
   - Mono Flip Global, AI Pajak, Jakarta Tax Consulting

4. `prisma/migrations/20251223000004_power_of_attorney.sql`
   - Power of Attorney table and workflows
   - POA status management
   - Validation triggers

See [schema-migrations.md](schema-migrations.md) for detailed migration guide.
