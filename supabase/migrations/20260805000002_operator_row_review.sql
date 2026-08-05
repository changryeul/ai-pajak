-- 워크큐 행 단위 '저장 및 확인' + 상담원/수퍼바이저 수정 이력
-- (수정요청 9·10·15·24, 2026-08-05)
--
-- operator_reviewed_at/by : 상담원이 팝업에서 '저장 및 확인' 을 누른 시각/사람.
--   찍히면 워크큐 행 상태가 '완료' 로 표시된다.
-- operator_edits : { "<field>": { "from": .., "to": .., "by": uuid,
--   "role": "COUNSELOR"|"SUPERVISOR", "at": iso } } 누적 —
--   수퍼바이저 화면에서 상담원 수정분(보라)/수퍼바이저 수정분(주황)을
--   색으로 구분해 보여주기 위한 표시용 이력. 회계적 사실은 원본 테이블
--   + audit_log(PUT withAudit) 가 진실원장.

ALTER TABLE monthly_payslip
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operator_edits jsonb;

ALTER TABLE pph23_transaction
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operator_edits jsonb;

ALTER TABLE ppn_faktur_monthly
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operator_edits jsonb;
