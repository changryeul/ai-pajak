-- Fix validate_tax_filing_poa trigger for customer review requests
--
-- Changes:
-- 1. Only require POA for 'FILED' status (actual DJP submission)
-- 2. 'UNDER_REVIEW' and 'DRAFT' status don't require POA
-- 3. Handle NULL consultant_id for customer-created filings
--
-- Customer flow:
-- - Customer creates DRAFT or UNDER_REVIEW filing without POA
-- - Tax advisor reviews and assigns themselves
-- - Tax advisor submits to DJP (requires POA)

CREATE OR REPLACE FUNCTION validate_tax_filing_poa()
RETURNS TRIGGER AS $$
DECLARE
    v_has_poa BOOLEAN;
    v_tax_partner_id UUID;
BEGIN
    -- Only check POA for FILED status (actual DJP submission)
    -- DRAFT and UNDER_REVIEW don't require POA (internal process)
    IF NEW.status NOT IN ('FILED') THEN
        RETURN NEW;
    END IF;

    -- For FILED status, consultant_id is required
    IF NEW.consultant_id IS NULL THEN
        RAISE EXCEPTION 'Tax filing submission requires an assigned consultant.';
    END IF;

    -- Get tax_partner_id from consultant
    SELECT tax_partner_id INTO v_tax_partner_id
    FROM consultant
    WHERE id = NEW.consultant_id;

    IF v_tax_partner_id IS NULL THEN
        RAISE EXCEPTION 'Consultant tax partner not found.';
    END IF;

    -- Check if active POA exists
    v_has_poa := has_active_poa(
        NEW.customer_id,
        v_tax_partner_id,
        NEW.tax_type,
        COALESCE(NEW.filed_at::DATE, CURRENT_DATE)
    );

    -- Require POA only for FILED status
    IF NOT v_has_poa THEN
        RAISE EXCEPTION 'Tax filing requires an active Power of Attorney. Customer must authorize tax partner before filing.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the trigger behavior
COMMENT ON FUNCTION validate_tax_filing_poa() IS
'Validates that an active POA exists before allowing tax filing submission.
Only checks POA for FILED status. DRAFT and UNDER_REVIEW are allowed without POA.
Customer creates filing -> Tax advisor reviews -> Tax advisor submits (requires POA)';
