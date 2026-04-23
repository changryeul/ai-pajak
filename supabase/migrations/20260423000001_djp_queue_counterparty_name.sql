-- Add counterparty_name to djp_submission_queue so the billing UI can show
-- the withholding counterparty (employer for PPh 21, vendor for PPh 23, etc.)
-- per row, rather than always the customer's own company name.
--
-- Keynote slide-17 shows distinct 회사 values per row — e.g. PPh 21 for
-- PT ABC Indonesia, PPh 23 for PT Vendor Global. Without this column the
-- 회사 column has to fall back to a single customer-level label.

ALTER TABLE djp_submission_queue
  ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(255);

COMMENT ON COLUMN djp_submission_queue.counterparty_name IS
  'Withholding counterparty (employer/vendor) shown in the customer billing table. NULL falls back to the customer company label.';
