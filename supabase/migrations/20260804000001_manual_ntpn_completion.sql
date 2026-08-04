-- Coretax API 연동 보류 결정 (2026-08-04).
-- 운영자가 Coretax 포털에서 수작업 처리 후 NTPN 을 직접 입력해
-- 납부확인(PAID) / 신고완료(COMPLETED) 를 닫는다.
--
--   id_billing_issuance : 납부확인 시 NTPN + paid_at 기록 (ISSUED/SENT → PAID)
--   djp_submission_queue: 발행 보드 납부확인이 소스 큐 행을 COMPLETED 로
--                         동기화할 때 NTPN 을 함께 저장

ALTER TABLE id_billing_issuance
  ADD COLUMN IF NOT EXISTS ntpn VARCHAR(40),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE djp_submission_queue
  ADD COLUMN IF NOT EXISTS ntpn VARCHAR(40);

COMMENT ON COLUMN id_billing_issuance.ntpn IS
  'NTPN (Nomor Transaksi Penerimaan Negara) — operator 수동 입력. Coretax API 연동 시 자동수집으로 대체 예정.';
COMMENT ON COLUMN djp_submission_queue.ntpn IS
  '월신고 납부 NTPN — 발행 보드 납부확인에서 수동 기록 (Coretax API 보류, 2026-08-04).';
