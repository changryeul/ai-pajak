-- WHT one-sheet integrated import: audit enum.
--
-- POST /api/tax/wht-import 가 audit_log 에 한 줄 적재할 때 사용하는
-- activity_type enum 값. JTC 통합 매입 ledger 한 xlsx 업로드 → per-row
-- 분류 (PPh23 jasa/sewa, PPh4(2) T&B, PPh26) + PPN 동반 insert.
--
-- Pattern: PPH23_INVOICE_ATTACH (20260603000012) 과 동일.

DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'WHT_IMPORT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
