-- Tax Override Rules — practical/custom rules managed by admin
-- These rules take highest priority in the Tax Resolution Engine
-- Examples: building management (vendor=owner → rental 10%), related party rules

CREATE TABLE tax_override_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100, -- Higher number = higher priority among overrides

    -- Conditions (all non-null conditions must match)
    condition_service_category VARCHAR(30),    -- SERVICE, CONSTRUCTION, RENTAL, etc.
    condition_recipient_type VARCHAR(20),       -- RESIDENT, NON_RESIDENT
    condition_vendor_is_owner BOOLEAN,          -- Building management case
    condition_is_related_party BOOLEAN,         -- Transfer pricing related
    condition_kbli_pattern VARCHAR(20),         -- KBLI code pattern (e.g., '41%' for construction)
    condition_country VARCHAR(2),               -- ISO 3166-1 alpha-2

    -- Result
    result_tax_type VARCHAR(20) NOT NULL,      -- PPh23, PPh26, PPh4_2, PPh21, PPh22, PPh15
    result_rate NUMERIC(10,6) NOT NULL,        -- Tax rate as decimal
    result_is_final BOOLEAN DEFAULT FALSE,
    result_reason TEXT NOT NULL,                -- Human-readable explanation
    result_legal_basis TEXT NOT NULL,           -- Legal reference

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_override_active ON tax_override_rule(is_active);
CREATE INDEX idx_override_priority ON tax_override_rule(priority DESC);

ALTER TABLE tax_override_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active rules" ON tax_override_rule FOR SELECT TO authenticated
USING (is_active = TRUE);
CREATE POLICY "Admin can modify" ON tax_override_rule FOR ALL TO authenticated
USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Seed the existing hardcoded override: vendor is property owner
INSERT INTO tax_override_rule (name, description, is_active, priority,
  condition_service_category, condition_vendor_is_owner,
  result_tax_type, result_rate, result_is_final, result_reason, result_legal_basis)
VALUES (
  'Building Management - Owner as Vendor',
  'When vendor is the property owner providing building management services, treat as rental income',
  TRUE, 100,
  'SERVICE', TRUE,
  'PPh4_2', 0.10, TRUE,
  'Vendor is property owner — treated as sewa tanah/bangunan (rental)',
  'PP 34/2017 Pasal 4(2) huruf d — practical interpretation'
);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_override_rule_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_override_rule_updated_at
BEFORE UPDATE ON tax_override_rule
FOR EACH ROW EXECUTE FUNCTION update_override_rule_updated_at();

COMMENT ON TABLE tax_override_rule IS 'Admin-managed override rules for Tax Resolution Engine (highest priority)';
