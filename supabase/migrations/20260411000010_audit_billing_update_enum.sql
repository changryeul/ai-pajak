-- Phase G3 follow-up: extend the activity_type enum with values used by
-- the new billing/audit pipeline so they no longer fall back to
-- TAX_CALCULATION via the recordAudit() helper.
--
-- Each value is added with IF NOT EXISTS so re-running is safe.

DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'BILLING_UPDATE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
