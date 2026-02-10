-- =====================================================
-- Storage Buckets Configuration
-- =====================================================
-- Creates storage buckets for document uploads
-- and sets up RLS policies for secure access

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'tax-documents',
    'tax-documents',
    false,
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
  ),
  (
    'poa-documents',
    'poa-documents',
    false,
    5242880, -- 5MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- RLS Policies for tax-documents bucket
-- =====================================================

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload tax documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tax-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own documents
CREATE POLICY "Users can read own tax documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow consultants to read documents of their assigned customers
CREATE POLICY "Consultants can read customer tax documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax-documents' AND
  EXISTS (
    SELECT 1
    FROM public.consultant c
    JOIN public.tax_filing tf ON tf.consultant_id = c.id
    JOIN public.tax_document td ON td.tax_filing_id = tf.id
    WHERE c.user_id = auth.uid()
    AND td.file_path = name
  )
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own tax documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tax-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- RLS Policies for poa-documents bucket
-- =====================================================

-- Allow authenticated users to upload POA documents
CREATE POLICY "Users can upload poa documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poa-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own POA documents
CREATE POLICY "Users can read own poa documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'poa-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow tax advisors to read POA documents for their customers
CREATE POLICY "Tax advisors can read customer poa documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'poa-documents' AND
  EXISTS (
    SELECT 1
    FROM public.consultant c
    JOIN public.tax_advisor ta ON ta.consultant_id = c.id
    JOIN public.power_of_attorney poa ON poa.tax_partner_id = (
      SELECT tax_partner_id FROM public.consultant WHERE id = c.id
    )
    WHERE c.user_id = auth.uid()
    AND poa.document_url LIKE '%' || name || '%'
  )
);

-- =====================================================
-- RLS Policies for avatars bucket (public)
-- =====================================================

-- Allow anyone to read avatars (public bucket)
CREATE POLICY "Anyone can read avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Note: Comments on storage policies are not supported in Supabase
-- See policy names for documentation
