-- Phase B-1: Extend tax_partner table to support external tax consultants
-- (not only Jakarta Tax Consulting / JTC).
--
-- Until now, tax_partner stored exactly 1 row for JTC, and CONSULTANT_JTC /
-- TAX_ADVISOR_JTC were hard-coded to that one partner. Now we open it up so
-- any external tax consulting firm can sign up as a tax_partner, and their
-- representative becomes a TAX_ADVISOR_JTC role (role name preserved for
-- backward compatibility).
--
-- Changes:
-- 1. Add partner_type column ('JTC' | 'EXTERNAL')
-- 2. Add is_platform_partner flag (true only for JTC — special relationship)
-- 3. Relax NOT NULL on tax_license_number, npwp, email_domain, partnership_start_date
--    to allow external firms to register without all fields upfront
-- 4. Relax UNIQUE constraint on tax_license_number and npwp to allow NULL values
--    (partial UNIQUE index for non-null values)

-- Add new columns
ALTER TABLE tax_partner
  ADD COLUMN IF NOT EXISTS partner_type VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL',
  ADD COLUMN IF NOT EXISTS is_platform_partner BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tax_partner
  ADD CONSTRAINT tax_partner_type_values CHECK (
    partner_type IN ('JTC', 'EXTERNAL')
  );

-- Mark the existing JTC row as the platform partner
UPDATE tax_partner
SET partner_type = 'JTC', is_platform_partner = TRUE
WHERE legal_name ILIKE '%Jakarta Tax Consulting%'
   OR name ILIKE '%Jakarta Tax Consulting%'
   OR email_domain = 'jakartatax.co.id';

-- Relax NOT NULL constraints so external firms can register with minimal info
ALTER TABLE tax_partner ALTER COLUMN tax_license_number DROP NOT NULL;
ALTER TABLE tax_partner ALTER COLUMN npwp DROP NOT NULL;
ALTER TABLE tax_partner ALTER COLUMN email_domain DROP NOT NULL;
ALTER TABLE tax_partner ALTER COLUMN partnership_start_date DROP NOT NULL;

-- Replace unique constraints with partial unique indexes (UNIQUE on non-null only)
ALTER TABLE tax_partner DROP CONSTRAINT IF EXISTS unique_tax_license;
ALTER TABLE tax_partner DROP CONSTRAINT IF EXISTS unique_npwp;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tax_partner_license_nonnull
  ON tax_partner(tax_license_number) WHERE tax_license_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tax_partner_npwp_nonnull
  ON tax_partner(npwp) WHERE npwp IS NOT NULL;

-- Index on partner_type for easy filtering
CREATE INDEX IF NOT EXISTS idx_tax_partner_type ON tax_partner(partner_type);

-- Similarly relax consultant.employment_start_date (not always known at signup time)
ALTER TABLE consultant ALTER COLUMN employment_start_date DROP NOT NULL;

COMMENT ON COLUMN tax_partner.partner_type IS
  'JTC = internal Jakarta Tax Consulting (1 row). EXTERNAL = external tax consulting firm registered via signup.';
COMMENT ON COLUMN tax_partner.is_platform_partner IS
  'TRUE only for the JTC row — marks the platform-level partner with special privileges and revenue sharing.';
