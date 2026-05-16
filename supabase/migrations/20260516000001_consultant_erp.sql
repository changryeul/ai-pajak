-- Consultant ERP — Phase 0 skeleton.
-- 10 tables in 3 clusters: session, counterparty master, legality vault.
-- Spec: docs/01-plan/features/consultant-erp.md (sections 1, 2).

-- ─── ENUMs ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE document_slot AS ENUM (
    'PAYROLL', 'WITHHOLDING_INVOICE', 'CORP_TAX_INPUT',
    'VAT_IN_OUT', 'OTHER_REFERENCE', 'BANK_STATEMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parse_severity AS ENUM ('CRITICAL', 'WARNING', 'INFO', 'OK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE calc_kind AS ENUM (
    'PPH21_TER', 'WITHHOLDING_SUMMARY', 'CORP_TAX_MONTHLY',
    'PPN_NET', 'BANK_RECON'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_action AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legality_category AS ENUM (
    'AKTA_PENDIRIAN', 'AKTA_PERUBAHAN', 'NIB_OSS',
    'LICENSE_SBU_SKK', 'COMPANY_NPWP', 'CORETAX_ACCESS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. consultant_session ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
  consultant_id UUID NOT NULL REFERENCES consultant(id),
  supervisor_id UUID REFERENCES consultant(id),
  filing_kind VARCHAR(10) NOT NULL CHECK (filing_kind IN ('MONTHLY', 'ANNUAL')),
  tax_period DATE NOT NULL,
  current_step SMALLINT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'UPLOADING', 'PARSING', 'REVIEWING',
                      'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
                      'COMPLETED', 'CANCELLED')),
  total_estimated_tax NUMERIC(18, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, filing_kind, tax_period)
);

CREATE INDEX IF NOT EXISTS idx_consultant_session_consultant
  ON consultant_session(consultant_id, status);
CREATE INDEX IF NOT EXISTS idx_consultant_session_supervisor_pending
  ON consultant_session(supervisor_id, status)
  WHERE status = 'PENDING_APPROVAL';
CREATE INDEX IF NOT EXISTS idx_consultant_session_partner
  ON consultant_session(tax_partner_id, status);

ALTER TABLE consultant_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_read ON consultant_session
  FOR SELECT
  USING (
    tax_partner_id = get_consultant_tax_partner_id()
    OR EXISTS (
      SELECT 1 FROM consultant c
      WHERE c.user_id = auth.uid()
        AND c.tax_partner_id = consultant_session.tax_partner_id
    )
  );

CREATE POLICY consultant_session_write ON consultant_session
  FOR ALL
  USING (
    tax_partner_id = get_consultant_tax_partner_id()
    OR EXISTS (
      SELECT 1 FROM consultant c
      WHERE c.user_id = auth.uid()
        AND c.tax_partner_id = consultant_session.tax_partner_id
    )
  );

-- ─── 2. consultant_session_document ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  slot document_slot NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  version SMALLINT NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (parse_status IN ('PENDING', 'PARSING', 'PARSED', 'FAILED')),
  parse_confidence SMALLINT,
  ai_model_version TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_session_slot_version
  ON consultant_session_document(session_id, slot, version);

ALTER TABLE consultant_session_document ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_document_rls ON consultant_session_document
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM consultant_session s
      WHERE s.id = consultant_session_document.session_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── 3. consultant_session_parse_row ────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session_parse_row (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES consultant_session_document(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  entity_label TEXT,
  field_name TEXT NOT NULL,
  field_value JSONB,
  severity parse_severity NOT NULL,
  issue_code TEXT,
  message_ko TEXT,
  message_id TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  client_message_sent BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_parse_row_doc_unresolved
  ON consultant_session_parse_row(document_id, severity)
  WHERE is_resolved = FALSE;

ALTER TABLE consultant_session_parse_row ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_parse_row_rls ON consultant_session_parse_row
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM consultant_session_document d
      JOIN consultant_session s ON s.id = d.session_id
      WHERE d.id = consultant_session_parse_row.document_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── 4. consultant_session_calc ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session_calc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  kind calc_kind NOT NULL,
  amount NUMERIC(18, 2),
  basis JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_summary TEXT,
  rationale_summary TEXT,
  confidence SMALLINT,
  consultant_memo TEXT,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, kind)
);

ALTER TABLE consultant_session_calc ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_calc_rls ON consultant_session_calc
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM consultant_session s
      WHERE s.id = consultant_session_calc.session_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── 5. consultant_session_approval ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role VARCHAR(40) NOT NULL,
  comment TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_session
  ON consultant_session_approval(session_id, created_at DESC);

ALTER TABLE consultant_session_approval ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_approval_rls ON consultant_session_approval
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM consultant_session s
      WHERE s.id = consultant_session_approval.session_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── 6. consultant_session_coretax_record ───────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_session_coretax_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES consultant_session(id) ON DELETE CASCADE,
  id_billing TEXT,
  ntpn TEXT,
  bpe_file_path TEXT,
  bpe_uploaded_at TIMESTAMPTZ,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

ALTER TABLE consultant_session_coretax_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultant_session_coretax_record_rls ON consultant_session_coretax_record
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM consultant_session s
      WHERE s.id = consultant_session_coretax_record.session_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── 7. counterparty_master (cross-tenant shared) ───────────────────────
CREATE TABLE IF NOT EXISTS counterparty_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npwp TEXT UNIQUE,
  nib TEXT,
  name TEXT NOT NULL,
  aliases TEXT[],
  country VARCHAR(2) NOT NULL DEFAULT 'ID',
  kbli TEXT,
  business_description TEXT,
  pkp_status VARCHAR(20)
    CHECK (pkp_status IS NULL OR pkp_status IN ('VERIFIED', 'UNVERIFIED', 'NON_RESIDENT')),
  suggested_pph_type TEXT,
  suggested_tax_rate NUMERIC(5, 2),
  evidence_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_trust SMALLINT NOT NULL DEFAULT 50 CHECK (overall_trust BETWEEN 0 AND 100),
  registered_by UUID REFERENCES consultant(id),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counterparty_master_npwp
  ON counterparty_master(npwp);
CREATE INDEX IF NOT EXISTS idx_counterparty_master_country
  ON counterparty_master(country);
-- Phase 4 will add a trigram name search index. Keeping it out of the P0 skeleton
-- avoids ordering issues with the pg_trgm extension on fresh `supabase db reset`.

ALTER TABLE counterparty_master ENABLE ROW LEVEL SECURITY;

-- Counterparty master is shared cross-tenant per spec ("공동 거래처 DB").
-- Any authenticated consultant or supervisor can read; only authenticated users
-- (any consultant/supervisor) can insert candidates that flow through review.
CREATE POLICY counterparty_master_read ON counterparty_master
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY counterparty_master_insert ON counterparty_master
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultant c WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY counterparty_master_update ON counterparty_master
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consultant c WHERE c.user_id = auth.uid()
    )
  );

-- ─── 8. counterparty_attribute_trust ────────────────────────────────────
CREATE TABLE IF NOT EXISTS counterparty_attribute_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id UUID NOT NULL REFERENCES counterparty_master(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  trust_score SMALLINT NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  source TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (counterparty_id, field_name)
);

ALTER TABLE counterparty_attribute_trust ENABLE ROW LEVEL SECURITY;

CREATE POLICY counterparty_attribute_trust_rls ON counterparty_attribute_trust
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── 9. counterparty_update_candidate ───────────────────────────────────
CREATE TABLE IF NOT EXISTS counterparty_update_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id UUID REFERENCES counterparty_master(id) ON DELETE SET NULL,
  proposed_payload JSONB NOT NULL,
  evidence_session_id UUID REFERENCES consultant_session(id) ON DELETE SET NULL,
  evidence_document_id UUID REFERENCES consultant_session_document(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE counterparty_update_candidate ENABLE ROW LEVEL SECURITY;

CREATE POLICY counterparty_update_candidate_rls ON counterparty_update_candidate
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── 10. legality_document ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legality_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  category legality_category NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  storage_path TEXT,
  original_filename TEXT,
  valid_until DATE,
  note TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_legality_customer_cat_ver
  ON legality_document(customer_id, category, version DESC);

ALTER TABLE legality_document ENABLE ROW LEVEL SECURITY;

CREATE POLICY legality_document_rls ON legality_document
  FOR ALL
  USING (
    -- The viewing consultant must belong to the same tax_partner as some active
    -- assignment for this customer (customer doesn't carry tax_partner_id directly;
    -- customer_consultant is the bridge).
    EXISTS (
      SELECT 1
      FROM customer_consultant cc
      JOIN consultant ct ON ct.id = cc.consultant_id
      WHERE cc.customer_id = legality_document.customer_id
        AND cc.is_active = TRUE
        AND ct.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

-- ─── updated_at triggers ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS consultant_session_touch ON consultant_session;
CREATE TRIGGER consultant_session_touch
  BEFORE UPDATE ON consultant_session
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS counterparty_master_touch ON counterparty_master;
CREATE TRIGGER counterparty_master_touch
  BEFORE UPDATE ON counterparty_master
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Comments for future maintainers.
COMMENT ON TABLE consultant_session IS
  'Phase 0/1 of Consultant ERP. One row per (customer, filing_kind, tax_period).';
COMMENT ON TABLE counterparty_master IS
  'Cross-tenant shared counterparty registry. Read open to all auth users; writes require consultant.';
COMMENT ON TABLE legality_document IS
  'Per-customer vault for incorporation deeds, licenses, NPWP cards, etc.';
