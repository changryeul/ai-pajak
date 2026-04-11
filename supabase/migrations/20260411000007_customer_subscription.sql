-- Phase K-2.1: customer_subscription table — tracks which corporate plan
-- each customer is on, plus historical plan changes.
--
-- Design:
-- * One active subscription per customer at a time (enforced by partial unique index)
-- * Historical rows are kept with status != 'ACTIVE' for audit/analytics
-- * midtrans_order_id links to the initial payment; ongoing renewals create new rows
-- * plan_id uses the CorporatePlan IDs from src/config/corporate-pricing.ts
--
-- Individual customer per-SPT billing uses a separate flow (not this table).

CREATE TABLE IF NOT EXISTS customer_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

  -- Plan identification (string to avoid enum churn when new plans are added)
  plan_id VARCHAR(20) NOT NULL, -- 'UMKM' | 'BASIC' | 'PRO' | 'CUSTOM'
  plan_name VARCHAR(100),        -- snapshot of plan name at purchase time
  price_idr NUMERIC(18,2) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY' | 'YEARLY'

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    -- 'PENDING_PAYMENT' — order created, awaiting Midtrans confirmation
    -- 'ACTIVE'          — paid and currently in effect
    -- 'CANCELED'        — canceled before renewal
    -- 'EXPIRED'         — past valid_until and not renewed
    -- 'SUPERSEDED'      — replaced by a newer subscription (kept for history)

  -- Period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Midtrans payment linkage
  midtrans_order_id VARCHAR(100),
  midtrans_transaction_id VARCHAR(100),
  midtrans_payment_type VARCHAR(50),
  paid_at TIMESTAMPTZ,

  -- Custom pricing linkage (for Pro+ quotes issued by TAX_OPERATOR_MASTER)
  custom_pricing_quote_id UUID,

  -- Audit
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_subscription_status_values CHECK (
    status IN ('PENDING_PAYMENT', 'ACTIVE', 'CANCELED', 'EXPIRED', 'SUPERSEDED')
  ),
  CONSTRAINT customer_subscription_plan_values CHECK (
    plan_id IN ('UMKM', 'BASIC', 'PRO', 'CUSTOM')
  ),
  CONSTRAINT customer_subscription_cycle_values CHECK (
    billing_cycle IN ('MONTHLY', 'YEARLY')
  )
);

-- At most ONE active subscription per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_subscription_active_unique
  ON customer_subscription(customer_id)
  WHERE status = 'ACTIVE';

-- Quick lookups
CREATE INDEX IF NOT EXISTS idx_customer_subscription_customer
  ON customer_subscription(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscription_status
  ON customer_subscription(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscription_midtrans_order
  ON customer_subscription(midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;

-- updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_customer_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_subscription_updated_at ON customer_subscription;
CREATE TRIGGER trg_customer_subscription_updated_at
  BEFORE UPDATE ON customer_subscription
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_subscription_updated_at();

-- RLS
ALTER TABLE customer_subscription ENABLE ROW LEVEL SECURITY;

-- Block platform admin from subscription (Hard Rule 1 — no tax/billing data access)
CREATE POLICY "Block platform admin from subscriptions"
ON customer_subscription FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN' AND is_active = TRUE
  ));

-- Customers view their own subscriptions
CREATE POLICY "Customers view own subscriptions"
ON customer_subscription FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()));

-- Customers can insert their own subscription (plan change initiated from UI)
CREATE POLICY "Customers create own subscriptions"
ON customer_subscription FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()));

-- Consultants view subscriptions of customers in their tax_partner scope
CREATE POLICY "Consultants view scoped subscriptions"
ON customer_subscription FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT cc.customer_id
      FROM customer_consultant cc
      JOIN consultant c ON c.id = cc.consultant_id
      WHERE c.tax_partner_id = get_consultant_tax_partner_id()
        AND cc.is_active = TRUE
    )
  );

-- Masters (TAX_OPERATOR_MASTER) can view all subscriptions for platform-wide stats
CREATE POLICY "Masters view all subscriptions"
ON customer_subscription FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'TAX_OPERATOR_MASTER' AND is_active = TRUE
  ));

COMMENT ON TABLE customer_subscription IS
  'Corporate customer subscription plan history. One ACTIVE row per customer. Individual per-SPT billing uses billing_transaction instead.';
