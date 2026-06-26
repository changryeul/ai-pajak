-- Expose more template-collected fields in the detail UIs.
-- WHT one-sheet template already collects address / invoice no / payment dates /
-- notes / description per row, but pph23_transaction and ppn_faktur_monthly
-- silently dropped them on insert because the columns didn't exist. After this
-- migration the importer + inline edit can persist them and the detail panels
-- can render them.

ALTER TABLE pph23_transaction
  ADD COLUMN IF NOT EXISTS counterparty_address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS payment_date DATE;

ALTER TABLE ppn_faktur_monthly
  ADD COLUMN IF NOT EXISTS counterparty_address TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
