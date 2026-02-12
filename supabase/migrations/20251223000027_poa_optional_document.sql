-- ============================================================================
-- Migration: Allow optional document_url for DRAFT POA
-- ============================================================================
--
-- Purpose: Allow POA creation without document initially (DRAFT status)
-- Document can be uploaded before customer signs
--
-- Business Logic:
-- 1. DRAFT POA can be created without document
-- 2. Document must be uploaded before signing
-- 3. ACTIVE POA must have document
-- ============================================================================

-- Allow NULL for document_url column
ALTER TABLE power_of_attorney
ALTER COLUMN document_url DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN power_of_attorney.document_url IS
'Signed POA document URL (Supabase Storage). NULL allowed for DRAFT status, required before signing.';

-- Add constraint to ensure ACTIVE POA has document
-- (This is enforced by the sign endpoint, but adding as safety check)
ALTER TABLE power_of_attorney
DROP CONSTRAINT IF EXISTS chk_poa_status_requirements;

ALTER TABLE power_of_attorney
ADD CONSTRAINT chk_poa_status_requirements CHECK (
    -- ACTIVE status requires document
    (status != 'ACTIVE') OR (document_url IS NOT NULL)
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
    -- Verify column allows NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'power_of_attorney'
        AND column_name = 'document_url'
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE '✓ document_url column now allows NULL';
    ELSE
        RAISE WARNING '✗ document_url column still NOT NULL';
    END IF;
END $$;
