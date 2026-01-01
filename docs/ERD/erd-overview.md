# ERD Overview

**Version**: 1.0
**Date**: 2025-12-23
**Status**: Initial Design

## Complete Entity Relationship Diagram

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

### 1. Legal Separation of Duties

The ERD enforces strict separation between three legal entities:

- **Mono Flip Global (Platform Owner)** - Billing collection only
- **AI Pajak (Platform)** - Software platform operations
- **Jakarta Tax Consulting (Tax Partner)** - Tax filing services

### 2. Data Access Matrix

| Role | Tax Filing | Tax Documents | POA | Customer Data | Billing | Audit Logs |
|------|-----------|---------------|-----|---------------|---------|------------|
| CUSTOMER | Own only | Own only | Own (manage) | Own only | Own only | Own only (read) |
| CONSULTANT_JTC | Assigned cases | Assigned cases | Partner POAs | Assigned cases | No | Write |
| TAX_ADVISOR_JTC | All JTC cases | All JTC cases | Partner POAs | All JTC cases | No | Write |
| PLATFORM_ADMIN | **NO ACCESS** | **NO ACCESS** | View only | Anonymized only | All | Read only |
| SYSTEM | No | No | No | No | All | Write |

### 3. Entity Constraints

#### Single-Instance Entities (Enforced at Application Level)
- **PLATFORM_OWNER**: Single row (Mono Flip Global)
- **PLATFORM**: Single row (AI Pajak)
- **TAX_PARTNER**: Single active row (Jakarta Tax Consulting) - extensible for future

#### Multi-Instance Entities with Constraints
- **CONSULTANT**: Must have `tax_partner_id` = Jakarta Tax Consulting
- **TAX_ADVISOR**: Must reference valid `consultant_id` with verified license
- **POWER_OF_ATTORNEY**: Must have both customer and tax partner signatures to be ACTIVE
- **TAX_FILING**: Must have `consultant_id` from JTC AND active `power_of_attorney_id` for FILED status

### 4. Power of Attorney (POA) Workflow

The POA system ensures legal authorization before tax filing:

```
Customer Journey:
1. Customer creates POA (status: DRAFT)
2. Customer uploads/signs POA document → customer_signed_at recorded
3. Tax Partner reviews and signs POA → tax_partner_signed_at recorded
4. POA becomes ACTIVE (both parties signed, within valid dates)
5. Tax Filing can now proceed (references active POA)
6. POA automatically expires when valid_to date passes
7. Customer can manually revoke POA at any time

Database Enforcement:
- tax_filing.power_of_attorney_id FK → power_of_attorney.id
- Trigger: validate_tax_filing_poa() checks active POA before FILED status
- Function: has_active_poa() validates POA scope matches tax type
- Auto-expiration: update_poa_status() runs daily
```

### 5. Audit Trail Architecture

All tax-related operations are logged in `TAX_ACTIVITY_LOG`:

**Captured Information:**
- WHO: `actor_user_id`, `actor_role`
- WHICH ORGANIZATION: `actor_organization_id`
- WHAT: `activity_type`, `activity_details` (JSONB)
- WHEN: `created_at`
- WHERE: `ip_address`, `user_agent`

**Enforcement:**
- Database triggers auto-create audit entries
- No DELETE permission on audit logs (permanent record)
- RLS policies prevent tampering

### 6. Billing Architecture

**Collection Agency Model:**

```
Customer Payment Flow:
1. Customer pays → BILLING_TRANSACTION created
2. platform_owner_id = Mono Flip Global (collector)
3. tax_partner_id = Jakarta Tax Consulting (service provider)
4. REVENUE_SPLIT records created:
   - Platform Fee → Mono Flip Global
   - Tax Service Fee → Jakarta Tax Consulting
```

**Key Constraints:**
- `platform_owner_id` ≠ `tax_partner_id` (enforced by RLS policy)
- Revenue splits must sum to `amount_total`
- Accounting status tracked separately for each recipient

## Entity Groupings

### Core Platform Entities
- [Platform Owner](erd-core-entities.md#platform-owner)
- [Platform](erd-core-entities.md#platform)
- [Tax Partner](erd-core-entities.md#tax-partner)

### User Management
- [Users](erd-core-entities.md#users)
- [User Roles](erd-core-entities.md#user-roles)
- [Customer](erd-core-entities.md#customer)
- [Consultant](erd-core-entities.md#consultant)
- [Tax Advisor](erd-core-entities.md#tax-advisor)

### Tax Operations (PROTECTED)
- [Power of Attorney](erd-tax-filing.md#power-of-attorney)
- [Tax Filing](erd-tax-filing.md#tax-filing)
- [Tax Document](erd-tax-filing.md#tax-document)
- [Tax Activity Log](erd-tax-filing.md#tax-activity-log)

### Financial Operations
- [Billing Transaction](erd-billing.md#billing-transaction)
- [Revenue Split](erd-billing.md#revenue-split)
- [Subscription](erd-billing.md#subscription)

### Communication
- [Consultation Message](erd-communication.md#consultation-message)

## Security Features

### Row-Level Security (RLS)
All tables have RLS enabled with policies enforcing:
- Role-based access control
- Organization-level data isolation
- Audit trail immutability

See [hard-rules-enforcement.md](hard-rules-enforcement.md) for detailed RLS policies.

### Data Encryption
- `tax_filing.tax_data`: JSONB encrypted at application level
- `tax_document.file_path`: Encrypted storage path
- `power_of_attorney.document_hash`: SHA-256 verification

### Constraints & Validation
- Foreign key constraints ensure referential integrity
- Check constraints enforce business rules
- Unique constraints prevent duplicates
- NOT NULL constraints enforce required fields

## Performance Optimization

### Strategic Indexes
- Primary keys (UUID) - clustered indexes
- Foreign keys - non-clustered indexes
- Unique constraints - unique indexes
- Common query patterns - composite indexes

### Query Optimization
- JSONB GIN indexes for tax_data and activity_details
- Date range indexes for tax_period and filing dates
- Status indexes for filtering active records

See [data-dictionary.md](data-dictionary.md) for complete index definitions.

## Related Documentation

- [data-dictionary.md](data-dictionary.md) - Complete table and column definitions
- [erd-core-entities.md](erd-core-entities.md) - Core platform entities
- [erd-tax-filing.md](erd-tax-filing.md) - Tax filing workflow entities
- [erd-billing.md](erd-billing.md) - Billing and payment entities
- [erd-communication.md](erd-communication.md) - Communication entities
- [hard-rules-enforcement.md](hard-rules-enforcement.md) - Compliance enforcement
- [schema-migrations.md](schema-migrations.md) - Migration guide
