-- Server-side tracking for CUSTOMER → operator SPT Masa requests.
--
-- Background: CUSTOMER 가 `/tax/pph23` or `/tax/pph42` 의 "운영팀에 SPT Masa 제출
-- 요청" 버튼을 누르면 customer_ai 메신저에 메시지가 게시되고 localStorage 에
-- 마커가 저장돼 페이지에 "🟡 운영팀 검토 중" 배너가 보였다 (옵션 A, 2026-06-17).
-- 다른 기기에서 로그인하면 localStorage 가 없어 배너가 사라지는 한계 → 이
-- 테이블이 그 상태를 서버측 source of truth 로 보관 (옵션 B).
--
-- Lifecycle:
--   PENDING   — CUSTOMER 가 요청 (insert)
--   PROCESSED — 운영팀/컨설턴트가 실제 tax_filing 생성하면 자동 mark (filing_id
--               연결). 페이지 배너가 🟢 로 전환.
--   CANCELLED — CUSTOMER 가 "요청 취소" 클릭하면 mark.
--
-- Unique key (customer_id, tax_type, tax_period) — 한 period 당 활성 요청 1 개.
-- Re-request 시 같은 row UPSERT (status PENDING + requested_at refresh).

CREATE TYPE spt_masa_request_status AS ENUM ('PENDING', 'PROCESSED', 'CANCELLED');

CREATE TABLE spt_masa_submission_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tax_type text NOT NULL CHECK (tax_type IN ('PPh21', 'PPh23', 'PPN')),
  tax_period text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  status spt_masa_request_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES customer_ai_thread(id) ON DELETE SET NULL,
  processed_at timestamptz,
  filing_id uuid REFERENCES tax_filing(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tax_type, tax_period)
);

CREATE INDEX idx_spt_masa_req_customer_period
  ON spt_masa_submission_request (customer_id, tax_type, tax_period);
CREATE INDEX idx_spt_masa_req_status
  ON spt_masa_submission_request (status)
  WHERE status = 'PENDING';

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_spt_masa_req_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_spt_masa_req_updated_at
  BEFORE UPDATE ON spt_masa_submission_request
  FOR EACH ROW
  EXECUTE FUNCTION set_spt_masa_req_updated_at();

-- RLS
ALTER TABLE spt_masa_submission_request ENABLE ROW LEVEL SECURITY;

-- CUSTOMER: own customer row only.
CREATE POLICY spt_masa_req_customer_read ON spt_masa_submission_request
  FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );

CREATE POLICY spt_masa_req_customer_insert ON spt_masa_submission_request
  FOR INSERT
  WITH CHECK (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );

CREATE POLICY spt_masa_req_customer_update ON spt_masa_submission_request
  FOR UPDATE
  USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );

-- CONSULTANT: assigned customer's rows.
CREATE POLICY spt_masa_req_consultant_read ON spt_masa_submission_request
  FOR SELECT
  USING (
    customer_id IN (
      SELECT cc.customer_id
      FROM customer_consultant cc
      JOIN consultant c ON c.id = cc.consultant_id
      WHERE c.user_id = auth.uid() AND cc.is_active = true AND c.is_active = true
    )
  );

-- OPERATOR / SUPERVISOR / MASTER: all rows (service role bypasses RLS — operator
-- endpoints use service-role admin client).

COMMENT ON TABLE spt_masa_submission_request IS
  'CUSTOMER → operator SPT Masa submission requests. Server-side source of truth replaces localStorage marker so the "운영팀 검토 중" banner survives across devices.';
