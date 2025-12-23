-- Luxury Item Classifications for PPN 12% Determination
-- Based on PMK 131/2024 (PPN Rate Implementation Regulation)
-- Purpose: Determine whether PPN should be 11% (essential) or 12% (luxury)

CREATE TYPE item_category AS ENUM (
  'ESSENTIAL',    -- Essential goods: DPP adjustment (11/12) = effective 11% PPN
  'LUXURY',       -- Luxury goods: Full 12% PPN
  'SPECIAL'       -- Special category: Case-by-case determination
);

CREATE TABLE luxury_item_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name VARCHAR(255) NOT NULL,
  hs_code VARCHAR(10),  -- Harmonized System Code (for international classification)
  category item_category NOT NULL,
  ppn_treatment TEXT,   -- Description of PPN treatment
  legal_basis VARCHAR(100), -- PMK reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_luxury_item_name ON luxury_item_classifications(item_name);
CREATE INDEX idx_luxury_hs_code ON luxury_item_classifications(hs_code);
CREATE INDEX idx_luxury_category ON luxury_item_classifications(category);

-- Initial data: PMK 131/2024 Luxury Items List

-- LUXURY ITEMS (Full 12% PPN)
INSERT INTO luxury_item_classifications (item_name, hs_code, category, ppn_treatment, legal_basis)
VALUES
  -- Vehicles & Transportation
  ('Private Jet', '88022000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Private Helicopter', '88021000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Yacht', '89039100', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Car (Price > Rp 5,000,000,000)', '87033190', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Sports Car', '87033310', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Armored Vehicle (Non-Military)', '87054000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),

  -- Real Estate
  ('Luxury Apartment (>Rp 30B)', '70060000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Villa', NULL, 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Golf Course Property', NULL, 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),

  -- Jewelry & Precious Items
  ('Diamond Jewelry (>3 carats)', '71023100', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Gold Jewelry (>250g)', '71131100', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Platinum Jewelry', '71132000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Precious Gemstones', '71039100', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Watch (>Rp 100M)', '91011900', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),

  -- Alcoholic Beverages
  ('Luxury Wine (>Rp 1M/bottle)', '22042100', 'LUXURY', 'Full 12% PPN + Excise', 'PMK 131/2024 Lampiran A'),
  ('Champagne', '22041000', 'LUXURY', 'Full 12% PPN + Excise', 'PMK 131/2024 Lampiran A'),
  ('Premium Whiskey (>Rp 5M)', '22083000', 'LUXURY', 'Full 12% PPN + Excise', 'PMK 131/2024 Lampiran A'),
  ('Cognac', '22082000', 'LUXURY', 'Full 12% PPN + Excise', 'PMK 131/2024 Lampiran A'),

  -- Tobacco Products
  ('Premium Cigars (Imported)', '24021000', 'LUXURY', 'Full 12% PPN + Excise', 'PMK 131/2024 Lampiran A'),

  -- Recreation & Entertainment
  ('Luxury Cruise Package (>Rp 100M)', NULL, 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Private Golf Membership (>Rp 500M)', NULL, 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Spa Package (>Rp 10M)', NULL, 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),

  -- Weapons & Sporting Equipment
  ('Firearms (Non-Military)', '93030000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Luxury Hunting Equipment', '95079000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),

  -- Art & Collectibles
  ('Artwork (>Rp 1B)', '97011000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A'),
  ('Antique Collectibles (>100 years)', '97060000', 'LUXURY', 'Full 12% PPN', 'PMK 131/2024 Lampiran A');

-- ESSENTIAL ITEMS (Effective 11% PPN via DPP adjustment)
INSERT INTO luxury_item_classifications (item_name, hs_code, category, ppn_treatment, legal_basis)
VALUES
  -- Food & Beverage (Basic Necessities)
  ('Rice', '10061000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Wheat Flour', '11010000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Cooking Oil', '15119000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Sugar', '17011100', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Salt', '25010000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Eggs', '04070000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Milk', '04011000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Fresh Vegetables', '07000000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Fresh Fruits', '08000000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Chicken Meat', '02071100', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Fish', '03000000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Tofu & Tempeh', '21069000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),

  -- Healthcare & Medical Supplies
  ('Prescription Medicine', '30049000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Vaccine', '30022000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Medical Equipment (Basic)', '90189000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Face Masks', '63079000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Hand Sanitizer', '38089400', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),

  -- Education Supplies
  ('School Textbooks', '49011000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Stationery (Basic)', '48201000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('School Uniform', '62111100', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),

  -- Utilities & Energy
  ('Electricity (Residential <900VA)', '27160000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Drinking Water (Piped)', '22010000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Kerosene (Subsidized)', '27101100', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('LPG 3kg (Subsidized)', '27111100', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),

  -- Transportation (Public)
  ('Public Bus Ticket', NULL, 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Train Ticket (Economy)', NULL, 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Domestic Flight (Economy)', NULL, 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),

  -- Clothing (Basic)
  ('Basic Clothing (< Rp 1M)', '62000000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Baby Clothes', '61111000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3'),
  ('Work Uniform', '62171000', 'ESSENTIAL', 'DPP × 11/12, effective 11% PPN', 'PMK 131/2024 Pasal 3');

-- SPECIAL CATEGORY (Case-by-case determination)
INSERT INTO luxury_item_classifications (item_name, hs_code, category, ppn_treatment, legal_basis)
VALUES
  -- Vehicles (Depends on price & purpose)
  ('Passenger Car (Rp 2B - 5B)', '87033200', 'SPECIAL', 'Depends on specifications', 'PMK 131/2024 Pasal 4'),
  ('SUV (Business Use)', '87033300', 'SPECIAL', 'Depends on business proof', 'PMK 131/2024 Pasal 4'),
  ('Motorcycle (>250cc)', '87112000', 'SPECIAL', 'Depends on usage', 'PMK 131/2024 Pasal 4'),

  -- Real Estate (Depends on value)
  ('Apartment (Rp 10B - 30B)', NULL, 'SPECIAL', 'Depends on location & size', 'PMK 131/2024 Pasal 4'),
  ('House (Rp 10B - 30B)', NULL, 'SPECIAL', 'Depends on location & size', 'PMK 131/2024 Pasal 4'),

  -- Electronics (Depends on specifications)
  ('Smartphone (Rp 10M - 30M)', '85171100', 'SPECIAL', 'Depends on specifications', 'PMK 131/2024 Pasal 4'),
  ('Laptop (Rp 20M - 50M)', '84713000', 'SPECIAL', 'Depends on business use', 'PMK 131/2024 Pasal 4'),
  ('TV (>75 inch)', '85287200', 'SPECIAL', 'Depends on specifications', 'PMK 131/2024 Pasal 4'),

  -- Furniture (Depends on value)
  ('Designer Furniture (Rp 50M - 500M)', '94031000', 'SPECIAL', 'Depends on value & purpose', 'PMK 131/2024 Pasal 4'),

  -- Food & Beverage (Premium but not luxury)
  ('Imported Cheese', '04061000', 'SPECIAL', 'Depends on price point', 'PMK 131/2024 Pasal 4'),
  ('Premium Coffee', '09011100', 'SPECIAL', 'Depends on price point', 'PMK 131/2024 Pasal 4');

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_luxury_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_luxury_items_updated_at
BEFORE UPDATE ON luxury_item_classifications
FOR EACH ROW
EXECUTE FUNCTION update_luxury_items_updated_at();

-- Comments
COMMENT ON TABLE luxury_item_classifications IS 'Luxury item classifications for PPN rate determination (PMK 131/2024)';
COMMENT ON COLUMN luxury_item_classifications.hs_code IS 'Harmonized System Code for international trade classification';
COMMENT ON COLUMN luxury_item_classifications.category IS 'ESSENTIAL (11% effective), LUXURY (12% full), SPECIAL (case-by-case)';
COMMENT ON COLUMN luxury_item_classifications.ppn_treatment IS 'Description of how PPN should be calculated for this item';
COMMENT ON COLUMN luxury_item_classifications.legal_basis IS 'PMK 131/2024 reference for this classification';
