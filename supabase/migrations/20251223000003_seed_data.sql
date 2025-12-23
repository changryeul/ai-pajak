-- AI Pajak Seed Data
-- Version: 1.0
-- Date: 2025-12-23
-- Description: Initial seed data for platform entities

-- ============================================================================
-- PLATFORM OWNER (Mono Flip Global)
-- ============================================================================

INSERT INTO platform_owner (
    id,
    name,
    legal_name,
    npwp,
    address,
    email,
    phone
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Mono Flip Global',
    'PT Mono Flip Global Indonesia',
    '0123456789012345', -- Replace with actual NPWP
    'Jakarta, Indonesia', -- Replace with actual address
    'admin@monoflip.com',
    '+62-xxx-xxxx-xxxx'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- PLATFORM (AI Pajak)
-- ============================================================================

INSERT INTO platform (
    id,
    platform_owner_id,
    name,
    domain,
    service_agreement_url,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'AI Pajak',
    'ai-pajak.com',
    'https://ai-pajak.com/terms-of-service',
    true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TAX PARTNER (Jakarta Tax Consulting)
-- ============================================================================

INSERT INTO tax_partner (
    id,
    platform_id,
    name,
    legal_name,
    tax_license_number,
    npwp,
    email_domain,
    address,
    email,
    phone,
    is_active,
    partnership_start_date
) VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'Jakarta Tax Consulting',
    'PT Jakarta Tax Consulting',
    'JTC-LICENSE-2025-001', -- Replace with actual tax license
    '9876543210987654', -- Replace with actual NPWP
    'jakartatax.co.id',
    'Jakarta, Indonesia', -- Replace with actual address
    'contact@jakartatax.co.id',
    '+62-xxx-xxxx-xxxx',
    true,
    '2025-01-01'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE platform_owner IS 'Seed data: Mono Flip Global - single platform owner';
COMMENT ON TABLE platform IS 'Seed data: AI Pajak - single platform instance';
COMMENT ON TABLE tax_partner IS 'Seed data: Jakarta Tax Consulting - primary tax service provider';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify seed data
DO $$
DECLARE
    v_platform_owner_count INTEGER;
    v_platform_count INTEGER;
    v_tax_partner_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_platform_owner_count FROM platform_owner;
    SELECT COUNT(*) INTO v_platform_count FROM platform;
    SELECT COUNT(*) INTO v_tax_partner_count FROM tax_partner;

    RAISE NOTICE 'Seed data verification:';
    RAISE NOTICE '  Platform Owner count: %', v_platform_owner_count;
    RAISE NOTICE '  Platform count: %', v_platform_count;
    RAISE NOTICE '  Tax Partner count: %', v_tax_partner_count;

    IF v_platform_owner_count != 1 THEN
        RAISE WARNING 'Expected 1 platform owner, found %', v_platform_owner_count;
    END IF;

    IF v_platform_count != 1 THEN
        RAISE WARNING 'Expected 1 platform, found %', v_platform_count;
    END IF;

    IF v_tax_partner_count != 1 THEN
        RAISE WARNING 'Expected 1 tax partner, found %', v_tax_partner_count;
    END IF;
END $$;
