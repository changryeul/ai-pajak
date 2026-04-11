-- Phase B-2.1: Tighten RLS so consultants only see customers belonging to
-- THEIR tax_partner, not every customer in the system.
--
-- Previously: is_jtc_consultant() only checked role membership, so any
-- consultant could see any customer (the tax_partner scope was not enforced
-- by RLS). This was safe when JTC was the only partner, but now that
-- external tax consulting firms can sign up, we must scope access.

-- Helper: returns the tax_partner_id of the current user's active consultant row
CREATE OR REPLACE FUNCTION get_consultant_tax_partner_id()
RETURNS UUID AS $$
    SELECT tax_partner_id
    FROM consultant
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_consultant_tax_partner_id() IS
  'Returns the tax_partner_id (UUID) associated with the current user, or NULL if the user is not an active consultant. Used by RLS policies to scope access to the consultant''s own tax_partner.';

-- ============================================================================
-- customer_consultant: replace blanket "any JTC consultant can see" with
-- "consultant can see their own assignments OR same-partner peers"
-- ============================================================================

-- Drop any legacy policies that might grant global JTC read on customer_consultant.
-- (These may or may not exist depending on migration history; DROP IF EXISTS is safe.)
DROP POLICY IF EXISTS "JTC consultants can view all assignments"
  ON customer_consultant;
DROP POLICY IF EXISTS "Consultants can view all customer_consultant"
  ON customer_consultant;

-- Permit SELECT when the row's consultant belongs to the SAME tax_partner as the viewer.
-- This is already implicit via the assignment-based policies in migration 20251223000010,
-- but we make the partner boundary explicit here for clarity and defense in depth.
CREATE POLICY "Same-partner consultants can view assignments"
ON customer_consultant FOR SELECT
TO authenticated
USING (
  consultant_id IN (
    SELECT id FROM consultant
    WHERE tax_partner_id = get_consultant_tax_partner_id()
  )
);

-- ============================================================================
-- customer: tighten to scope by tax_partner via customer_consultant join
-- ============================================================================

-- Drop the old "JTC can view everything" policy if present
DROP POLICY IF EXISTS "JTC consultants can view all customers" ON customer;
DROP POLICY IF EXISTS "Consultants can view customers" ON customer;

-- New policy: a consultant can SELECT a customer row only if there exists an
-- active customer_consultant assignment where the consultant belongs to the
-- viewer's tax_partner.
CREATE POLICY "Consultants view same-partner assigned customers"
ON customer FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM customer_consultant cc
    JOIN consultant c ON c.id = cc.consultant_id
    WHERE cc.customer_id = customer.id
      AND cc.is_active = true
      AND c.tax_partner_id = get_consultant_tax_partner_id()
  )
);

-- Consultants of the same tax_partner can INSERT customer rows.
-- The application layer is still responsible for creating the customer_consultant
-- assignment atomically after the customer is inserted.
CREATE POLICY "Consultants create customers for their partner"
ON customer FOR INSERT
TO authenticated
WITH CHECK (
  get_consultant_tax_partner_id() IS NOT NULL
);

-- Consultants of the same tax_partner can UPDATE customer rows assigned to them.
CREATE POLICY "Consultants update same-partner assigned customers"
ON customer FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM customer_consultant cc
    JOIN consultant c ON c.id = cc.consultant_id
    WHERE cc.customer_id = customer.id
      AND cc.is_active = true
      AND c.tax_partner_id = get_consultant_tax_partner_id()
  )
);

-- Note: The platform admin and customer-self policies from migration 20251223000002
-- remain in effect. This migration only tightens the consultant path.

-- ============================================================================
-- tax_filing: relax "JTC-only consultants can be assigned" to allow any
-- active consultant (from any tax_partner) to be assigned to a filing.
-- This was originally "Hard Rule 2" under the JTC-only model.
-- ============================================================================

DROP POLICY IF EXISTS "Only JTC consultants can be assigned" ON tax_filing;

CREATE POLICY "Active consultants can be assigned to filings"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
  consultant_id IN (
    SELECT id FROM consultant WHERE is_active = true
  )
);

-- Sanity logging for debugging — the policies above use the helper so
-- the following query should return exactly the rows visible to a given user:
--   SELECT * FROM customer;  -- under auth context
-- And the helper itself:
--   SELECT get_consultant_tax_partner_id();
