-- Phase 6-follow: Customer PPh 25 election flag (at NPWP creation)
-- When a customer registers NPWP, they can opt to use PPh 25 from day 1
-- instead of the default UMKM PPh Final 0.5% regime.

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS npwp_pph25_elected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS npwp_pph25_elected_at DATE;

COMMENT ON COLUMN customer.npwp_pph25_elected IS 'TRUE if customer elected PPh 25 at NPWP creation (overrides UMKM 3-year default)';
COMMENT ON COLUMN customer.npwp_pph25_elected_at IS 'Date when PPh 25 election was made (typically NPWP issuance date)';
