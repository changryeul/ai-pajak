-- AI Pajak - Power of Attorney (POA) Extension
-- Version: 1.1
-- Date: 2025-12-23
-- Description: Add Power of Attorney table to establish legal authorization

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE poa_status AS ENUM (
    'DRAFT',           -- POA document being prepared
    'PENDING_SIGNATURE', -- Waiting for customer signature
    'ACTIVE',          -- Valid and in effect
    'EXPIRED',         -- Past valid_to date
    'REVOKED',         -- Manually revoked by customer
    'REJECTED'         -- Rejected by tax partner
);

CREATE TYPE poa_scope AS ENUM (
    'ALL_TAX_TYPES',   -- Authorization for all tax types
    'PPh21_ONLY',      -- Only PPh 21
    'PPh23_ONLY',      -- Only PPh 23
    'PPN_ONLY',        -- Only PPN
    'SPT_TAHUNAN_ONLY',-- Only annual tax return
    'CUSTOM'           -- Custom scope defined in scope_details
);

-- ============================================================================
-- POWER OF ATTORNEY TABLE
-- ============================================================================

CREATE TABLE power_of_attorney (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Parties
    customer_id UUID NOT NULL REFERENCES customer(id),
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),

    -- POA Details
    poa_number VARCHAR(100) UNIQUE, -- e.g., 'POA-2025-001234'
    scope poa_scope NOT NULL DEFAULT 'ALL_TAX_TYPES',
    scope_details JSONB, -- Custom scope if scope = 'CUSTOM'

    -- Validity Period
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,

    -- Document Management
    document_url TEXT NOT NULL, -- Signed POA document (Supabase Storage)
    document_hash VARCHAR(64), -- SHA-256 hash for integrity verification

    -- Status
    status poa_status DEFAULT 'DRAFT',

    -- Signatures
    customer_signed_at TIMESTAMP WITH TIME ZONE,
    customer_signature_url TEXT, -- Digital signature image/certificate
    customer_ip_address INET,

    tax_partner_signed_at TIMESTAMP WITH TIME ZONE,
    tax_partner_signed_by_user_id UUID REFERENCES auth.users(id),
    tax_partner_signature_url TEXT,

    -- Revocation
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by_user_id UUID REFERENCES auth.users(id),
    revocation_reason TEXT,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_date_range CHECK (valid_to > valid_from),
    CONSTRAINT active_requires_signatures CHECK (
        status != 'ACTIVE' OR
        (customer_signed_at IS NOT NULL AND tax_partner_signed_at IS NOT NULL)
    ),
    CONSTRAINT revoked_requires_reason CHECK (
        status != 'REVOKED' OR
        (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_poa_customer ON power_of_attorney(customer_id);
CREATE INDEX idx_poa_tax_partner ON power_of_attorney(tax_partner_id);
CREATE INDEX idx_poa_status ON power_of_attorney(status);
CREATE INDEX idx_poa_validity ON power_of_attorney(valid_from, valid_to);
CREATE INDEX idx_poa_active ON power_of_attorney(status, valid_from, valid_to)
    WHERE status = 'ACTIVE';

-- ============================================================================
-- CONSTRAINT: Tax Filing Requires Active POA
-- ============================================================================

-- Add POA reference to tax_filing table
ALTER TABLE tax_filing
ADD COLUMN power_of_attorney_id UUID REFERENCES power_of_attorney(id);

CREATE INDEX idx_tax_filing_poa ON tax_filing(power_of_attorney_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if customer has active POA with tax partner
CREATE OR REPLACE FUNCTION has_active_poa(
    p_customer_id UUID,
    p_tax_partner_id UUID,
    p_tax_type tax_type,
    p_filing_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_poa BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM power_of_attorney
        WHERE customer_id = p_customer_id
        AND tax_partner_id = p_tax_partner_id
        AND status = 'ACTIVE'
        AND p_filing_date BETWEEN valid_from AND valid_to
        AND (
            scope = 'ALL_TAX_TYPES'
            OR (scope = 'PPh21_ONLY' AND p_tax_type = 'PPh21')
            OR (scope = 'PPh23_ONLY' AND p_tax_type = 'PPh23')
            OR (scope = 'PPN_ONLY' AND p_tax_type = 'PPN')
            OR (scope = 'SPT_TAHUNAN_ONLY' AND p_tax_type = 'SPT_TAHUNAN')
            OR scope = 'CUSTOM' -- Application logic will validate custom scope
        )
    ) INTO v_has_poa;

    RETURN v_has_poa;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Auto-update POA status based on dates
CREATE OR REPLACE FUNCTION update_poa_status()
RETURNS void AS $$
BEGIN
    -- Expire POAs that are past valid_to date
    UPDATE power_of_attorney
    SET status = 'EXPIRED',
        updated_at = NOW()
    WHERE status = 'ACTIVE'
    AND valid_to < CURRENT_DATE;

    -- Log the update
    RAISE NOTICE 'Updated % expired POAs', (SELECT COUNT(*) FROM power_of_attorney WHERE status = 'EXPIRED' AND updated_at = NOW());
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER update_poa_updated_at
BEFORE UPDATE ON power_of_attorney
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate POA number
CREATE OR REPLACE FUNCTION generate_poa_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.poa_number IS NULL THEN
        NEW.poa_number := 'POA-' ||
                         TO_CHAR(NOW(), 'YYYY') || '-' ||
                         LPAD(nextval('poa_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE poa_number_seq START 1;

CREATE TRIGGER generate_poa_number_trigger
BEFORE INSERT ON power_of_attorney
FOR EACH ROW EXECUTE FUNCTION generate_poa_number();

-- ============================================================================
-- AUDIT LOG INTEGRATION
-- ============================================================================

-- Add POA activity type
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'POA_CREATED';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'POA_SIGNED';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'POA_ACTIVATED';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'POA_REVOKED';

-- Audit trigger for POA
CREATE OR REPLACE FUNCTION log_poa_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id UUID;
    v_actor_role user_role_type;
    v_actor_org_id UUID;
    v_activity_type activity_type;
BEGIN
    v_actor_user_id := auth.uid();

    SELECT role, organization_id INTO v_actor_role, v_actor_org_id
    FROM user_roles
    WHERE user_id = v_actor_user_id AND is_active = true
    LIMIT 1;

    -- Determine activity type
    IF TG_OP = 'INSERT' THEN
        v_activity_type := 'POA_CREATED';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE' THEN
            v_activity_type := 'POA_ACTIVATED';
        ELSIF NEW.status = 'REVOKED' AND OLD.status != 'REVOKED' THEN
            v_activity_type := 'POA_REVOKED';
        ELSIF NEW.customer_signed_at IS NOT NULL AND OLD.customer_signed_at IS NULL THEN
            v_activity_type := 'POA_SIGNED';
        ELSE
            v_activity_type := 'UPDATE';
        END IF;
    END IF;

    -- Insert audit log
    INSERT INTO tax_activity_log (
        customer_id,
        actor_user_id,
        actor_organization_id,
        actor_role,
        activity_type,
        activity_details
    ) VALUES (
        COALESCE(NEW.customer_id, OLD.customer_id),
        v_actor_user_id,
        v_actor_org_id,
        COALESCE(v_actor_role, 'SYSTEM'),
        v_activity_type,
        jsonb_build_object(
            'poa_id', COALESCE(NEW.id, OLD.id),
            'poa_number', COALESCE(NEW.poa_number, OLD.poa_number),
            'old_status', OLD.status,
            'new_status', NEW.status,
            'valid_from', NEW.valid_from,
            'valid_to', NEW.valid_to
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER poa_audit_trigger
AFTER INSERT OR UPDATE ON power_of_attorney
FOR EACH ROW EXECUTE FUNCTION log_poa_activity();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE power_of_attorney ENABLE ROW LEVEL SECURITY;

-- Customers can view their own POAs
CREATE POLICY "Customers can view own POAs"
ON power_of_attorney FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Customers can create POAs (initial draft)
CREATE POLICY "Customers can create POAs"
ON power_of_attorney FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'DRAFT'
);

-- Customers can update their own draft POAs
CREATE POLICY "Customers can update draft POAs"
ON power_of_attorney FOR UPDATE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    status IN ('DRAFT', 'PENDING_SIGNATURE')
)
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Customers can revoke their own active POAs
CREATE POLICY "Customers can revoke POAs"
ON power_of_attorney FOR UPDATE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'ACTIVE'
)
WITH CHECK (
    status = 'REVOKED' AND
    revoked_by_user_id = auth.uid()
);

-- JTC consultants can view POAs for their tax partner
CREATE POLICY "JTC consultants can view partner POAs"
ON power_of_attorney FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    tax_partner_id = get_user_organization_id()
);

-- JTC consultants can update POAs (sign, activate)
CREATE POLICY "JTC consultants can update POAs"
ON power_of_attorney FOR UPDATE
TO authenticated
USING (
    is_jtc_consultant() AND
    tax_partner_id = get_user_organization_id()
)
WITH CHECK (
    is_jtc_consultant() AND
    tax_partner_id = get_user_organization_id()
);

-- Platform admins can view POAs (anonymized for reporting)
CREATE POLICY "Platform admins can view POAs"
ON power_of_attorney FOR SELECT
TO authenticated
USING (is_platform_admin());

-- ============================================================================
-- VALIDATION: Tax Filing Requires Active POA
-- ============================================================================

-- Add constraint check function
CREATE OR REPLACE FUNCTION validate_tax_filing_poa()
RETURNS TRIGGER AS $$
DECLARE
    v_has_poa BOOLEAN;
    v_customer_id UUID;
    v_tax_partner_id UUID;
BEGIN
    -- Get customer and tax partner from consultant
    SELECT
        tf.customer_id,
        c.tax_partner_id
    INTO v_customer_id, v_tax_partner_id
    FROM tax_filing tf
    JOIN consultant c ON tf.consultant_id = c.id
    WHERE tf.id = NEW.id;

    -- Check if active POA exists
    v_has_poa := has_active_poa(
        v_customer_id,
        v_tax_partner_id,
        NEW.tax_type,
        COALESCE(NEW.filed_at::DATE, CURRENT_DATE)
    );

    -- If status is FILED or UNDER_REVIEW, require POA
    IF NEW.status IN ('FILED', 'UNDER_REVIEW') AND NOT v_has_poa THEN
        RAISE EXCEPTION 'Tax filing requires an active Power of Attorney. Customer must authorize tax partner before filing.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_tax_filing_poa_trigger
BEFORE INSERT OR UPDATE ON tax_filing
FOR EACH ROW EXECUTE FUNCTION validate_tax_filing_poa();

-- ============================================================================
-- SCHEDULED JOB (via pg_cron extension - optional)
-- ============================================================================

-- Note: Requires pg_cron extension
-- Run daily to auto-expire POAs
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('expire-poas', '0 0 * * *', 'SELECT update_poa_status()');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE power_of_attorney IS 'Legal authorization for tax partner to act on behalf of customer';
COMMENT ON COLUMN power_of_attorney.poa_number IS 'Unique POA identifier (auto-generated)';
COMMENT ON COLUMN power_of_attorney.scope IS 'Authorization scope (all tax types or specific)';
COMMENT ON COLUMN power_of_attorney.document_hash IS 'SHA-256 hash of signed document for integrity verification';
COMMENT ON COLUMN power_of_attorney.customer_ip_address IS 'IP address of customer when signing (for audit)';
COMMENT ON FUNCTION has_active_poa IS 'Check if customer has active POA for given tax partner and tax type';
COMMENT ON FUNCTION validate_tax_filing_poa IS 'Ensures tax filing has valid POA before FILED or UNDER_REVIEW status';
