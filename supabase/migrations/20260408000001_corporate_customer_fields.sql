-- Corporate customer signup fields
-- 1. customer_kbli: many-to-many between customer and klu_codes (법인별 KBLI 복수 지정)
-- 2. customer 테이블에 JTC 대행 약관 동의 필드 추가

-- ──────────────────────────────────────────────────────────
-- 1. customer_kbli (customer ↔ KBLI N:M)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_kbli (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    kbli_code VARCHAR(5) NOT NULL REFERENCES klu_codes(code),
    is_primary BOOLEAN DEFAULT FALSE,   -- 주된 업종 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, kbli_code)
);

CREATE INDEX IF NOT EXISTS idx_customer_kbli_customer ON customer_kbli(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_kbli_primary ON customer_kbli(customer_id) WHERE is_primary;

ALTER TABLE customer_kbli ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on customer_kbli" ON customer_kbli FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own kbli" ON customer_kbli FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned customer kbli" ON customer_kbli FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant
    WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "Customer manage own kbli" ON customer_kbli FOR ALL TO authenticated
USING (is_customer() AND customer_id = get_customer_id())
WITH CHECK (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC manage customer kbli" ON customer_kbli FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- ──────────────────────────────────────────────────────────
-- 2. customer — JTC 대행 약관 동의 필드
-- ──────────────────────────────────────────────────────────
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS jtc_agreement_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS jtc_agreement_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS jtc_agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_filing_authorization BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN customer.jtc_agreement_accepted IS 'JTC 세무 대행 약관 동의 여부';
COMMENT ON COLUMN customer.jtc_agreement_version IS '동의한 약관 버전 (예: v1.0)';
COMMENT ON COLUMN customer.data_processing_consent IS '개인정보 처리 동의';
COMMENT ON COLUMN customer.tax_filing_authorization IS 'JTC가 DJP에 세무 신고 제출 권한 위임';
