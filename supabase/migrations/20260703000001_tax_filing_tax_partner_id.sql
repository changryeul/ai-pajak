-- P4 (2026-07-03): tax_filing 에 신고 주체 (tax_partner) 를 명시적으로 저장.
--
-- 기존에는 consultant_id → consultant.tax_partner_id 로 파생값을 유도했으나,
-- (a) audit trail 재구성 시 consultant 이관이 있으면 이력이 흐트러지고
-- (b) 세무컨설팅 법인 (EXTERNAL) 이 자기 이름으로 신고했다는 근거를 남길
--     명시적 컬럼이 필요해서 tax_filing.tax_partner_id 를 추가한다.
--
-- Nullable 로 시작 (기존 신고 backfill 후 애플리케이션 로직이 항상 채움).

ALTER TABLE tax_filing
  ADD COLUMN IF NOT EXISTS tax_partner_id UUID REFERENCES tax_partner(id);

-- Backfill 기존 행: consultant 소속 tax_partner 를 복사
UPDATE tax_filing tf
SET tax_partner_id = c.tax_partner_id
FROM consultant c
WHERE tf.consultant_id = c.id
  AND tf.tax_partner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tax_filing_tax_partner ON tax_filing(tax_partner_id);

COMMENT ON COLUMN tax_filing.tax_partner_id IS
  '신고 주체 tax_partner. JTC (내부, default 대행자) 또는 EXTERNAL (세무컨설팅 법인). App layer 가 insert 시 consultant.tax_partner_id 를 복사.';
