-- Phase A follow-up: Store PTKP status on customer for individual taxpayers
-- PTKP (Penghasilan Tidak Kena Pajak) determines the tax-free allowance
-- based on marital status and number of dependents.

-- PTKP codes (UU PPh Pasal 7):
-- TK/0..3 : single with 0~3 dependents
-- K/0..3  : married with 0~3 dependents
-- K/I/0..3: married with spouse income combined, 0~3 dependents

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS ptkp_status VARCHAR(10);

ALTER TABLE customer
  ADD CONSTRAINT customer_ptkp_status_values CHECK (
    ptkp_status IS NULL OR ptkp_status IN (
      'TK/0', 'TK/1', 'TK/2', 'TK/3',
      'K/0',  'K/1',  'K/2',  'K/3',
      'K/I/0','K/I/1','K/I/2','K/I/3'
    )
  );

COMMENT ON COLUMN customer.ptkp_status IS
  'PTKP (Penghasilan Tidak Kena Pajak) status code per UU PPh Pasal 7. Used to prefill SPT 1770SS.';
