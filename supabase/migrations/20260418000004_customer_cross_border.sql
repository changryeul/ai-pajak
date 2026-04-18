-- Cross-border tax profile on customer
-- Phase: PR3 Batch 3 (T-004 foreign-asset thresholds + T-005 nationality/residence).
--
-- Context: JTC's differentiated segment is Indonesia-resident foreigners
-- (notably Korean expats). Their Indonesian return is filed in Indonesia,
-- but they often also carry a home-country reporting obligation on
-- foreign financial accounts. Two knobs are enough to decide which rules
-- to run:
--
--   nationality            — civil passport (drives home-country reporting)
--   tax_residence_country  — where the user files primary income tax
--                            (usually ID for the expats we serve)
--
-- Kept as ISO 3166-1 alpha-2 strings with a CHECK on the rule-supported
-- set, rather than an ENUM, so adding a country later is a one-line
-- migration instead of an ALTER TYPE dance.

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS nationality            CHAR(2),
  ADD COLUMN IF NOT EXISTS tax_residence_country  CHAR(2);

ALTER TABLE customer
  DROP CONSTRAINT IF EXISTS customer_nationality_supported;
ALTER TABLE customer
  ADD CONSTRAINT customer_nationality_supported
    CHECK (nationality IS NULL OR nationality IN ('ID', 'KR', 'US', 'JP'));

ALTER TABLE customer
  DROP CONSTRAINT IF EXISTS customer_tax_residence_supported;
ALTER TABLE customer
  ADD CONSTRAINT customer_tax_residence_supported
    CHECK (tax_residence_country IS NULL OR tax_residence_country IN ('ID', 'KR', 'US', 'JP'));

COMMENT ON COLUMN customer.nationality IS
  'ISO 3166-1 alpha-2. Drives home-country foreign-asset reporting rules (see src/lib/cross-border/foreign-asset-rules.ts). NULL means unspecified.';
COMMENT ON COLUMN customer.tax_residence_country IS
  'Primary income-tax jurisdiction. For JTC''s expat segment this is usually ID while nationality is KR/US/JP.';
