-- Customer Tax Profile fields
-- 법인 가입 시 수집하는 세무 관련 추가 정보
-- 세목(PPh21/22/23/26, PPN, PPh Final) 적용 여부 판단에 사용

ALTER TABLE customer
  -- Financial profile
  ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(18,2),        -- 연 매출 (IDR)
  ADD COLUMN IF NOT EXISTS revenue_year INTEGER,                -- 연 매출 기준 연도

  -- Workforce
  ADD COLUMN IF NOT EXISTS has_employees BOOLEAN DEFAULT FALSE, -- 직원 유무 → PPh 21 적용
  ADD COLUMN IF NOT EXISTS employee_count INTEGER,              -- 선택: 대략 인원 수

  -- VAT registration
  ADD COLUMN IF NOT EXISTS is_pkp BOOLEAN DEFAULT FALSE,        -- PKP (VAT registered) → PPN 신고 의무
  ADD COLUMN IF NOT EXISTS pkp_registered_at DATE,

  -- Business activities (affects withholding obligations)
  ADD COLUMN IF NOT EXISTS pays_service_fees BOOLEAN DEFAULT FALSE,   -- 서비스 비용 지급 → PPh 23 원천징수
  ADD COLUMN IF NOT EXISTS has_import_export BOOLEAN DEFAULT FALSE,   -- 수입/수출 → PPh 22, PPN import
  ADD COLUMN IF NOT EXISTS has_rental_business BOOLEAN DEFAULT FALSE; -- 임대 사업 → PPh 4(2) Final

COMMENT ON COLUMN customer.annual_revenue IS 'Annual revenue in IDR — determines PP 23/2018 eligibility (< Rp 4.8B)';
COMMENT ON COLUMN customer.is_pkp IS 'Pengusaha Kena Pajak — VAT registered, must file monthly SPT Masa PPN';
COMMENT ON COLUMN customer.pays_service_fees IS 'Pays for services subject to PPh 23 withholding (2%)';
COMMENT ON COLUMN customer.has_import_export IS 'Engaged in import/export — PPh 22 and import VAT obligations';
COMMENT ON COLUMN customer.has_rental_business IS 'Rental business income — PPh 4(2) Final 10%';
