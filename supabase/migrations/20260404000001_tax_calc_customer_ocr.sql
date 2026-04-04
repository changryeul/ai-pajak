-- Allow customer-initiated draft calculations (OCR invoice capture)
-- Previously consultant_id was NOT NULL; customers can now create drafts without a consultant

ALTER TABLE tax_calculation ALTER COLUMN consultant_id DROP NOT NULL;

-- Track how the calculation was created
ALTER TABLE tax_calculation ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'CONSULTANT';
COMMENT ON COLUMN tax_calculation.source IS 'CONSULTANT | CUSTOMER_OCR | CUSTOMER_MANUAL';

-- Store raw AI classification result for audit
ALTER TABLE tax_calculation ADD COLUMN IF NOT EXISTS invoice_classification JSONB;

-- RLS: Customers can create their own draft calculations (no consultant assigned)
CREATE POLICY "Customers can create own draft calculations"
ON tax_calculation FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    consultant_id IS NULL
);

-- RLS: Customers can update their own unassigned draft calculations
CREATE POLICY "Customers can update own unassigned calculations"
ON tax_calculation FOR UPDATE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    consultant_id IS NULL
)
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    consultant_id IS NULL
);

-- RLS: Customers can delete their own unassigned draft calculations
CREATE POLICY "Customers can delete own unassigned calculations"
ON tax_calculation FOR DELETE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    consultant_id IS NULL
);
