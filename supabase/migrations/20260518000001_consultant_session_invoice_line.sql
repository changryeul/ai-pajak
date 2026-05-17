-- Per-invoice line items extracted from documents uploaded into a
-- consultant session. Lets the supervisor case-detail page (PDF p.4
-- 자료 탭의 인보이스 전체 표) show the full breakdown of a single
-- WITHHOLDING_INVOICE or VAT_IN_OUT document, not just an aggregated
-- amount on consultant_session_calc.
--
-- Each row = one line on one invoice. A single document can have many
-- lines. AI parsing fills these rows; the supervisor table is read-only.

CREATE TABLE IF NOT EXISTS consultant_session_invoice_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL
    REFERENCES consultant_session_document(id) ON DELETE CASCADE,
  session_id UUID NOT NULL
    REFERENCES consultant_session(id) ON DELETE CASCADE,
  line_no SMALLINT NOT NULL,

  -- Invoice header (denormalized, set identically on every line of the
  -- same invoice so the supervisor table can group cheaply).
  invoice_number TEXT,
  invoice_date DATE,
  counterparty_name TEXT,
  counterparty_npwp TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'IDR',

  -- Line body
  description TEXT,
  quantity NUMERIC(18, 4),
  unit_price NUMERIC(18, 2),
  subtotal NUMERIC(18, 2),
  vat_amount NUMERIC(18, 2),
  withholding_amount NUMERIC(18, 2),
  total NUMERIC(18, 2),

  -- AI provenance
  parse_confidence SMALLINT,
  ai_model_version TEXT,
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reviewer overrides (consultant fixed an OCR mistake)
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_note TEXT,

  UNIQUE (document_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_session
  ON consultant_session_invoice_line(session_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_document
  ON consultant_session_invoice_line(document_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_counterparty_npwp
  ON consultant_session_invoice_line(counterparty_npwp)
  WHERE counterparty_npwp IS NOT NULL;

ALTER TABLE consultant_session_invoice_line ENABLE ROW LEVEL SECURITY;

-- Same scoping rule as consultant_session_calc: visible iff the parent
-- session belongs to the caller's tax_partner.
CREATE POLICY consultant_session_invoice_line_rls ON consultant_session_invoice_line
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM consultant_session s
      WHERE s.id = consultant_session_invoice_line.session_id
        AND s.tax_partner_id = get_consultant_tax_partner_id()
    )
  );

COMMENT ON TABLE consultant_session_invoice_line IS
  'Line-item rows extracted from WITHHOLDING_INVOICE / VAT_IN_OUT documents in a consultant session. Supervisor case detail (PDF p.4) reads these; AI parser writes them.';
