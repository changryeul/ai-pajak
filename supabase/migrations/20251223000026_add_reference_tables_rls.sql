-- ============================================================================
-- Migration: Add RLS to Reference Tables
-- Date: 2025-12-23
-- Purpose: Enable RLS on reference data tables for consistency
-- ============================================================================

-- Enable RLS on klu_codes
ALTER TABLE klu_codes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read KLU codes (public reference data)
CREATE POLICY "authenticated_users_can_view_klu_codes"
ON klu_codes FOR SELECT
TO authenticated
USING (true);

-- Only system/admin can modify KLU codes
CREATE POLICY "system_can_manage_klu_codes"
ON klu_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('SYSTEM', 'PLATFORM_ADMIN')
  )
);

-- Enable RLS on luxury_item_classifications
ALTER TABLE luxury_item_classifications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read luxury item classifications (public reference data)
CREATE POLICY "authenticated_users_can_view_luxury_items"
ON luxury_item_classifications FOR SELECT
TO authenticated
USING (true);

-- Only system/admin can modify luxury item classifications
CREATE POLICY "system_can_manage_luxury_items"
ON luxury_item_classifications FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('SYSTEM', 'PLATFORM_ADMIN')
  )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "authenticated_users_can_view_klu_codes" ON klu_codes IS
'All authenticated users can read KLU (Klasifikasi Lapangan Usaha) codes for tax rate lookup';

COMMENT ON POLICY "authenticated_users_can_view_luxury_items" ON luxury_item_classifications IS
'All authenticated users can read luxury item classifications for PPN rate determination';
