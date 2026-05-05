-- Storage bucket for AI Payroll Employee Master photos.
-- Files are stored under  customer/<customer_id>/employee/<employee_id>.<ext>
-- so RLS can scope access by parsing the path.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-photos', 'employee-photos', false, 5 * 1024 * 1024, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- A logged-in user can read/write photos under their own customer's prefix.
-- Path prefix is "customer/<customer_id>/...". The customer is resolved via
-- the customer table so a user only sees their own bucket subtree.
DROP POLICY IF EXISTS employee_photos_self_select ON storage.objects;
CREATE POLICY employee_photos_self_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = 'customer'
    AND (storage.foldername(name))[2] IN (SELECT id::text FROM customer WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS employee_photos_self_write ON storage.objects;
CREATE POLICY employee_photos_self_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = 'customer'
    AND (storage.foldername(name))[2] IN (SELECT id::text FROM customer WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS employee_photos_self_delete ON storage.objects;
CREATE POLICY employee_photos_self_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = 'customer'
    AND (storage.foldername(name))[2] IN (SELECT id::text FROM customer WHERE user_id = auth.uid())
  );

-- Consultants of the same tax_partner can view (read-only) but not modify.
DROP POLICY IF EXISTS employee_photos_consultant_select ON storage.objects;
CREATE POLICY employee_photos_consultant_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = 'customer'
    AND (storage.foldername(name))[2] IN (
      SELECT cc.customer_id::text
      FROM customer_consultant cc
      JOIN consultant c ON c.id = cc.consultant_id
      WHERE c.tax_partner_id = get_consultant_tax_partner_id()
        AND cc.is_active = TRUE
    )
  );

-- Block platform admins outright.
DROP POLICY IF EXISTS employee_photos_block_platform_admin ON storage.objects;
CREATE POLICY employee_photos_block_platform_admin
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id <> 'employee-photos'
    OR NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'PLATFORM_ADMIN'
        AND is_active = TRUE
    )
  );
