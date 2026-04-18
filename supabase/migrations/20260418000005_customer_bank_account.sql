-- Customer bank account (minimal PII)
-- Phase: PR3 Batch 4 (T-006).
--
-- Context: INDIVIDUAL customers often hold multiple accounts (BCA, Mandiri,
-- OCBC, plus foreign accounts in KR/US/JP). For the dashboard we need to
-- show the list + a rough count for KYC/anomaly-detection, not to move
-- money. PII is deliberately minimized:
--
--   - store only last4 of the account number (never the full string)
--   - label (user-typed nickname: "Gaji utama", "Tabungan KR", ...)
--   - bank_name (free text — we don't validate against an SWIFT registry)
--   - currency (ISO-4217, defaulting to IDR)
--   - is_foreign flag + country (ISO-2) so the foreign-asset card can
--     cross-reference snapshots without joining on currency alone
--
-- If later we need the full account number for e-billing transfers, the
-- right answer is a separate encrypted-at-rest table, not widening this one.

CREATE TABLE IF NOT EXISTS customer_bank_account (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  bank_name          TEXT NOT NULL,
  label              TEXT,
  account_last4      CHAR(4) NOT NULL,
  currency           CHAR(3) NOT NULL DEFAULT 'IDR',
  is_foreign         BOOLEAN NOT NULL DEFAULT FALSE,
  country            CHAR(2),
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_bank_account_last4_digits CHECK (account_last4 ~ '^[0-9]{4}$'),
  CONSTRAINT customer_bank_account_country_iso CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  CONSTRAINT customer_bank_account_currency_iso CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS customer_bank_account_customer_idx
  ON customer_bank_account(customer_id);

CREATE INDEX IF NOT EXISTS customer_bank_account_foreign_idx
  ON customer_bank_account(customer_id) WHERE is_foreign = TRUE;

-- Only one primary account per customer
CREATE UNIQUE INDEX IF NOT EXISTS customer_bank_account_one_primary
  ON customer_bank_account(customer_id) WHERE is_primary = TRUE;

CREATE OR REPLACE FUNCTION touch_customer_bank_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_bank_account_updated_at ON customer_bank_account;
CREATE TRIGGER trg_customer_bank_account_updated_at
  BEFORE UPDATE ON customer_bank_account
  FOR EACH ROW EXECUTE FUNCTION touch_customer_bank_account_updated_at();

-- RLS: customers own their rows; consultants inherit via customer access.
ALTER TABLE customer_bank_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_bank_account_self_select ON customer_bank_account;
CREATE POLICY customer_bank_account_self_select ON customer_bank_account
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customer c
      WHERE c.id = customer_bank_account.customer_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customer_bank_account_self_write ON customer_bank_account;
CREATE POLICY customer_bank_account_self_write ON customer_bank_account
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customer c
      WHERE c.id = customer_bank_account.customer_id
        AND c.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM customer c
      WHERE c.id = customer_bank_account.customer_id
        AND c.user_id = auth.uid()
    )
  );

COMMENT ON TABLE customer_bank_account IS
  'Minimal bank-account index for INDIVIDUAL customers. Stores last4 only — never full account numbers.';
COMMENT ON COLUMN customer_bank_account.account_last4 IS
  'Last 4 digits of the account number. Never store the full number here.';
