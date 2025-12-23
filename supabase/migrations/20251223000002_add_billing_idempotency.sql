-- ============================================================================
-- Migration: Add Idempotency Key to Billing Transaction
-- Date: 2025-12-23
-- Purpose: Prevent duplicate billing creation due to retries/service restarts
-- ============================================================================

-- Add idempotency_key column to billing_transaction table
ALTER TABLE billing_transaction
ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;

-- Add index for faster idempotency checks
CREATE UNIQUE INDEX idx_billing_idempotency_key ON billing_transaction(idempotency_key);

-- Add columns to match API implementation (if not already present)
ALTER TABLE billing_transaction
ADD COLUMN IF NOT EXISTS service_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS amount_base DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS amount_tax DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20),
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index for invoice number lookups
CREATE INDEX IF NOT EXISTS idx_billing_invoice_number ON billing_transaction(invoice_number);

-- Add comment
COMMENT ON COLUMN billing_transaction.idempotency_key IS
'Idempotency key to prevent duplicate billing creation. Format: billing-{taxFilingId}-{timestamp} or custom';

COMMENT ON COLUMN billing_transaction.service_type IS
'Type of service: TAX_FILING, TAX_CONSULTATION, DOCUMENT_PREPARATION, ANNUAL_SUBSCRIPTION, OTHER';

-- ============================================================================
-- IDEMPOTENCY USAGE GUIDE
-- ============================================================================
--
-- When creating a billing transaction, the billing service should:
--
-- 1. Generate idempotency key (recommended formats):
--    - "billing-{taxFilingId}-{timestamp}"
--    - "billing-{customerId}-{serviceType}-{date}"
--    - Custom UUID for non-filing transactions
--
-- 2. First check if transaction with this key exists:
--    SELECT * FROM billing_transaction WHERE idempotency_key = 'key'
--
-- 3. If exists:
--    - Return existing transaction (200 OK, not error)
--    - This is idempotency working correctly
--
-- 4. If not exists:
--    - Create new transaction with idempotency key
--    - Return new transaction (201 Created)
--
-- Example:
-- ```sql
-- INSERT INTO billing_transaction (
--   idempotency_key,
--   customer_id,
--   tax_filing_id,
--   service_type,
--   ...
-- ) VALUES (
--   'billing-tax-filing-123-1234567890',
--   'customer-uuid',
--   'filing-uuid',
--   'TAX_FILING',
--   ...
-- )
-- ON CONFLICT (idempotency_key) DO NOTHING
-- RETURNING *;
-- ```
-- ============================================================================
