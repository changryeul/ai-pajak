-- 2026-06-21: PPh21 정책 변경에 따라 추가된 audit action enum 값
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'EMPLOYEE_SYNC';
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'PAYSLIP_SUBMIT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
