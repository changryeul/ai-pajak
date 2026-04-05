-- Generalize accurate_connection → accounting_connection
-- Add provider column to support multiple accounting software (Accurate, Mekari Jurnal, etc.)

-- ──────────────────────────────────────────────────────────
-- 1. Rename tables
-- ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS accurate_connection RENAME TO accounting_connection;
ALTER TABLE IF EXISTS accurate_invoice RENAME TO accounting_invoice;

-- ──────────────────────────────────────────────────────────
-- 2. Add provider column (default: ACCURATE for existing rows)
-- ──────────────────────────────────────────────────────────
ALTER TABLE accounting_connection
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'ACCURATE';

ALTER TABLE accounting_invoice
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'ACCURATE';

-- Drop old unique constraint and recreate with provider
ALTER TABLE accounting_connection DROP CONSTRAINT IF EXISTS accurate_connection_customer_id_key;
ALTER TABLE accounting_connection ADD CONSTRAINT accounting_connection_customer_provider_key
  UNIQUE (customer_id, provider);

ALTER TABLE accounting_invoice DROP CONSTRAINT IF EXISTS accurate_invoice_customer_id_invoice_type_accurate_id_key;
ALTER TABLE accounting_invoice RENAME COLUMN accurate_id TO external_id;
ALTER TABLE accounting_invoice ADD CONSTRAINT accounting_invoice_unique
  UNIQUE (customer_id, provider, invoice_type, external_id);

-- ──────────────────────────────────────────────────────────
-- 3. Rename indexes
-- ──────────────────────────────────────────────────────────
ALTER INDEX IF EXISTS idx_accurate_conn_customer RENAME TO idx_accounting_conn_customer;
ALTER INDEX IF EXISTS idx_accurate_conn_active RENAME TO idx_accounting_conn_active;
ALTER INDEX IF EXISTS idx_accurate_inv_customer_type RENAME TO idx_accounting_inv_customer_type;
ALTER INDEX IF EXISTS idx_accurate_inv_date RENAME TO idx_accounting_inv_date;
ALTER INDEX IF EXISTS idx_accurate_inv_status RENAME TO idx_accounting_inv_status;

CREATE INDEX IF NOT EXISTS idx_accounting_conn_provider ON accounting_connection(customer_id, provider);

-- ──────────────────────────────────────────────────────────
-- 4. Drop old RLS policies and recreate
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Block admins on accurate" ON accounting_connection;
DROP POLICY IF EXISTS "Customers view own accurate conn" ON accounting_connection;
DROP POLICY IF EXISTS "JTC view assigned accurate conn" ON accounting_connection;
DROP POLICY IF EXISTS "JTC manage accurate conn" ON accounting_connection;

DROP POLICY IF EXISTS "Block admins on accurate inv" ON accounting_invoice;
DROP POLICY IF EXISTS "Customers view own accurate inv" ON accounting_invoice;
DROP POLICY IF EXISTS "JTC view assigned accurate inv" ON accounting_invoice;
DROP POLICY IF EXISTS "JTC manage accurate inv" ON accounting_invoice;

CREATE POLICY "Block admins on accounting conn" ON accounting_connection FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own accounting conn" ON accounting_connection FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned accounting conn" ON accounting_connection FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
  SELECT customer_id FROM customer_consultant
  WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "JTC manage accounting conn" ON accounting_connection FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

CREATE POLICY "Block admins on accounting inv" ON accounting_invoice FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own accounting inv" ON accounting_invoice FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned accounting inv" ON accounting_invoice FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
  SELECT customer_id FROM customer_consultant
  WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "JTC manage accounting inv" ON accounting_invoice FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- ──────────────────────────────────────────────────────────
-- 5. Rename trigger function
-- ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_accurate_conn_updated_at ON accounting_connection;
CREATE TRIGGER trigger_accounting_conn_updated_at
BEFORE UPDATE ON accounting_connection
FOR EACH ROW EXECUTE FUNCTION update_accurate_conn_updated_at();

COMMENT ON TABLE accounting_connection IS 'Accounting software connection (Accurate, Mekari Jurnal, etc.)';
COMMENT ON TABLE accounting_invoice IS 'Invoices imported from accounting software';
COMMENT ON COLUMN accounting_connection.provider IS 'ACCURATE | MEKARI | XERO etc.';
COMMENT ON COLUMN accounting_invoice.external_id IS 'Invoice ID in the source system';
