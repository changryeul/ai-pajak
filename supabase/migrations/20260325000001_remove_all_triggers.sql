-- ============================================
-- Migration: Remove all database triggers
-- Date: 2026-03-25
-- Purpose: Move trigger logic to application layer (Go backoffice + Next.js)
-- Impact: Non-destructive (no data loss)
-- Prerequisite: All app-layer code must handle updated_at and audit logging
-- ============================================

-- ============================================
-- Step 1: Drop updated_at triggers (22)
-- These are replaced by explicit `updated_at = NOW()` in all UPDATE queries
-- ============================================

DROP TRIGGER IF EXISTS update_platform_owner_updated_at ON platform_owner;
DROP TRIGGER IF EXISTS update_platform_updated_at ON platform;
DROP TRIGGER IF EXISTS update_tax_partner_updated_at ON tax_partner;
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
DROP TRIGGER IF EXISTS update_consultant_updated_at ON consultant;
DROP TRIGGER IF EXISTS update_tax_advisor_updated_at ON tax_advisor;
DROP TRIGGER IF EXISTS update_customer_updated_at ON customer;
DROP TRIGGER IF EXISTS update_tax_filing_updated_at ON tax_filing;
DROP TRIGGER IF EXISTS update_billing_transaction_updated_at ON billing_transaction;
DROP TRIGGER IF EXISTS update_revenue_split_updated_at ON revenue_split;
DROP TRIGGER IF EXISTS update_subscription_updated_at ON subscription;
DROP TRIGGER IF EXISTS update_poa_updated_at ON power_of_attorney;
DROP TRIGGER IF EXISTS update_tax_calculation_updated_at ON tax_calculation;
DROP TRIGGER IF EXISTS update_notification_updated_at ON notification;
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS update_customer_consultant_updated_at ON customer_consultant;
DROP TRIGGER IF EXISTS update_document_updated_at ON document;
DROP TRIGGER IF EXISTS update_djp_job_updated_at ON djp_job;
DROP TRIGGER IF EXISTS update_djp_billing_updated_at ON djp_billing;
DROP TRIGGER IF EXISTS update_tax_law_analyses_updated_at ON tax_law_analyses;
DROP TRIGGER IF EXISTS update_dynamic_tax_rates_updated_at ON dynamic_tax_rates;
DROP TRIGGER IF EXISTS update_luxury_items_updated_at ON luxury_item_classifications;

-- Alternate trigger names (some migrations used different naming)
DROP TRIGGER IF EXISTS customer_consultant_updated_at ON customer_consultant;
DROP TRIGGER IF EXISTS notification_updated_at ON notification;
DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS trigger_update_tax_law_analyses_updated_at ON tax_law_analyses;
DROP TRIGGER IF EXISTS trigger_update_dynamic_tax_rates_updated_at ON dynamic_tax_rates;
DROP TRIGGER IF EXISTS trigger_update_klu_codes_updated_at ON klu_codes;
DROP TRIGGER IF EXISTS trigger_update_luxury_items_updated_at ON luxury_item_classifications;

-- ============================================
-- Step 2: Drop business logic triggers (4)
-- tax_filing_audit → AuditRepo.Log() in Go / explicit INSERT in Next.js
-- poa_audit → explicit INSERT in Next.js POA routes
-- validate_tax_filing_poa → TaxFilingService.UpdateStatus() in Go / requireValidPOA middleware in Next.js
-- generate_poa_number → POARepo.GeneratePOANumber() in Go / nextval() call in Next.js
-- ============================================

DROP TRIGGER IF EXISTS tax_filing_audit_trigger ON tax_filing;
DROP TRIGGER IF EXISTS poa_audit_trigger ON power_of_attorney;
DROP TRIGGER IF EXISTS validate_tax_filing_poa_trigger ON tax_filing;
DROP TRIGGER IF EXISTS generate_poa_number_trigger ON power_of_attorney;

-- ============================================
-- Step 3: Drop trigger-only functions (5)
-- RLS helper functions (get_user_role, is_customer, etc.) are PRESERVED
-- Sequence poa_number_seq is PRESERVED (used by app-level code)
-- ============================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS log_tax_filing_activity() CASCADE;
DROP FUNCTION IF EXISTS log_poa_activity() CASCADE;
DROP FUNCTION IF EXISTS validate_tax_filing_poa() CASCADE;
DROP FUNCTION IF EXISTS generate_poa_number() CASCADE;

-- ============================================
-- Step 4: Documentation comments
-- ============================================

COMMENT ON TABLE tax_activity_log IS
  'Audit log entries are now inserted by application layer (Go backoffice / Next.js API routes). '
  'Database triggers removed on 2026-03-25. All INSERT operations must include actor context.';

COMMENT ON TABLE tax_filing IS
  'POA validation and audit logging are now handled by application layer. '
  'All UPDATE queries must include explicit updated_at = NOW(). Triggers removed 2026-03-25.';

COMMENT ON TABLE power_of_attorney IS
  'POA number generation uses app-level nextval(poa_number_seq). '
  'Audit logging via app-level INSERT. Triggers removed 2026-03-25.';
