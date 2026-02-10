-- Test Seed Data for E2E Testing
-- CRITICAL: This data must match the test fixtures in src/tests/e2e/fixtures/users.ts
-- NOTE: Platform entities (platform_owner, platform, tax_partner) are seeded in migrations
-- NOTE: auth.users are created via Supabase Auth API during test setup (not here)

-- ============================================
-- Test user emails and expected roles:
-- - customer.test@example.com -> CUSTOMER
-- - consultant.test@jakartatax.co.id -> CONSULTANT_JTC
-- - advisor.test@jakartatax.co.id -> TAX_ADVISOR_JTC
-- - admin.test@aipajak.com -> PLATFORM_ADMIN
-- ============================================

-- We don't insert into auth.users here because Supabase Auth uses GoTrue
-- which has a different password hashing mechanism. Test users will be
-- created via the Supabase Auth API during test setup.

-- The following data will be created AFTER users are created via Auth API
-- using a test setup script that links by email.

-- For now, we'll create placeholder data that can be linked later
-- or we'll use the test setup script to create everything together.

-- ============================================
-- Verification query (to check existing data)
-- ============================================

DO $$
DECLARE
  platform_owner_count INT;
  platform_count INT;
  tax_partner_count INT;
BEGIN
  SELECT COUNT(*) INTO platform_owner_count FROM platform_owner;
  SELECT COUNT(*) INTO platform_count FROM platform;
  SELECT COUNT(*) INTO tax_partner_count FROM tax_partner;

  RAISE NOTICE 'Seed data verification:';
  RAISE NOTICE '  - Platform Owner count: %', platform_owner_count;
  RAISE NOTICE '  - Platform count: %', platform_count;
  RAISE NOTICE '  - Tax Partner count: %', tax_partner_count;
END $$;
