-- Add TAX_CODE_RULE_UPDATE to activity_type enum so audit_log filter by this
-- action returns real rows (otherwise withAudit falls back to TAX_CALCULATION
-- and stores the original action only in activity_details.action).

DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'TAX_CODE_RULE_UPDATE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
