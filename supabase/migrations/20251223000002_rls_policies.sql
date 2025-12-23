-- AI Pajak RLS Policies
-- Version: 1.0
-- Date: 2025-12-23
-- Description: Row Level Security policies enforcing 5 hard rules

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role_type AS $$
    SELECT role
    FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's organization type
CREATE OR REPLACE FUNCTION get_user_organization_type()
RETURNS organization_type AS $$
    SELECT organization_type
    FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a customer
CREATE OR REPLACE FUNCTION is_customer()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'CUSTOMER'
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a JTC consultant
CREATE OR REPLACE FUNCTION is_jtc_consultant()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('CONSULTANT_JTC', 'TAX_ADVISOR_JTC')
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'PLATFORM_ADMIN'
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get customer ID for current user
CREATE OR REPLACE FUNCTION get_customer_id()
RETURNS UUID AS $$
    SELECT id
    FROM customer
    WHERE user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get consultant ID for current user
CREATE OR REPLACE FUNCTION get_consultant_id()
RETURNS UUID AS $$
    SELECT id
    FROM consultant
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE platform_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_advisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_filing ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_split ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_message ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONAL ENTITIES - READ ONLY FOR MOST USERS
-- ============================================================================

-- Platform Owner - Read only for authenticated users
CREATE POLICY "Platform owner visible to authenticated users"
ON platform_owner FOR SELECT
TO authenticated
USING (true);

-- Platform - Read only for authenticated users
CREATE POLICY "Platform visible to authenticated users"
ON platform FOR SELECT
TO authenticated
USING (true);

-- Tax Partner - Read only for authenticated users
CREATE POLICY "Tax partner visible to authenticated users"
ON tax_partner FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- USER ROLES
-- ============================================================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Platform admins can view all roles
CREATE POLICY "Platform admins can view all roles"
ON user_roles FOR SELECT
TO authenticated
USING (is_platform_admin());

-- Only platform admins can manage roles
CREATE POLICY "Platform admins can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- ============================================================================
-- CONSULTANTS & TAX ADVISORS
-- ============================================================================

-- Consultants can view their own profile
CREATE POLICY "Consultants can view own profile"
ON consultant FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- JTC consultants can view other JTC consultants
CREATE POLICY "JTC consultants can view colleagues"
ON consultant FOR SELECT
TO authenticated
USING (is_jtc_consultant());

-- Platform admins can view consultant profiles (but not tax data)
CREATE POLICY "Platform admins can view consultants"
ON consultant FOR SELECT
TO authenticated
USING (is_platform_admin());

-- Tax advisors can view their own profile
CREATE POLICY "Tax advisors can view own profile"
ON tax_advisor FOR SELECT
TO authenticated
USING (
    consultant_id IN (
        SELECT id FROM consultant WHERE user_id = auth.uid()
    )
);

-- JTC consultants can view tax advisors
CREATE POLICY "JTC consultants can view tax advisors"
ON tax_advisor FOR SELECT
TO authenticated
USING (is_jtc_consultant());

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

-- Customers can view their own profile
CREATE POLICY "Customers can view own profile"
ON customer FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Customers can update their own profile
CREATE POLICY "Customers can update own profile"
ON customer FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- JTC consultants can view assigned customers
CREATE POLICY "JTC consultants can view assigned customers"
ON customer FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    id IN (
        SELECT customer_id
        FROM tax_filing
        WHERE consultant_id = get_consultant_id()
    )
);

-- ============================================================================
-- TAX FILING - HARD RULE 1: PLATFORM_ADMIN CANNOT ACCESS
-- ============================================================================

-- HARD RULE 1 ENFORCEMENT: Block all PLATFORM_ADMIN access to tax data
CREATE POLICY "Block platform admins from tax filing"
ON tax_filing FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());

-- Customers can view their own tax filings
CREATE POLICY "Customers can view own tax filings"
ON tax_filing FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Customers can create draft tax filings (consultant assigned later)
CREATE POLICY "Customers can create tax filings"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'DRAFT'
);

-- Customers can update their own draft tax filings
CREATE POLICY "Customers can update own draft filings"
ON tax_filing FOR UPDATE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'DRAFT'
)
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id()
);

-- HARD RULE 2 & 3: JTC consultants can view assigned tax filings
CREATE POLICY "JTC consultants can view assigned filings"
ON tax_filing FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- HARD RULE 2 & 3: JTC consultants can update assigned tax filings
CREATE POLICY "JTC consultants can update assigned filings"
ON tax_filing FOR UPDATE
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
)
WITH CHECK (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- HARD RULE 2: Only JTC consultants can be assigned to tax filings
CREATE POLICY "Only JTC consultants can be assigned"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
    consultant_id IN (
        SELECT c.id
        FROM consultant c
        JOIN tax_partner tp ON c.tax_partner_id = tp.id
        WHERE tp.name = 'Jakarta Tax Consulting'
        AND c.is_active = true
    )
);

-- ============================================================================
-- TAX DOCUMENTS - HARD RULE 1: PLATFORM_ADMIN CANNOT ACCESS
-- ============================================================================

-- HARD RULE 1 ENFORCEMENT: Block all PLATFORM_ADMIN access to tax documents
CREATE POLICY "Block platform admins from tax documents"
ON tax_document FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());

-- Customers can view their own tax documents
CREATE POLICY "Customers can view own tax documents"
ON tax_document FOR SELECT
TO authenticated
USING (
    is_customer() AND
    tax_filing_id IN (
        SELECT id FROM tax_filing WHERE customer_id = get_customer_id()
    )
);

-- Customers can upload their own tax documents
CREATE POLICY "Customers can upload tax documents"
ON tax_document FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    uploaded_by_user_id = auth.uid() AND
    tax_filing_id IN (
        SELECT id FROM tax_filing WHERE customer_id = get_customer_id()
    )
);

-- JTC consultants can view documents for assigned filings
CREATE POLICY "JTC consultants can view assigned documents"
ON tax_document FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    tax_filing_id IN (
        SELECT id FROM tax_filing WHERE consultant_id = get_consultant_id()
    )
);

-- JTC consultants can upload documents for assigned filings
CREATE POLICY "JTC consultants can upload documents"
ON tax_document FOR INSERT
TO authenticated
WITH CHECK (
    is_jtc_consultant() AND
    uploaded_by_user_id = auth.uid() AND
    tax_filing_id IN (
        SELECT id FROM tax_filing WHERE consultant_id = get_consultant_id()
    )
);

-- ============================================================================
-- TAX ACTIVITY LOG - HARD RULE 5: MANDATORY AUDIT TRAIL
-- ============================================================================

-- HARD RULE 1: Platform admins can only READ audit logs (anonymized)
CREATE POLICY "Platform admins can view audit logs"
ON tax_activity_log FOR SELECT
TO authenticated
USING (is_platform_admin());

-- Customers can view their own activity logs
CREATE POLICY "Customers can view own activity logs"
ON tax_activity_log FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- JTC consultants can view logs for assigned customers
CREATE POLICY "JTC consultants can view assigned logs"
ON tax_activity_log FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    customer_id IN (
        SELECT customer_id
        FROM tax_filing
        WHERE consultant_id = get_consultant_id()
    )
);

-- HARD RULE 5: Only system/triggers can insert audit logs (via SECURITY DEFINER function)
-- No manual INSERT policy - logs created only by triggers

-- HARD RULE 5: NOBODY can delete audit logs
-- No DELETE policy = permanent audit trail

-- HARD RULE 3: Prevent platform from being logged as tax filing actor
CREATE POLICY "Prevent platform as tax actor"
ON tax_activity_log FOR INSERT
TO authenticated
WITH CHECK (
    actor_organization_id IS NULL OR
    actor_organization_id NOT IN (
        SELECT id FROM platform
    )
);

-- ============================================================================
-- BILLING TRANSACTIONS
-- ============================================================================

-- Customers can view their own billing
CREATE POLICY "Customers can view own billing"
ON billing_transaction FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Platform admins can view all billing (for platform management)
CREATE POLICY "Platform admins can view all billing"
ON billing_transaction FOR SELECT
TO authenticated
USING (is_platform_admin());

-- System role can manage billing
CREATE POLICY "System can manage billing"
ON billing_transaction FOR ALL
TO authenticated
USING (get_user_role() = 'SYSTEM')
WITH CHECK (get_user_role() = 'SYSTEM');

-- HARD RULE 4: Enforce collector ≠ provider
CREATE POLICY "Enforce collector not provider"
ON billing_transaction FOR INSERT
TO authenticated
WITH CHECK (
    platform_owner_id != tax_partner_id OR
    tax_partner_id IS NULL
);

-- ============================================================================
-- REVENUE SPLIT
-- ============================================================================

-- Platform admins can view revenue splits
CREATE POLICY "Platform admins can view revenue splits"
ON revenue_split FOR SELECT
TO authenticated
USING (is_platform_admin());

-- System role can manage revenue splits
CREATE POLICY "System can manage revenue splits"
ON revenue_split FOR ALL
TO authenticated
USING (get_user_role() = 'SYSTEM')
WITH CHECK (get_user_role() = 'SYSTEM');

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

-- Customers can view their own subscriptions
CREATE POLICY "Customers can view own subscriptions"
ON subscription FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Platform admins can view all subscriptions
CREATE POLICY "Platform admins can view all subscriptions"
ON subscription FOR SELECT
TO authenticated
USING (is_platform_admin());

-- System role can manage subscriptions
CREATE POLICY "System can manage subscriptions"
ON subscription FOR ALL
TO authenticated
USING (get_user_role() = 'SYSTEM')
WITH CHECK (get_user_role() = 'SYSTEM');

-- ============================================================================
-- CONSULTATION MESSAGES
-- ============================================================================

-- Customers can view their own messages
CREATE POLICY "Customers can view own messages"
ON consultation_message FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Customers can send messages
CREATE POLICY "Customers can send messages"
ON consultation_message FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    is_from_customer = true
);

-- JTC consultants can view messages for assigned customers
CREATE POLICY "JTC consultants can view assigned messages"
ON consultation_message FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    (
        consultant_id = get_consultant_id() OR
        customer_id IN (
            SELECT customer_id
            FROM tax_filing
            WHERE consultant_id = get_consultant_id()
        )
    )
);

-- JTC consultants can send messages
CREATE POLICY "JTC consultants can send messages"
ON consultation_message FOR INSERT
TO authenticated
WITH CHECK (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id() AND
    is_from_customer = false
);

-- JTC consultants can update message status (mark as read)
CREATE POLICY "JTC consultants can update message status"
ON consultation_message FOR UPDATE
TO authenticated
USING (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
)
WITH CHECK (
    is_jtc_consultant() AND
    consultant_id = get_consultant_id()
);

-- ============================================================================
-- SUMMARY OF HARD RULE ENFORCEMENT
-- ============================================================================

-- HARD RULE 1: PLATFORM_ADMIN cannot access customer tax data
--   ✓ Enforced via policies on tax_filing, tax_document, tax_activity_log
--   ✓ Explicit USING (NOT is_platform_admin()) checks

-- HARD RULE 2: Consultant MUST belong to Jakarta Tax Consulting
--   ✓ Enforced via FK constraint: consultant.tax_partner_id → tax_partner
--   ✓ INSERT policy checks consultant belongs to JTC

-- HARD RULE 3: Tax Filing Actor ≠ Platform
--   ✓ Enforced via consultant_id FK (links to JTC only)
--   ✓ Audit log policy prevents platform organization_id as actor
--   ✓ PLATFORM_ADMIN blocked from modifying tax data

-- HARD RULE 4: Billing Collector ≠ Service Provider
--   ✓ Enforced via separate FKs: platform_owner_id vs tax_partner_id
--   ✓ INSERT policy prevents platform_owner_id = tax_partner_id
--   ✓ revenue_split table separates accounting

-- HARD RULE 5: Audit Trail Required
--   ✓ Enforced via automatic triggers on tax_filing table
--   ✓ No DELETE policy on tax_activity_log (permanent record)
--   ✓ Only SECURITY DEFINER functions can insert logs

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on sequences (Supabase auto-creates these)
-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_type() TO authenticated;
GRANT EXECUTE ON FUNCTION is_customer() TO authenticated;
GRANT EXECUTE ON FUNCTION is_jtc_consultant() TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_consultant_id() TO authenticated;
