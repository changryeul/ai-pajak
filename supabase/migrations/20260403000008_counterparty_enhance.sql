-- Enhance tax_counterparty with KBLI, qualification, country fields
-- Supports Tax Resolution Engine auto-classification

ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS kbli_code VARCHAR(5);
ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS qualification_grade VARCHAR(20); -- SMALL, MEDIUM_LARGE, QUALIFIED, NONE
ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'ID'; -- ISO 3166-1 alpha-2
ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS is_resident BOOLEAN DEFAULT TRUE;
ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS has_cod BOOLEAN DEFAULT FALSE; -- Certificate of Domicile
ALTER TABLE tax_counterparty ADD COLUMN IF NOT EXISTS vendor_is_property_owner BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tax_counterparty.kbli_code IS 'KBLI code for service classification (PPh 23/4(2))';
COMMENT ON COLUMN tax_counterparty.qualification_grade IS 'SBU qualification for construction (PP 9/2022)';
COMMENT ON COLUMN tax_counterparty.country IS 'Country code for PPh 26 treaty determination';
COMMENT ON COLUMN tax_counterparty.is_resident IS 'Tax resident status — FALSE triggers PPh 26';
COMMENT ON COLUMN tax_counterparty.has_cod IS 'Certificate of Domicile for DTA treaty rate';
COMMENT ON COLUMN tax_counterparty.vendor_is_property_owner IS 'Override rule: building management';
