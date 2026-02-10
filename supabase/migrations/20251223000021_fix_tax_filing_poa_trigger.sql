-- Fix validate_tax_filing_poa trigger
-- The original trigger tried to SELECT from tax_filing table in a BEFORE INSERT trigger,
-- but the row doesn't exist yet. We need to use NEW values directly.

CREATE OR REPLACE FUNCTION validate_tax_filing_poa()
RETURNS TRIGGER AS $$
DECLARE
    v_has_poa BOOLEAN;
    v_tax_partner_id UUID;
BEGIN
    -- Get tax_partner_id from consultant
    -- In BEFORE INSERT, we use NEW.consultant_id directly
    SELECT tax_partner_id INTO v_tax_partner_id
    FROM consultant
    WHERE id = NEW.consultant_id;

    -- Check if active POA exists
    v_has_poa := has_active_poa(
        NEW.customer_id,  -- Use NEW directly
        v_tax_partner_id,
        NEW.tax_type,
        COALESCE(NEW.filed_at::DATE, CURRENT_DATE)
    );

    -- If status is FILED or UNDER_REVIEW, require POA
    IF NEW.status IN ('FILED', 'UNDER_REVIEW') AND NOT v_has_poa THEN
        RAISE EXCEPTION 'Tax filing requires an active Power of Attorney. Customer must authorize tax partner before filing.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
