-- Annual closing wizard: PPh23 invoice photo traceability audit enum.
--
-- GET /api/tax/annual-closing/[id]/pph23-photo-status 가 audit_log 에
-- 한 줄 적재할 때 사용하는 activity_type enum 값.
--
-- Pattern: ANNUAL_CLOSING_AUTO_CREDITS_READ (20260603000013) 과 동일.

DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'ANNUAL_CLOSING_PPH23_PHOTO_STATUS_READ';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
