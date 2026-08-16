-- 수정요청 #64 (2026-08-16) — 부가세 누적 미환급 잔액(carryover) 원장.
--
-- 로직 (상담원이 Coretax 누적값을 수동 입력 = opening_credit):
--   month_net      = 이번달 매출PPN − 매입PPN (양수=납부, 음수=환급/크레딧)
--   opening_credit = 이월 기초 누적 미환급액 (≥0, Coretax 기준, 상담원 입력)
--   payable        = month_net>0 ? max(0, month_net − opening_credit) : 0
--   closing_credit = month_net>0 ? max(0, opening_credit − month_net)
--                                : opening_credit + (−month_net)
--   payable>0 이면 그 금액으로 부가세 납부 ID Billing 발행 대상.
--
-- (customer, tax_period) 당 1행 — 재계산 시 UPSERT.

CREATE TABLE ppn_cumulative_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tax_period text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  opening_credit numeric NOT NULL DEFAULT 0,   -- Coretax 이월 누적 미환급액 (상담원 입력)
  month_net numeric NOT NULL DEFAULT 0,        -- 이번달 매출PPN − 매입PPN
  payable numeric NOT NULL DEFAULT 0,          -- 이번달 납부액 (ID Billing 대상)
  closing_credit numeric NOT NULL DEFAULT 0,   -- 이월 후 잔여 미환급 크레딧
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tax_period)
);

CREATE INDEX idx_ppn_cum_customer ON ppn_cumulative_balance (customer_id, tax_period);

ALTER TABLE ppn_cumulative_balance ENABLE ROW LEVEL SECURITY;
-- 상담원/운영팀 전용 — 서비스 롤(미들웨어 인증 후 admin)로만 접근. 고객 정책 없음.
