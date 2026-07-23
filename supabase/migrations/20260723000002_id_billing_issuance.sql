-- ============================================================
-- ID Billing 발행 보드 (v19 상담원 백오피스 §4/§5, 2026-07-23)
--
-- 수퍼바이저 승인완료 건만 발행대상으로 이관되고, 회사별 Coretax 작성본
-- (계산값이 채워진 xlsx) 생성 이력이 있어야 발행할 수 있다 (백엔드 게이트).
-- 발행완료는 일련번호 리스트로 관리하며, NTPN 은 고객 납부 후 Coretax 가
-- 자동 생성하므로 수동 입력하지 않는다 (납부 = 신고).
--
-- 권한: JTC 운영팀(TAX_OPERATOR_*) + 세무법인 상담원(CONSULTANT/TAX_ADVISOR)
-- 모두 사용 — tenant 는 tax_partner_id 로 분리 (JTC / EXTERNAL).
-- ============================================================

-- 작성본(Coretax 입력 준비파일) 생성 이력 — 발행 게이트의 근거.
CREATE TABLE IF NOT EXISTS id_billing_workbook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_partner_id UUID NOT NULL REFERENCES tax_partner(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  source_kind VARCHAR(20) NOT NULL CHECK (source_kind IN ('ERP_SESSION', 'OPERATOR_QUEUE')),
  session_id UUID REFERENCES consultant_session(id) ON DELETE SET NULL,
  queue_item_id UUID REFERENCES djp_submission_queue(id) ON DELETE SET NULL,
  -- 생성 당시 항목 스냅샷 (세목/기간/DPP/세액) — 감사·분쟁 근거
  item_snapshot JSONB NOT NULL DEFAULT '[]',
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workbook_source_ref CHECK (
    (source_kind = 'ERP_SESSION' AND session_id IS NOT NULL) OR
    (source_kind = 'OPERATOR_QUEUE' AND queue_item_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ibwl_session ON id_billing_workbook_log(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ibwl_queue ON id_billing_workbook_log(queue_item_id) WHERE queue_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ibwl_partner ON id_billing_workbook_log(tax_partner_id, created_at DESC);

-- 발행완료 리스트 (일련번호 기반, v19 §4 — 카드 아님).
CREATE TABLE IF NOT EXISTS id_billing_issuance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_partner_id UUID NOT NULL REFERENCES tax_partner(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  source_kind VARCHAR(20) NOT NULL CHECK (source_kind IN ('ERP_SESSION', 'OPERATOR_QUEUE')),
  session_id UUID REFERENCES consultant_session(id) ON DELETE SET NULL,
  queue_item_id UUID REFERENCES djp_submission_queue(id) ON DELETE SET NULL,
  serial_no VARCHAR(30) NOT NULL,                 -- BIL-202607-001 (파트너별 유니크)
  tax_type VARCHAR(30) NOT NULL,                  -- PPh21 / PPh23 / PPh25 / PPh Final / PPN ...
  tax_period VARCHAR(7) NOT NULL,                 -- YYYY-MM
  kap_code VARCHAR(10) NOT NULL,
  kjs_code VARCHAR(10) NOT NULL,
  tax_base NUMERIC(18, 2),
  tax_rate VARCHAR(30),
  amount NUMERIC(18, 2) NOT NULL,
  billing_code VARCHAR(40),                       -- Coretax 발행 코드 (수동 기록 or 향후 API)
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'SENT', 'PAID', 'CANCELLED')),
  customer_email VARCHAR(255),
  sent_at TIMESTAMPTZ,
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT issuance_source_ref CHECK (
    (source_kind = 'ERP_SESSION' AND session_id IS NOT NULL) OR
    (source_kind = 'OPERATOR_QUEUE' AND queue_item_id IS NOT NULL)
  ),
  CONSTRAINT issuance_serial_per_partner UNIQUE (tax_partner_id, serial_no)
);

CREATE INDEX IF NOT EXISTS idx_ibi_partner ON id_billing_issuance(tax_partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ibi_session ON id_billing_issuance(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ibi_queue ON id_billing_issuance(queue_item_id) WHERE queue_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ibi_customer ON id_billing_issuance(customer_id);

-- RLS: 쓰기는 전부 API(admin client, 미들웨어 인증 후) 경유. 읽기는 자기
-- tax_partner 소속 consultant 에게만 허용 (defense in depth — 운영팀 role 은
-- consultant 행이 없어 API 경유로만 접근).
ALTER TABLE id_billing_workbook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_billing_issuance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ibwl_consultant_read ON id_billing_workbook_log;
CREATE POLICY ibwl_consultant_read ON id_billing_workbook_log
  FOR SELECT TO authenticated
  USING (tax_partner_id = get_consultant_tax_partner_id());

DROP POLICY IF EXISTS ibi_consultant_read ON id_billing_issuance;
CREATE POLICY ibi_consultant_read ON id_billing_issuance
  FOR SELECT TO authenticated
  USING (tax_partner_id = get_consultant_tax_partner_id());
