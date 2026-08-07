-- 수정요청 #26 — 승인 없이 예외 발행 (2026-08-07)
--
-- 상담원이 워크큐 검토화면에서 수퍼바이저 승인 없이 고객요청/판단으로 ID Billing 을
-- 발행할 수 있는 예외 경로. 오발행 추적을 위해 예외 여부 + 사유를 발행 행에 각인한다.
-- (사유 필수 + case_audit_log(withAudit) + 수퍼바이저 in-app 통지가 애플리케이션 조건)

ALTER TABLE id_billing_issuance
  ADD COLUMN IF NOT EXISTS is_exception BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_reason TEXT;

COMMENT ON COLUMN id_billing_issuance.is_exception IS
  '수퍼바이저 승인 없이 예외 발행된 건 (수정요청 #26). issue_reason 에 사유 각인.';
COMMENT ON COLUMN id_billing_issuance.issue_reason IS
  '예외 발행 사유 (is_exception=true 일 때 필수). 감사 추적용.';
