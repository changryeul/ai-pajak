-- ============================================================================
-- Migration: Add Midtrans Payment Columns
-- Date: 2025-12-23
-- Purpose: Store Midtrans payment details for billing transactions
-- ============================================================================

-- Add Midtrans-specific columns to billing_transaction table
ALTER TABLE billing_transaction
ADD COLUMN IF NOT EXISTS payment_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS midtrans_transaction_id VARCHAR(255);

-- Add index for Midtrans transaction lookups
CREATE INDEX IF NOT EXISTS idx_billing_midtrans_transaction
ON billing_transaction(midtrans_transaction_id);

-- Add comments
COMMENT ON COLUMN billing_transaction.payment_token IS
'Midtrans Snap payment token. Used for initiating payment popup.';

COMMENT ON COLUMN billing_transaction.payment_url IS
'Midtrans redirect URL for payment page.';

COMMENT ON COLUMN billing_transaction.midtrans_transaction_id IS
'Transaction ID from Midtrans after successful payment.';

-- ============================================================================
-- PAYMENT FLOW
-- ============================================================================
--
-- 1. BILLING CREATION (by SYSTEM):
--    - billing_transaction created with payment_status = 'PENDING'
--    - payment_token, payment_url are NULL
--
-- 2. PAYMENT INITIATION (by Customer):
--    - Customer calls POST /api/payment/initiate with transactionId
--    - System creates Midtrans Snap token
--    - payment_token and payment_url are populated
--    - Customer completes payment in Midtrans popup
--
-- 3. PAYMENT NOTIFICATION (from Midtrans):
--    - Midtrans calls POST /api/webhooks/midtrans
--    - payment_status updated based on Midtrans response
--    - midtrans_transaction_id is populated
--    - paid_at is set for successful payments
--
-- Status flow:
-- PENDING -> PAID (success)
-- PENDING -> FAILED (denied/error)
-- PAID -> REFUNDED (refund processed)
-- ============================================================================
