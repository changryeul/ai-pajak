-- Phase B-3.2: tax_partner_subscription — monthly subscription plans for
-- external tax consulting firms (EXTERNAL tax_partners).
--
-- Distinct from customer_subscription which covers corporate customers
-- subscribing to UMKM/Basic/Pro plans. This table tracks the consulting
-- firm's own monthly tool fee, based on the number of clients they manage.

CREATE TABLE IF NOT EXISTS tax_partner_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_partner_id UUID NOT NULL REFERENCES tax_partner(id) ON DELETE CASCADE,

  -- Tier identification
  tier_id VARCHAR(20) NOT NULL, -- 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM'
  tier_name VARCHAR(100),
  price_idr NUMERIC(18,2) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  max_clients INTEGER, -- NULL = unlimited

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    -- 'PENDING_PAYMENT' | 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'SUPERSEDED'

  -- Period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Midtrans linkage
  midtrans_order_id VARCHAR(100),
  midtrans_transaction_id VARCHAR(100),
  midtrans_payment_type VARCHAR(50),
  paid_at TIMESTAMPTZ,

  -- Audit
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tax_partner_subscription_status_values CHECK (
    status IN ('PENDING_PAYMENT', 'ACTIVE', 'CANCELED', 'EXPIRED', 'SUPERSEDED')
  ),
  CONSTRAINT tax_partner_subscription_tier_values CHECK (
    tier_id IN ('STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM')
  ),
  CONSTRAINT tax_partner_subscription_cycle_values CHECK (
    billing_cycle IN ('MONTHLY', 'YEARLY')
  )
);

-- At most ONE active subscription per partner
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_partner_subscription_active_unique
  ON tax_partner_subscription(tax_partner_id)
  WHERE status = 'ACTIVE';

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_tax_partner_subscription_partner
  ON tax_partner_subscription(tax_partner_id);
CREATE INDEX IF NOT EXISTS idx_tax_partner_subscription_status
  ON tax_partner_subscription(status);
CREATE INDEX IF NOT EXISTS idx_tax_partner_subscription_midtrans_order
  ON tax_partner_subscription(midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_tax_partner_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_partner_subscription_updated_at ON tax_partner_subscription;
CREATE TRIGGER trg_tax_partner_subscription_updated_at
  BEFORE UPDATE ON tax_partner_subscription
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_partner_subscription_updated_at();

-- RLS
ALTER TABLE tax_partner_subscription ENABLE ROW LEVEL SECURITY;

-- Platform admin blocked
CREATE POLICY "Block platform admin from tax_partner_subscription"
ON tax_partner_subscription FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN' AND is_active = TRUE
  ));

-- Consultants of this tax_partner can view and create their own subscription
CREATE POLICY "Partner consultants view own subscription"
ON tax_partner_subscription FOR SELECT TO authenticated
  USING (tax_partner_id = get_consultant_tax_partner_id());

CREATE POLICY "Partner consultants create own subscription"
ON tax_partner_subscription FOR INSERT TO authenticated
  WITH CHECK (tax_partner_id = get_consultant_tax_partner_id());

-- Master views all for platform-wide stats
CREATE POLICY "Masters view all tax_partner subscriptions"
ON tax_partner_subscription FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'TAX_OPERATOR_MASTER' AND is_active = TRUE
  ));

COMMENT ON TABLE tax_partner_subscription IS
  'Monthly tier subscription for external tax consulting firms (EXTERNAL tax_partners). Firms pay AI Pajak a tool fee; their clients bill separately.';
