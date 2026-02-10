-- AI Pajak Database Schema - Initial Migration
-- Version: 1.0
-- Date: 2025-12-23
-- Description: Core tables enforcing legal separation between Platform and Tax Service Provider

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role_type AS ENUM (
    'CUSTOMER',
    'CONSULTANT_JTC',
    'TAX_ADVISOR_JTC',
    'PLATFORM_ADMIN',
    'SYSTEM'
);

CREATE TYPE customer_type AS ENUM (
    'INDIVIDUAL',
    'COMPANY'
);

CREATE TYPE tax_type AS ENUM (
    'PPh21',
    'PPh23',
    'PPh_FINAL',
    'PPN',
    'SPT_MASA',
    'SPT_TAHUNAN'
);

CREATE TYPE tax_filing_status AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'FILED',
    'REJECTED'
);

CREATE TYPE transaction_type AS ENUM (
    'SUBSCRIPTION',
    'TAX_SERVICE'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);

CREATE TYPE organization_type AS ENUM (
    'PLATFORM_OWNER',
    'PLATFORM',
    'TAX_PARTNER'
);

CREATE TYPE subscription_plan AS ENUM (
    'FREE',
    'BASIC',
    'PROFESSIONAL',
    'ENTERPRISE'
);

CREATE TYPE billing_cycle AS ENUM (
    'MONTHLY',
    'ANNUAL'
);

CREATE TYPE activity_type AS ENUM (
    'CREATE',
    'UPDATE',
    'REVIEW',
    'FILE',
    'DOWNLOAD',
    'DELETE',
    'VIEW'
);

CREATE TYPE revenue_recipient_type AS ENUM (
    'PLATFORM_OWNER',
    'TAX_PARTNER'
);

CREATE TYPE accounting_status AS ENUM (
    'PENDING',
    'RECOGNIZED',
    'TRANSFERRED'
);

-- ============================================================================
-- CORE ORGANIZATIONAL ENTITIES
-- ============================================================================

-- Platform Owner (Mono Flip Global) - Billing Collector
CREATE TABLE platform_owner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Mono Flip Global',
    legal_name VARCHAR(255) NOT NULL,
    npwp VARCHAR(16) NOT NULL,
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint: Only one platform owner allowed
CREATE UNIQUE INDEX idx_single_platform_owner ON platform_owner ((1));

-- Platform (AI Pajak) - Software Platform
CREATE TABLE platform (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_owner_id UUID NOT NULL REFERENCES platform_owner(id),
    name VARCHAR(255) NOT NULL DEFAULT 'AI Pajak',
    domain VARCHAR(255) NOT NULL DEFAULT 'ai-pajak.com',
    service_agreement_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint: Only one platform allowed
CREATE UNIQUE INDEX idx_single_platform ON platform ((1));

-- Tax Partner (Jakarta Tax Consulting) - Tax Service Provider
CREATE TABLE tax_partner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES platform(id),
    name VARCHAR(255) NOT NULL DEFAULT 'Jakarta Tax Consulting',
    legal_name VARCHAR(255) NOT NULL,
    tax_license_number VARCHAR(100) NOT NULL, -- REQUIRED for tax service authority
    npwp VARCHAR(16) NOT NULL,
    email_domain VARCHAR(100) NOT NULL, -- e.g., 'jakartatax.co.id'
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    partnership_start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_tax_license UNIQUE (tax_license_number),
    CONSTRAINT unique_npwp UNIQUE (npwp)
);

-- ============================================================================
-- AUTHENTICATION & USERS (Supabase Auth Integration)
-- ============================================================================

-- Note: auth.users table is managed by Supabase Auth
-- We extend it with our own tables

-- User Roles - Links Supabase auth.users to our role system
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL,
    organization_id UUID, -- References tax_partner or platform
    organization_type organization_type,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_role UNIQUE (user_id, role, organization_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_organization ON user_roles(organization_id, organization_type);

-- ============================================================================
-- CONSULTANTS & TAX ADVISORS
-- ============================================================================

-- Consultant (Employee of Jakarta Tax Consulting)
CREATE TABLE consultant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    employment_start_date DATE NOT NULL,
    employment_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_consultant_user UNIQUE (user_id),
    CONSTRAINT unique_consultant_email UNIQUE (email)
);

CREATE INDEX idx_consultant_tax_partner ON consultant(tax_partner_id);
CREATE INDEX idx_consultant_user ON consultant(user_id);
CREATE INDEX idx_consultant_active ON consultant(is_active) WHERE is_active = true;

-- HARD RULE 2: Consultant MUST belong to Jakarta Tax Consulting
-- This will be enforced by application logic and RLS policies
-- since we may add more tax partners in the future

-- Tax Advisor (Licensed Professional)
CREATE TABLE tax_advisor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultant_id UUID NOT NULL REFERENCES consultant(id),
    license_number VARCHAR(100) NOT NULL,
    license_type VARCHAR(100) NOT NULL, -- 'Brevet A', 'Brevet B', 'Brevet C', 'CPA', etc.
    license_expiry_date DATE,
    is_verified BOOLEAN DEFAULT false,
    verified_by_user_id UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_license_number UNIQUE (license_number),
    CONSTRAINT unique_consultant_advisor UNIQUE (consultant_id)
);

CREATE INDEX idx_tax_advisor_consultant ON tax_advisor(consultant_id);
CREATE INDEX idx_tax_advisor_verified ON tax_advisor(is_verified) WHERE is_verified = true;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_type customer_type NOT NULL,
    npwp VARCHAR(16),
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255), -- Only for COMPANY type
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_customer_user UNIQUE (user_id),
    CONSTRAINT company_requires_name CHECK (
        customer_type = 'INDIVIDUAL' OR
        (customer_type = 'COMPANY' AND company_name IS NOT NULL)
    )
);

CREATE INDEX idx_customer_user ON customer(user_id);
CREATE INDEX idx_customer_npwp ON customer(npwp) WHERE npwp IS NOT NULL;
CREATE INDEX idx_customer_type ON customer(customer_type);

-- ============================================================================
-- TAX FILING (PROTECTED DATA)
-- ============================================================================

CREATE TABLE tax_filing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    consultant_id UUID NOT NULL REFERENCES consultant(id), -- MUST be from JTC
    tax_advisor_id UUID REFERENCES tax_advisor(id), -- Optional licensed reviewer
    tax_type tax_type NOT NULL,
    tax_period VARCHAR(7) NOT NULL, -- 'YYYY-MM' or 'YYYY'
    status tax_filing_status DEFAULT 'DRAFT',
    tax_data JSONB NOT NULL DEFAULT '{}', -- Encrypted sensitive data
    bpe_number VARCHAR(50), -- BPE from DJP after filing
    filed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_customer_tax_period UNIQUE (customer_id, tax_type, tax_period)
);

CREATE INDEX idx_tax_filing_customer ON tax_filing(customer_id);
CREATE INDEX idx_tax_filing_consultant ON tax_filing(consultant_id);
CREATE INDEX idx_tax_filing_tax_advisor ON tax_filing(tax_advisor_id);
CREATE INDEX idx_tax_filing_status ON tax_filing(status);
CREATE INDEX idx_tax_filing_period ON tax_filing(tax_period);
CREATE INDEX idx_tax_filing_type ON tax_filing(tax_type);

-- HARD RULE 3: Tax Filing Actor ≠ Platform
-- Enforced by consultant_id FK to consultant table (which links to tax_partner)
-- RLS policies will prevent PLATFORM_ADMIN from accessing this table

-- ============================================================================
-- TAX DOCUMENTS (PROTECTED DATA)
-- ============================================================================

CREATE TABLE tax_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_filing_id UUID NOT NULL REFERENCES tax_filing(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    document_type VARCHAR(100) NOT NULL, -- 'INVOICE', 'RECEIPT', 'SALARY_SLIP', etc.
    file_path TEXT NOT NULL, -- Encrypted storage path (Supabase Storage)
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    ocr_data JSONB, -- OCR extracted data
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_document_filing ON tax_document(tax_filing_id);
CREATE INDEX idx_tax_document_uploaded_by ON tax_document(uploaded_by_user_id);
CREATE INDEX idx_tax_document_type ON tax_document(document_type);

-- ============================================================================
-- AUDIT TRAIL (MANDATORY - HARD RULE 5)
-- ============================================================================

CREATE TABLE tax_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    tax_filing_id UUID REFERENCES tax_filing(id),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id), -- WHO did it
    actor_organization_id UUID, -- WHICH organization (tax_partner or platform)
    actor_role user_role_type NOT NULL,
    activity_type activity_type NOT NULL,
    tax_type tax_type,
    tax_period VARCHAR(7),
    activity_details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_log_customer ON tax_activity_log(customer_id);
CREATE INDEX idx_tax_log_filing ON tax_activity_log(tax_filing_id);
CREATE INDEX idx_tax_log_actor ON tax_activity_log(actor_user_id);
CREATE INDEX idx_tax_log_organization ON tax_activity_log(actor_organization_id);
CREATE INDEX idx_tax_log_activity_type ON tax_activity_log(activity_type);
CREATE INDEX idx_tax_log_created_at ON tax_activity_log(created_at DESC);

-- HARD RULE 3: Platform cannot be tax filing actor
-- This will be enforced by RLS policies and application logic

-- ============================================================================
-- BILLING & PAYMENTS (HARD RULE 4: Collector ≠ Provider)
-- ============================================================================

CREATE TABLE billing_transaction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    platform_owner_id UUID NOT NULL REFERENCES platform_owner(id), -- Mono Flip (Collector)
    tax_partner_id UUID REFERENCES tax_partner(id), -- JTC (Provider) - nullable for subscriptions
    transaction_type transaction_type NOT NULL,
    amount_total DECIMAL(15, 2) NOT NULL,
    platform_fee DECIMAL(15, 2) NOT NULL DEFAULT 0, -- To AI Pajak / Mono Flip
    tax_service_fee DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Pass-through to JTC
    currency VARCHAR(3) DEFAULT 'IDR',
    payment_status payment_status DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255), -- External payment gateway reference
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_amount_split CHECK (amount_total = platform_fee + tax_service_fee)
);

CREATE INDEX idx_billing_customer ON billing_transaction(customer_id);
CREATE INDEX idx_billing_platform_owner ON billing_transaction(platform_owner_id);
CREATE INDEX idx_billing_tax_partner ON billing_transaction(tax_partner_id);
CREATE INDEX idx_billing_status ON billing_transaction(payment_status);
CREATE INDEX idx_billing_created_at ON billing_transaction(created_at DESC);

-- HARD RULE 4: Billing Collector (platform_owner_id) ≠ Service Provider (tax_partner_id)
-- Enforced by separate FK columns and revenue_split table

-- Revenue Split - Accounting Separation
CREATE TABLE revenue_split (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_transaction_id UUID NOT NULL REFERENCES billing_transaction(id),
    recipient_organization_id UUID NOT NULL, -- Points to platform_owner OR tax_partner
    recipient_type revenue_recipient_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT, -- 'Platform Fee' or 'Tax Service Fee'
    accounting_status accounting_status DEFAULT 'PENDING',
    transferred_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_revenue_split_transaction ON revenue_split(billing_transaction_id);
CREATE INDEX idx_revenue_split_recipient ON revenue_split(recipient_organization_id);
CREATE INDEX idx_revenue_split_status ON revenue_split(accounting_status);

-- ============================================================================
-- SUBSCRIPTION MANAGEMENT
-- ============================================================================

CREATE TABLE subscription (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    plan_type subscription_plan DEFAULT 'FREE',
    billing_cycle billing_cycle,
    price DECIMAL(15, 2) DEFAULT 0,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_customer ON subscription(customer_id);
CREATE INDEX idx_subscription_plan ON subscription(plan_type);
CREATE INDEX idx_subscription_active ON subscription(is_active) WHERE is_active = true;
-- Partial unique index: only one active subscription per customer
CREATE UNIQUE INDEX unique_active_subscription ON subscription(customer_id) WHERE is_active = true;

-- ============================================================================
-- CONSULTATION & COMMUNICATION
-- ============================================================================

CREATE TABLE consultation_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    consultant_id UUID REFERENCES consultant(id),
    tax_filing_id UUID REFERENCES tax_filing(id),
    message_type VARCHAR(50) NOT NULL, -- 'QUESTION', 'RESPONSE', 'DOCUMENT_REQUEST'
    message_content TEXT NOT NULL,
    is_from_customer BOOLEAN NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_consultation_customer ON consultation_message(customer_id);
CREATE INDEX idx_consultation_consultant ON consultation_message(consultant_id);
CREATE INDEX idx_consultation_filing ON consultation_message(tax_filing_id);
CREATE INDEX idx_consultation_unread ON consultation_message(is_read) WHERE is_read = false;
CREATE INDEX idx_consultation_sent_at ON consultation_message(sent_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_platform_owner_updated_at BEFORE UPDATE ON platform_owner
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_updated_at BEFORE UPDATE ON platform
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_partner_updated_at BEFORE UPDATE ON tax_partner
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultant_updated_at BEFORE UPDATE ON consultant
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_advisor_updated_at BEFORE UPDATE ON tax_advisor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_updated_at BEFORE UPDATE ON customer
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_filing_updated_at BEFORE UPDATE ON tax_filing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_transaction_updated_at BEFORE UPDATE ON billing_transaction
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_split_updated_at BEFORE UPDATE ON revenue_split
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_updated_at BEFORE UPDATE ON subscription
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT TRIGGER - HARD RULE 5: Mandatory Audit Trail
-- ============================================================================

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

    -- Get user role
    SELECT role, organization_id INTO v_actor_role, v_actor_org_id
    FROM user_roles
    WHERE user_id = v_actor_user_id AND is_active = true
    LIMIT 1;

    -- Determine activity type
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

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE platform_owner IS 'Mono Flip Global - Billing collection entity (NOT service provider)';
COMMENT ON TABLE platform IS 'AI Pajak - Software platform (NO tax filing authority)';
COMMENT ON TABLE tax_partner IS 'Jakarta Tax Consulting - Tax service provider (SOLE authority for tax filing)';
COMMENT ON TABLE consultant IS 'Employees of Jakarta Tax Consulting who process tax filings';
COMMENT ON TABLE tax_advisor IS 'Licensed tax professionals (Brevet/CPA) who review/approve filings';
COMMENT ON TABLE tax_filing IS 'PROTECTED: Tax filing data - PLATFORM_ADMIN has NO ACCESS';
COMMENT ON TABLE tax_document IS 'PROTECTED: Tax documents - PLATFORM_ADMIN has NO ACCESS';
COMMENT ON TABLE tax_activity_log IS 'MANDATORY: Audit trail for all tax activities - Cannot be deleted';
COMMENT ON TABLE billing_transaction IS 'Payment collection by Mono Flip Global (collector ≠ provider)';
COMMENT ON TABLE revenue_split IS 'Accounting separation: platform fees vs tax service fees';
