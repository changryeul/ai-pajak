-- Adds optional profile fields surfaced on the customer-facing 내정보 page:
--   - employer_name: current workplace / PT name for INDIVIDUAL customers.
--     Used to pre-fill the 1770SS intake and cross-check against the
--     uploaded 1721-A1 bukti potong.
--   - coretax_password_hint: operator-facing hint for logging in to Coretax
--     on the customer's behalf (paired with coretax_id). Stored as a hint,
--     not a verified password.
--   - djp_passphrase_hint: companion to djp_password_hint — the DJP
--     signature passphrase (passphrase is a separate field from password).
--
-- All three are nullable and follow the existing `_hint` convention in the
-- customer table. They are not encrypted at rest — treat them as operator
-- memo fields, not authentication credentials.

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS employer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS coretax_password_hint VARCHAR(200),
  ADD COLUMN IF NOT EXISTS djp_passphrase_hint VARCHAR(200);

COMMENT ON COLUMN customer.employer_name IS
  'Current employer / workplace (INDIVIDUAL). Used by SPT 1770SS intake pre-fill.';
COMMENT ON COLUMN customer.coretax_password_hint IS
  'Operator hint for Coretax login. NOT a verified credential.';
COMMENT ON COLUMN customer.djp_passphrase_hint IS
  'Operator hint for the DJP signature passphrase. NOT a verified credential.';
