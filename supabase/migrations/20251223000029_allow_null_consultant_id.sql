-- Allow NULL consultant_id for customer-created filings
--
-- Customer flow:
-- 1. Customer creates filing (consultant_id = NULL)
-- 2. Tax advisor reviews and assigns themselves
-- 3. Tax advisor submits to DJP (consultant_id required)

-- Make consultant_id nullable
ALTER TABLE tax_filing
ALTER COLUMN consultant_id DROP NOT NULL;

-- Add comment explaining the flow
COMMENT ON COLUMN tax_filing.consultant_id IS
'Consultant assigned to this filing. NULL for customer-created drafts. Required for FILED status.';
