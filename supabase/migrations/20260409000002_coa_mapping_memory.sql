-- COA (Chart of Accounts) Mapping Memory
-- Learns from user corrections when bank transactions are mapped to accounts.
-- Next time the same description pattern appears, auto-applies the learned mapping.

CREATE TABLE IF NOT EXISTS coa_mapping_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

    -- Pattern: normalized description keyword(s) that triggered the mapping
    description_pattern VARCHAR(255) NOT NULL,

    -- Mapped account
    account_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(code),
    account_name VARCHAR(100),

    -- Direction
    transaction_type VARCHAR(10) NOT NULL, -- DEBIT (expense/outflow) | CREDIT (income/inflow)

    -- Learning stats
    used_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, description_pattern, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_coa_memory_customer ON coa_mapping_memory(customer_id);
CREATE INDEX IF NOT EXISTS idx_coa_memory_pattern ON coa_mapping_memory(description_pattern);

ALTER TABLE coa_mapping_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on coa_memory" ON coa_mapping_memory;
DROP POLICY IF EXISTS "Customers view own coa_memory" ON coa_mapping_memory;
DROP POLICY IF EXISTS "JTC manage coa_memory" ON coa_mapping_memory;

CREATE POLICY "Block admins on coa_memory" ON coa_mapping_memory FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own coa_memory" ON coa_mapping_memory FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage coa_memory" ON coa_mapping_memory FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE coa_mapping_memory IS 'Learned bank description → COA account mappings per customer';
