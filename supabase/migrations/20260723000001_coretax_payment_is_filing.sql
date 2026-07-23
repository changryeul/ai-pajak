-- ============================================================
-- Coretax era: 납부 = 신고 (2026-07-23)
--
-- 현행 Coretax 체계에서는 고객이 ID Billing 을 납부하면 NTPN 이 Coretax
-- 안에서 자동 생성되고, 납부가 신고의 역할까지 수행한다. 따라서 구방식
-- (고객 납부증빙 업로드 → 운영팀 검증 → DJP 제출 → BPE 수령) 4개 상태를
-- 워크플로우에서 제거한다.
--
-- 새 상태기계:
--   PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED
--   → EBILLING_GENERATED → PAYMENT_PENDING(고객 전송·납부대기, 실질 종료)
--   → COMPLETED(향후 Coretax API 연동 시 NTPN 자동수집이 전이) / FAILED
--
-- 기존 row 매핑:
--   PAYMENT_UPLOADED / PAYMENT_VERIFIED → PAYMENT_PENDING (납부대기로 회귀)
--   DJP_SUBMITTED / BPE_UPLOADED        → COMPLETED (구방식 신고 완료 간주)
--
-- 컬럼(payment_proof_url, bpe_number 등)은 과거 데이터 보존을 위해 유지.
-- ============================================================

ALTER TABLE djp_submission_queue DROP CONSTRAINT IF EXISTS djp_submission_queue_status_check;

UPDATE djp_submission_queue
   SET status = 'PAYMENT_PENDING', updated_at = NOW()
 WHERE status IN ('PAYMENT_UPLOADED', 'PAYMENT_VERIFIED');

UPDATE djp_submission_queue
   SET status = 'COMPLETED',
       completed_at = COALESCE(completed_at, NOW()),
       updated_at = NOW()
 WHERE status IN ('DJP_SUBMITTED', 'BPE_UPLOADED');

ALTER TABLE djp_submission_queue ADD CONSTRAINT djp_submission_queue_status_check
  CHECK (status IN (
    'PENDING',
    'PENDING_DOCS',
    'DATA_REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'EBILLING_GENERATED',
    'PAYMENT_PENDING',
    'COMPLETED',
    'FAILED'
  ));

-- View 는 SELECT * 이므로 컬럼 변화 없음 — 재생성 불필요.
