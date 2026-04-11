-- Phase K-3.1: custom_pricing_quote table — registered by TAX_OPERATOR_MASTER
-- for customers whose usage exceeds the Pro plan limits, or for special
-- services (tax audit, transfer pricing, etc.) that need bespoke quotes.
--
-- Flow:
--   1. Master identifies a Pro-exceeding customer or a special request.
--   2. Master creates a custom_pricing_quote row with custom monthly price
--      and an optional service catalog.
--   3. Customer sees the quote on their dashboard → can accept via subscribe.
--   4. Subscription row links to this quote via custom_pricing_quote_id.

CREATE TABLE IF NOT EXISTS custom_pricing_quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

  -- Quote metadata
  quote_title VARCHAR(200) NOT NULL,
  quote_description TEXT,
  service_type VARCHAR(40) NOT NULL DEFAULT 'CORPORATE_PLAN',
    -- CORPORATE_PLAN     — Pro 초과 맞춤 월구독
    -- TAX_AUDIT          — 세무조사 대응
    -- TRANSFER_PRICING   — 이전가격 서비스
    -- ADVISORY           — 특별 자문
    -- OTHER              — 기타

  -- Pricing
  monthly_price_idr NUMERIC(18,2),
  one_time_price_idr NUMERIC(18,2),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT    — 마스터가 작성 중
    -- SENT     — 고객에게 전달됨 (대시보드에 표시)
    -- ACCEPTED — 고객이 수락하여 subscription 활성화됨
    -- REJECTED — 고객이 거절
    -- EXPIRED  — 유효기간 만료
    -- CANCELED — 마스터가 취소

  -- Linked usage evidence (snapshot at creation time)
  usage_employees INTEGER,
  usage_withholding_per_month INTEGER,
  usage_ppn_per_month INTEGER,

  -- Audit
  created_by_user_id UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT custom_pricing_status_values CHECK (
    status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED')
  ),
  CONSTRAINT custom_pricing_service_type_values CHECK (
    service_type IN ('CORPORATE_PLAN', 'TAX_AUDIT', 'TRANSFER_PRICING', 'ADVISORY', 'OTHER')
  ),
  CONSTRAINT custom_pricing_prices_positive CHECK (
    (monthly_price_idr IS NULL OR monthly_price_idr >= 0)
    AND (one_time_price_idr IS NULL OR one_time_price_idr >= 0)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_pricing_customer ON custom_pricing_quote(customer_id);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_status ON custom_pricing_quote(status);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_service_type ON custom_pricing_quote(service_type);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_active
  ON custom_pricing_quote(customer_id, status)
  WHERE status IN ('SENT', 'ACCEPTED');

-- updated_at trigger (reuse pattern from subscription table)
CREATE OR REPLACE FUNCTION update_custom_pricing_quote_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_pricing_quote_updated_at ON custom_pricing_quote;
CREATE TRIGGER trg_custom_pricing_quote_updated_at
  BEFORE UPDATE ON custom_pricing_quote
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_pricing_quote_updated_at();

-- Late FK from customer_subscription.custom_pricing_quote_id
-- (placeholder column was added in 20260411000007 without the constraint)
ALTER TABLE customer_subscription
  DROP CONSTRAINT IF EXISTS customer_subscription_custom_pricing_fk;

ALTER TABLE customer_subscription
  ADD CONSTRAINT customer_subscription_custom_pricing_fk
  FOREIGN KEY (custom_pricing_quote_id)
  REFERENCES custom_pricing_quote(id)
  ON DELETE SET NULL;

-- RLS
ALTER TABLE custom_pricing_quote ENABLE ROW LEVEL SECURITY;

-- Platform admin blocked (Hard Rule 1)
CREATE POLICY "Block platform admin from custom_pricing_quote"
ON custom_pricing_quote FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN' AND is_active = TRUE
  ));

-- Customer can view only their own SENT/ACCEPTED quotes
CREATE POLICY "Customers view own active quotes"
ON custom_pricing_quote FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
    AND status IN ('SENT', 'ACCEPTED')
  );

-- Master can view and manage all quotes (platform-wide)
CREATE POLICY "Masters manage all quotes"
ON custom_pricing_quote FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'TAX_OPERATOR_MASTER' AND is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'TAX_OPERATOR_MASTER' AND is_active = TRUE
  ));

COMMENT ON TABLE custom_pricing_quote IS
  'Custom pricing quotes registered by TAX_OPERATOR_MASTER for customers beyond Pro plan limits, or for special services (tax audit, TP, advisory).';
