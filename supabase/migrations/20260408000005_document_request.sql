-- Document Request System
-- AI or operator can request additional documents from customers.
-- Operator requests are shown as "AI" to the customer (seamless UX).
-- Requests are sent via web notification + WhatsApp + Telegram.

-- document_category enum 확장 (receipt, invoice, faktur pajak)
DO $$ BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'RECEIPT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'INVOICE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'FAKTUR_PAJAK';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'SALARY_SLIP';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'EXPENSE_RECEIPT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────
-- Document submission batch — groups uploaded documents per period
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_submission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    period VARCHAR(7) NOT NULL,   -- YYYY-MM
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT → SUBMITTED → AI_REVIEWING → NEEDS_MORE → OPERATOR_REVIEWING → APPROVED → COMPLETED
    submitted_at TIMESTAMPTZ,
    ai_reviewed_at TIMESTAMPTZ,
    ai_result JSONB, -- { complete: bool, missing: [...], suggestions: [...] }
    operator_reviewed_at TIMESTAMPTZ,
    operator_reviewed_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, period)
);

ALTER TABLE document_submission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on doc_sub" ON document_submission FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customer view own" ON document_submission FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "Customer manage own" ON document_submission FOR ALL TO authenticated
USING (is_customer() AND customer_id = get_customer_id())
WITH CHECK (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned" ON document_submission FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));

CREATE POLICY "JTC manage" ON document_submission FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- ──────────────────────────────────────────────────────────
-- Document request — AI or operator asks for more documents
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    submission_id UUID REFERENCES document_submission(id),
    period VARCHAR(7) NOT NULL,

    -- Requester info (to customer it always looks like AI)
    requester_type VARCHAR(10) NOT NULL DEFAULT 'AI',  -- AI | OPERATOR
    requested_by UUID REFERENCES auth.users(id),       -- null for AI, user_id for operator

    -- Request details
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    required_documents JSONB NOT NULL,
    -- [{ type: 'FAKTUR_PAJAK', description: 'Faktur Pajak bulan Maret', priority: 'HIGH' }]

    -- Delivery channels
    sent_via_web BOOLEAN DEFAULT TRUE,
    sent_via_whatsapp BOOLEAN DEFAULT FALSE,
    sent_via_telegram BOOLEAN DEFAULT FALSE,
    whatsapp_sent_at TIMESTAMPTZ,
    telegram_sent_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING → PARTIALLY_FULFILLED → FULFILLED → EXPIRED
    fulfilled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_request_customer ON document_request(customer_id);
CREATE INDEX IF NOT EXISTS idx_doc_request_submission ON document_request(submission_id);
CREATE INDEX IF NOT EXISTS idx_doc_request_status ON document_request(status) WHERE status != 'FULFILLED';

ALTER TABLE document_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on doc_req" ON document_request FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customer view own requests" ON document_request FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC manage requests" ON document_request FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- Link documents to submissions
ALTER TABLE document
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES document_submission(id),
  ADD COLUMN IF NOT EXISTS upload_source VARCHAR(20) DEFAULT 'WEB'; -- WEB, CAMERA, PHOTO, WHATSAPP

CREATE INDEX IF NOT EXISTS idx_document_submission ON document(submission_id);

COMMENT ON TABLE document_submission IS 'Groups uploaded documents per month for batch AI review';
COMMENT ON TABLE document_request IS 'AI/operator document requests — always shown as AI to customer';
