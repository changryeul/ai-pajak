-- KLU (Klasifikasi Lapangan Usaha) Codes Table
-- Based on KBLI 2020 (Klasifikasi Baku Lapangan Usaha Indonesia)
-- Purpose: PPh23 rate determination, PPh Final exemption classification

CREATE TABLE klu_codes (
  code VARCHAR(5) PRIMARY KEY,
  description TEXT NOT NULL,
  category VARCHAR(100),
  pph23_rate DECIMAL(5,4),
  pph_final_exempt BOOLEAN DEFAULT FALSE,
  is_luxury_item BOOLEAN DEFAULT FALSE, -- For PPN 12% determination (PMK 131/2024)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_klu_category ON klu_codes(category);
CREATE INDEX idx_klu_pph_final_exempt ON klu_codes(pph_final_exempt);
CREATE INDEX idx_klu_luxury ON klu_codes(is_luxury_item);

-- Initial data: Major KLU codes for Indonesian tax calculation
-- Category: IT & Software
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('62010', 'Computer Programming', 'IT', 0.02, TRUE, FALSE),
  ('62020', 'IT Consulting', 'IT', 0.02, TRUE, FALSE),
  ('62090', 'Other IT Services', 'IT', 0.02, TRUE, FALSE),
  ('63110', 'Data Processing & Web Hosting', 'IT', 0.02, TRUE, FALSE);

-- Category: Professional Services (Exempted from PPh Final PP 23/2018)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('69100', 'Legal Services', 'Professional', 0.02, TRUE, FALSE),
  ('69200', 'Accounting, Auditing & Tax Consulting', 'Professional', 0.02, TRUE, FALSE),
  ('70200', 'Management Consulting', 'Professional', 0.02, TRUE, FALSE),
  ('71101', 'Architectural Services', 'Professional', 0.02, TRUE, FALSE),
  ('71102', 'Engineering Services', 'Professional', 0.02, TRUE, FALSE),
  ('71200', 'Technical Testing & Analysis', 'Professional', 0.02, TRUE, FALSE),
  ('72100', 'Scientific R&D - Natural Sciences', 'Professional', 0.02, TRUE, FALSE),
  ('72200', 'Scientific R&D - Social Sciences', 'Professional', 0.02, TRUE, FALSE),
  ('73100', 'Advertising', 'Professional', 0.02, TRUE, FALSE),
  ('73200', 'Market Research', 'Professional', 0.02, TRUE, FALSE),
  ('74100', 'Specialized Design', 'Professional', 0.02, TRUE, FALSE),
  ('74200', 'Photography', 'Professional', 0.02, TRUE, FALSE),
  ('74900', 'Other Professional Services', 'Professional', 0.02, TRUE, FALSE);

-- Category: Healthcare (Exempted from PPh Final)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('86101', 'Hospital Services', 'Healthcare', 0.02, TRUE, FALSE),
  ('86102', 'Clinic Services', 'Healthcare', 0.02, TRUE, FALSE),
  ('86201', 'Medical Practice', 'Healthcare', 0.02, TRUE, FALSE),
  ('86202', 'Dental Practice', 'Healthcare', 0.02, TRUE, FALSE),
  ('86901', 'Medical Laboratory', 'Healthcare', 0.02, TRUE, FALSE);

-- Category: Education (Exempted from PPh Final)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('85101', 'Pre-Primary Education', 'Education', 0.02, TRUE, FALSE),
  ('85201', 'Primary Education', 'Education', 0.02, TRUE, FALSE),
  ('85301', 'Secondary Education', 'Education', 0.02, TRUE, FALSE),
  ('85401', 'Higher Education', 'Education', 0.02, TRUE, FALSE),
  ('85501', 'Sports & Recreation Education', 'Education', 0.02, TRUE, FALSE),
  ('85509', 'Other Education', 'Education', 0.02, TRUE, FALSE);

-- Category: Arts & Entertainment (Exempted from PPh Final)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('90001', 'Creative Arts', 'Arts', 0.02, TRUE, FALSE),
  ('90002', 'Performing Arts', 'Arts', 0.02, TRUE, FALSE),
  ('93110', 'Sports Facilities', 'Sports', 0.02, TRUE, FALSE),
  ('93191', 'Professional Sports', 'Sports', 0.02, TRUE, FALSE);

-- Category: Food Service (NOT exempted, PPh23 15%)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('56101', 'Restaurant', 'Food Service', 0.15, FALSE, FALSE),
  ('56102', 'Fast Food', 'Food Service', 0.15, FALSE, FALSE),
  ('56210', 'Catering', 'Food Service', 0.15, FALSE, FALSE),
  ('56301', 'Beverage Service', 'Food Service', 0.15, FALSE, FALSE);

-- Category: Retail (NOT exempted)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('47111', 'Supermarket', 'Retail', 0.02, FALSE, FALSE),
  ('47112', 'Minimarket', 'Retail', 0.02, FALSE, FALSE),
  ('47191', 'Department Store', 'Retail', 0.02, FALSE, FALSE),
  ('47721', 'Pharmacy', 'Retail', 0.02, FALSE, FALSE);

-- Category: Automotive (Luxury items for PPN 12%)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('45100', 'Motor Vehicle Sales', 'Automotive', 0.02, FALSE, FALSE),
  ('45101', 'Luxury Car Sales (>Rp 5B)', 'Automotive', 0.02, FALSE, TRUE), -- Luxury item
  ('45200', 'Motor Vehicle Repair', 'Automotive', 0.02, FALSE, FALSE),
  ('45300', 'Motor Vehicle Parts Sales', 'Automotive', 0.02, FALSE, FALSE);

-- Category: Construction
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('41001', 'Building Construction', 'Construction', 0.02, FALSE, FALSE),
  ('42101', 'Road Construction', 'Construction', 0.02, FALSE, FALSE),
  ('42201', 'Utility Construction', 'Construction', 0.02, FALSE, FALSE),
  ('43110', 'Demolition', 'Construction', 0.02, FALSE, FALSE),
  ('43210', 'Electrical Installation', 'Construction', 0.02, FALSE, FALSE);

-- Category: Real Estate
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('68100', 'Real Estate Sales', 'Real Estate', 0.02, FALSE, FALSE),
  ('68201', 'Residential Rental', 'Real Estate', 0.02, FALSE, FALSE),
  ('68202', 'Commercial Rental', 'Real Estate', 0.02, FALSE, FALSE);

-- Category: Transportation
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('49110', 'Railway Passenger Transport', 'Transportation', 0.02, FALSE, FALSE),
  ('49310', 'Land Passenger Transport', 'Transportation', 0.02, FALSE, FALSE),
  ('49410', 'Freight Transport', 'Transportation', 0.02, FALSE, FALSE),
  ('50110', 'Sea Passenger Transport', 'Transportation', 0.02, FALSE, FALSE),
  ('50200', 'Sea Freight Transport', 'Transportation', 0.02, FALSE, FALSE),
  ('51101', 'Scheduled Air Passenger Transport', 'Transportation', 0.02, FALSE, TRUE), -- Can be luxury
  ('51102', 'Charter Air Transport', 'Transportation', 0.02, FALSE, TRUE); -- Luxury item

-- Category: Accommodation
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('55101', 'Hotel', 'Accommodation', 0.02, FALSE, FALSE),
  ('55102', 'Resort', 'Accommodation', 0.02, FALSE, TRUE), -- Can be luxury
  ('55201', 'Guest House', 'Accommodation', 0.02, FALSE, FALSE);

-- Category: Information & Communication
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('58110', 'Book Publishing', 'Publishing', 0.02, FALSE, FALSE),
  ('58120', 'Software Publishing', 'Publishing', 0.02, TRUE, FALSE),
  ('58130', 'Newspaper Publishing', 'Publishing', 0.02, FALSE, FALSE),
  ('59110', 'Motion Picture Production', 'Media', 0.02, TRUE, FALSE),
  ('60100', 'Radio Broadcasting', 'Media', 0.02, FALSE, FALSE),
  ('60200', 'Television Broadcasting', 'Media', 0.02, FALSE, FALSE),
  ('61100', 'Wired Telecommunications', 'Telecommunications', 0.02, FALSE, FALSE),
  ('61200', 'Wireless Telecommunications', 'Telecommunications', 0.02, FALSE, FALSE);

-- Category: Financial Services
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('64110', 'Central Banking', 'Finance', 0.15, FALSE, FALSE),
  ('64191', 'Commercial Banking', 'Finance', 0.15, FALSE, FALSE),
  ('64201', 'Leasing', 'Finance', 0.15, FALSE, FALSE),
  ('64301', 'Venture Capital', 'Finance', 0.15, FALSE, FALSE),
  ('65110', 'Life Insurance', 'Insurance', 0.15, FALSE, FALSE),
  ('65120', 'Non-Life Insurance', 'Insurance', 0.15, FALSE, FALSE),
  ('66110', 'Securities Trading', 'Securities', 0.15, FALSE, FALSE),
  ('66120', 'Asset Management', 'Securities', 0.15, FALSE, FALSE);

-- Category: Cleaning & Maintenance
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('81210', 'Building Cleaning', 'Cleaning', 0.15, FALSE, FALSE),
  ('81290', 'Other Cleaning Services', 'Cleaning', 0.15, FALSE, FALSE),
  ('81300', 'Landscaping', 'Cleaning', 0.15, FALSE, FALSE);

-- Category: Manufacturing (General)
INSERT INTO klu_codes (code, description, category, pph23_rate, pph_final_exempt, is_luxury_item)
VALUES
  ('10110', 'Meat Processing', 'Manufacturing', 0.02, FALSE, FALSE),
  ('10310', 'Fruit & Vegetable Processing', 'Manufacturing', 0.02, FALSE, FALSE),
  ('10710', 'Bakery Products', 'Manufacturing', 0.02, FALSE, FALSE),
  ('11010', 'Beverage Manufacturing', 'Manufacturing', 0.02, FALSE, FALSE),
  ('13111', 'Cotton Textile', 'Manufacturing', 0.02, FALSE, FALSE),
  ('14111', 'Clothing', 'Manufacturing', 0.02, FALSE, FALSE),
  ('20111', 'Basic Chemicals', 'Manufacturing', 0.02, FALSE, FALSE),
  ('21011', 'Pharmaceuticals', 'Manufacturing', 0.02, FALSE, FALSE),
  ('26110', 'Electronic Components', 'Manufacturing', 0.02, FALSE, FALSE),
  ('27110', 'Electric Motors', 'Manufacturing', 0.02, FALSE, FALSE),
  ('28110', 'Engines', 'Manufacturing', 0.02, FALSE, FALSE),
  ('29101', 'Motor Vehicle Manufacturing', 'Manufacturing', 0.02, FALSE, FALSE);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_klu_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_klu_codes_updated_at
BEFORE UPDATE ON klu_codes
FOR EACH ROW
EXECUTE FUNCTION update_klu_codes_updated_at();

-- Comments
COMMENT ON TABLE klu_codes IS 'KLU (Klasifikasi Lapangan Usaha) codes based on KBLI 2020 for tax rate determination';
COMMENT ON COLUMN klu_codes.code IS 'KBLI 2020 5-digit code';
COMMENT ON COLUMN klu_codes.pph23_rate IS 'PPh 23 withholding tax rate (0.02 for listed services, 0.15 for others)';
COMMENT ON COLUMN klu_codes.pph_final_exempt IS 'TRUE if exempted from PPh Final PP 23/2018 (professional services)';
COMMENT ON COLUMN klu_codes.is_luxury_item IS 'TRUE if classified as luxury item for PPN 12% full rate (PMK 131/2024)';
