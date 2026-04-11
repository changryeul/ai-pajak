-- Phase B-2.1 follow-up: Relax the "Hard Rule 2: JTC-only consultants"
-- on tax_filing to accept active consultants from any tax_partner.
--
-- Under the multi-partner model, external tax consulting firms also
-- assign consultants to tax filings. The partner scope is still enforced
-- at a higher level (customer_consultant assignment + consultant.tax_partner_id).

DROP POLICY IF EXISTS "Only JTC consultants can be assigned" ON tax_filing;
DROP POLICY IF EXISTS "Active consultants can be assigned to filings" ON tax_filing;

CREATE POLICY "Active consultants can be assigned to filings"
ON tax_filing FOR INSERT
TO authenticated
WITH CHECK (
  consultant_id IN (
    SELECT id FROM consultant WHERE is_active = true
  )
);
