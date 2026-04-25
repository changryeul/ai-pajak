-- Expand the nationality / tax_residence_country check to any uppercase
-- ISO 3166-1 alpha-2 code. The previous CHECK was limited to ID/KR/US/JP,
-- but the customer profile UI now offers ~50 countries (see
-- src/config/nationalities.ts).

ALTER TABLE customer DROP CONSTRAINT IF EXISTS customer_nationality_supported;
ALTER TABLE customer
  ADD CONSTRAINT customer_nationality_supported
    CHECK (
      nationality IS NULL
      OR nationality ~ '^[A-Z]{2}$'
      OR nationality = 'OTHER'
    );

ALTER TABLE customer DROP CONSTRAINT IF EXISTS customer_tax_residence_supported;
ALTER TABLE customer
  ADD CONSTRAINT customer_tax_residence_supported
    CHECK (
      tax_residence_country IS NULL
      OR tax_residence_country ~ '^[A-Z]{2}$'
      OR tax_residence_country = 'OTHER'
    );

COMMENT ON COLUMN customer.nationality IS
  'ISO 3166-1 alpha-2 (or sentinel ''OTHER''). See src/config/nationalities.ts for the UI list.';
