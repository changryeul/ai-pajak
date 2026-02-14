-- Add tax_calculation table for storing draft tax calculations
-- This table stores temporary calculation results before filing

CREATE TABLE tax_calculation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    consultant_id UUID NOT NULL REFERENCES consultant(id),
    tax_type tax_type NOT NULL,
    tax_period VARCHAR(7) NOT NULL, -- e.g., '2025-01'
    tax_year INTEGER NOT NULL,
    income_data JSONB NOT NULL,
    deduction_data JSONB DEFAULT '{}',
    credit_data JSONB DEFAULT '{}',
    calculation_result JSONB NOT NULL,
    calculated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tax_calc_customer ON tax_calculation(customer_id);
CREATE INDEX idx_tax_calc_consultant ON tax_calculation(consultant_id);
CREATE INDEX idx_tax_calc_period ON tax_calculation(tax_year, tax_period);
CREATE INDEX idx_tax_calc_created ON tax_calculation(created_at DESC);

-- Enable RLS
ALTER TABLE tax_calculation ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Block platform admins from accessing tax calculations
CREATE POLICY "Block platform admins from tax calculations"
ON tax_calculation FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());

-- Customers can view their own calculations
CREATE POLICY "Customers can view own calculations"
ON tax_calculation FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- JTC consultants can view calculations for assigned customers
CREATE POLICY "JTC consultants can view assigned calculations"
ON tax_calculation FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- JTC consultants can create calculations for assigned customers
CREATE POLICY "JTC consultants can create calculations"
ON tax_calculation FOR INSERT
TO authenticated
WITH CHECK (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- JTC consultants can update their own calculations
CREATE POLICY "JTC consultants can update own calculations"
ON tax_calculation FOR UPDATE
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
)
WITH CHECK (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- Auto-update updated_at
CREATE TRIGGER update_tax_calculation_updated_at
BEFORE UPDATE ON tax_calculation
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tax_calculation IS 'Draft tax calculations - not audit trail material until filed';
