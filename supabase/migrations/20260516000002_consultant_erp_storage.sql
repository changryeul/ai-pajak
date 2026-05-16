-- Storage bucket for Consultant ERP source documents.
-- Private bucket; only consultants / supervisors of the matching tax_partner
-- read or write, enforced both at the API layer and via storage RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultant-erp-docs',
  'consultant-erp-docs',
  false,
  20971520,  -- 20 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The API layer (requireConsultantOrSupervisor + ensureSessionAccess) is the
-- primary gate. These storage policies add defence-in-depth so a direct
-- supabase client cannot leak files across tax_partner boundaries.

DROP POLICY IF EXISTS "consultant_erp_docs_read" ON storage.objects;
CREATE POLICY "consultant_erp_docs_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consultant-erp-docs'
  AND EXISTS (
    SELECT 1
    FROM consultant_session_document d
    JOIN consultant_session s ON s.id = d.session_id
    WHERE d.storage_path = name
      AND s.tax_partner_id = get_consultant_tax_partner_id()
  )
);

DROP POLICY IF EXISTS "consultant_erp_docs_write" ON storage.objects;
CREATE POLICY "consultant_erp_docs_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'consultant-erp-docs'
  AND get_consultant_tax_partner_id() IS NOT NULL
);
