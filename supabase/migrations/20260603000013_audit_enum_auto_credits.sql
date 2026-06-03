-- Annual closing wizard: credit step auto-fill audit enum.
--
-- GET /api/tax/annual-closing/[id]/auto-credits 가 audit_log 에 한 줄
-- 적재할 때 사용하는 activity_type enum 값.
--
-- Pattern: CUSTOMER_AI_TEMPLATE_UPDATE / TAX_CODE_RULE_UPDATE /
--          LUXURY_CLASSIFICATION_UPDATE 와 동일.

DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'ANNUAL_CLOSING_AUTO_CREDITS_READ';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
