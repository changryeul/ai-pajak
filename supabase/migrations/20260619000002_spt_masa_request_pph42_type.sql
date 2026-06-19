-- Allow PPh4(2) as a separate SPT Masa request + filing tax_type.
--
-- Phase: PPh4(2) 자체 SPT Masa 분리 (2026-06-19). 토지·건물 임대 PPh Final 은
-- 인니 세무 양식에서 PPh23 와 별도 (Bukti Potong PPh Pasal 4(2)) 라 filing/
-- request 도 분리.

-- spt_masa_submission_request.tax_type CHECK 확장
ALTER TABLE spt_masa_submission_request
  DROP CONSTRAINT IF EXISTS spt_masa_submission_request_tax_type_check;

ALTER TABLE spt_masa_submission_request
  ADD CONSTRAINT spt_masa_submission_request_tax_type_check
  CHECK (tax_type IN ('PPh21', 'PPh23', 'PPh42', 'PPN'));

-- tax_filing 의 tax_type ENUM 에 PPh42 추가 (legacy PPh_FINAL 과 별도 — PPh4(2)
-- 의 토지·건물 임대 분류만 정확히 표시).
ALTER TYPE tax_type ADD VALUE IF NOT EXISTS 'PPh42';
