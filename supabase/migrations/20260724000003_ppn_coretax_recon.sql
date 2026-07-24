-- ============================================================
-- PPN Coretax 대조 (v19 상담원 백오피스 §9, 트랙 6 — 2026-07-24)
--
-- 고객이 올린 faktur(ppn_faktur_monthly)와 Coretax 에서 출력한 매출·매입
-- Faktur 리스트를 대조한다. Coretax 값을 같은 행에 나란히 저장하고
-- (coretax_dpp/coretax_ppn), 대조 상태(recon_status)를 계산해 차이 거래만
-- 개별 증빙 요청 대상으로 부각한다.
--
--   MATCH           : 고객 = Coretax (DPP·PPN 일치)
--   DIFF            : 값 불일치
--   MISSING_CORETAX : 고객 제출분이 Coretax 출력에 없음
--   MISSING_CUSTOMER: Coretax 에만 있고 고객 미제출 (source=CORETAX row)
--   PENDING         : 아직 대조 안 함 (기본)
-- ============================================================

ALTER TABLE ppn_faktur_monthly
  ADD COLUMN IF NOT EXISTS coretax_dpp NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS coretax_ppn NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS recon_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (recon_status IN ('PENDING', 'MATCH', 'DIFF', 'MISSING_CORETAX', 'MISSING_CUSTOMER')),
  ADD COLUMN IF NOT EXISTS recon_source VARCHAR(10) NOT NULL DEFAULT 'CUSTOMER'
    CHECK (recon_source IN ('CUSTOMER', 'CORETAX')),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

COMMENT ON COLUMN ppn_faktur_monthly.coretax_dpp IS 'Coretax 출력 DPP (대조용)';
COMMENT ON COLUMN ppn_faktur_monthly.coretax_ppn IS 'Coretax 출력 PPN (대조용)';
COMMENT ON COLUMN ppn_faktur_monthly.recon_status IS 'Coretax 대조 상태';
COMMENT ON COLUMN ppn_faktur_monthly.recon_source IS 'CUSTOMER=고객 제출행, CORETAX=Coretax 전용행(고객 미제출)';

CREATE INDEX IF NOT EXISTS idx_ppn_recon
  ON ppn_faktur_monthly(customer_id, tax_period, recon_status);
