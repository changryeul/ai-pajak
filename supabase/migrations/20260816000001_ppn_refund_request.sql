-- 수정요청 #63 (2026-08-16) — 고객 PPN 환급신청(Restitusi)을 서버에 보관하고
-- 상담원이 볼 수 있게 한다. 기존엔 고객 화면 모달이 UI 로만 동작(저장/전달 없음)
-- 이라 신청해도 어디에도 남지 않아 상담원이 확인 불가였음.
--
-- Lifecycle: PENDING(고객 신청) → PROCESSED(상담원 처리) / CANCELLED(고객 취소).
-- (customer_id, tax_period) 당 활성 신청 1건 — 재신청 시 UPSERT.

CREATE TYPE ppn_refund_status AS ENUM ('PENDING', 'PROCESSED', 'CANCELLED');

CREATE TABLE ppn_refund_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tax_period text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_reason text,
  status ppn_refund_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tax_period)
);

CREATE INDEX idx_ppn_refund_req_customer ON ppn_refund_request (customer_id, tax_period);
CREATE INDEX idx_ppn_refund_req_status ON ppn_refund_request (status);

ALTER TABLE ppn_refund_request ENABLE ROW LEVEL SECURITY;

-- 고객은 본인 신청만 read/insert (customer.user_id 로 스코프).
CREATE POLICY ppn_refund_customer_read ON ppn_refund_request
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );
CREATE POLICY ppn_refund_customer_insert ON ppn_refund_request
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );
CREATE POLICY ppn_refund_customer_update ON ppn_refund_request
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );
-- 상담원/운영팀은 서비스 롤(미들웨어 인증 후 admin 클라이언트)로 접근하므로 별도 정책 불필요.
