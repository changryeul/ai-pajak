-- Fix: Allow consultants to view customers through customer_consultant assignments
-- This policy complements the existing policy that only allows access via tax_filing
-- Note: is_jtc_consultant() already covers both CONSULTANT_JTC and TAX_ADVISOR_JTC roles

-- JTC consultants can view assigned customers via customer_consultant
CREATE POLICY "JTC consultants can view customers via assignment"
ON customer FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    id IN (
        SELECT customer_id
        FROM customer_consultant
        WHERE consultant_id = get_consultant_id()
        AND is_active = true
    )
);
