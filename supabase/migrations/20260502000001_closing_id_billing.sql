-- Persist ID Billing codes issued from the annual closing wizard.
-- Acts as a graceful-degrade record: when Coretax API is wired up the same
-- table receives the real billing code; until then we generate a deterministic
-- placeholder code so the customer flow stays unblocked.

CREATE TABLE IF NOT EXISTS closing_id_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tax_closing_session(id) ON DELETE CASCADE,
  -- Final-tax for UMKM, PPh 29 (kurang bayar) for PPh25
  billing_code TEXT NOT NULL,
  amount NUMERIC(20, 2) NOT NULL,
  kap_code TEXT NOT NULL,         -- '411128' (PPh Final UMKM), '411126' (PPh Badan)
  kjs_code TEXT NOT NULL,         -- '420' (Final UMKM), '200' (PPh 29 / annual)
  tax_period TEXT NOT NULL,       -- 'YYYY' for annual
  billing_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  source TEXT NOT NULL DEFAULT 'PLACEHOLDER' CHECK (source IN ('PLACEHOLDER', 'CORETAX')),
  ntpn TEXT,                      -- payment receipt code, set when paid
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_closing_id_billing UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_closing_id_billing_session ON closing_id_billing(session_id);

ALTER TABLE closing_id_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY closing_id_billing_owner_select ON closing_id_billing
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY closing_id_billing_owner_modify ON closing_id_billing
  FOR ALL TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

COMMENT ON TABLE closing_id_billing IS
  'Coretax ID Billing codes issued from the annual closing wizard. source=PLACEHOLDER until DJP API wired.';
