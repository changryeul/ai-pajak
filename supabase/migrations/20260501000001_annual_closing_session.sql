-- Annual closing wizard persistence
-- Stores per-customer closing sessions, uploaded documents, and Koreksi Fiskal entries
-- so the UMKM / PPh25 wizards retain progress and inputs across navigations.

-- ── tax_closing_session ─────────────────────────────────────────────
-- One row per (customer, fiscal_year). Stores wizard step + UMKM/PPh25 selection
-- and any free-form data we want to retain (basic info, tax-credit inputs, etc.)
CREATE TABLE IF NOT EXISTS tax_closing_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  closing_type TEXT NOT NULL CHECK (closing_type IN ('UMKM', 'PPH25')),
  current_step TEXT NOT NULL DEFAULT 'basic',
  -- Free-form payload: basic info, computed totals, last-saved field values, etc.
  -- Keeps schema flexible while wizard evolves.
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_statements_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_closing_session_year UNIQUE (customer_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_closing_session_customer ON tax_closing_session(customer_id);
CREATE INDEX IF NOT EXISTS idx_closing_session_year ON tax_closing_session(fiscal_year);

-- ── closing_document ────────────────────────────────────────────────
-- Each uploaded document slot (akta, bank, sales, ...) → one row.
-- File itself lives in storage bucket 'closing-documents'.
CREATE TABLE IF NOT EXISTS closing_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tax_closing_session(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,            -- 'akta', 'bank', 'sales', 'purchase', ...
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,        -- closing-documents/<userId>/<sessionId>/<docType>-<ts>-<name>
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_closing_document_slot UNIQUE (session_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_closing_document_session ON closing_document(session_id);

-- ── closing_adjustment_entry ────────────────────────────────────────
-- Koreksi Fiskal positive/negative entries. PPh25 path uses this; UMKM ignores.
CREATE TABLE IF NOT EXISTS closing_adjustment_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tax_closing_session(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('POSITIVE', 'NEGATIVE')),
  item_code TEXT NOT NULL,           -- 'entertainment', 'vehicle', 'phone', ...
  amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  cap_pct NUMERIC(5, 2),             -- e.g. 50 for 50% cap; null = no cap
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_closing_adjustment UNIQUE (session_id, direction, item_code)
);

CREATE INDEX IF NOT EXISTS idx_closing_adjustment_session ON closing_adjustment_entry(session_id);

-- ── updated_at trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_closing_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_closing_session ON tax_closing_session;
CREATE TRIGGER trg_touch_closing_session
  BEFORE UPDATE ON tax_closing_session
  FOR EACH ROW
  EXECUTE FUNCTION touch_closing_session_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE tax_closing_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_adjustment_entry ENABLE ROW LEVEL SECURITY;

-- Customer can read/write only their own session (joined via customer.user_id)
CREATE POLICY closing_session_owner_select ON tax_closing_session
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()));

CREATE POLICY closing_session_owner_modify ON tax_closing_session
  FOR ALL TO authenticated
  USING (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()))
  WITH CHECK (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()));

CREATE POLICY closing_document_owner_select ON closing_document
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY closing_document_owner_modify ON closing_document
  FOR ALL TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY closing_adjustment_owner_select ON closing_adjustment_entry
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY closing_adjustment_owner_modify ON closing_adjustment_entry
  FOR ALL TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

-- ── Storage bucket: closing-documents ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'closing-documents',
  'closing-documents',
  FALSE,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: file path is `<userId>/<sessionId>/<filename>`
-- so customer can only access their own folder.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'closing_documents_owner_insert'
  ) THEN
    CREATE POLICY closing_documents_owner_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'closing-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'closing_documents_owner_select'
  ) THEN
    CREATE POLICY closing_documents_owner_select ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'closing-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'closing_documents_owner_delete'
  ) THEN
    CREATE POLICY closing_documents_owner_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'closing-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

COMMENT ON TABLE tax_closing_session IS 'Annual closing wizard session per customer/fiscal year';
COMMENT ON TABLE closing_document IS 'Uploaded supporting documents for an annual closing session';
COMMENT ON TABLE closing_adjustment_entry IS 'Koreksi Fiskal positive/negative entries for PPh25 closings';
