-- Tax Rate Configuration (세율 관리)
-- Admin can update tax rates when regulations change

CREATE TABLE tax_rate_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,      -- PPH21, PPH23, PPH22, PPN, PPH_FINAL, CORPORATE, PTKP, LIMITS
    code VARCHAR(50) NOT NULL,          -- Rate identifier
    label VARCHAR(255) NOT NULL,        -- Display name
    description TEXT,
    rate_value NUMERIC(10,6),           -- Rate as decimal (e.g., 0.05 = 5%)
    amount_value NUMERIC(15,2),         -- Fixed amount (e.g., PTKP Rp 54,000,000)
    threshold_min NUMERIC(15,2),        -- Min threshold for bracket
    threshold_max NUMERIC(15,2),        -- Max threshold for bracket
    sort_order INTEGER DEFAULT 0,
    legal_basis VARCHAR(255),           -- Legal reference (e.g., "Pasal 17 UU PPh")
    effective_date DATE NOT NULL,       -- When this rate takes effect
    expiry_date DATE,                   -- When this rate expires (NULL = current)
    is_active BOOLEAN DEFAULT TRUE,
    updated_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rate_config_category ON tax_rate_config(category);
CREATE INDEX idx_rate_config_active ON tax_rate_config(is_active);
CREATE UNIQUE INDEX idx_rate_config_unique ON tax_rate_config(category, code, effective_date);

-- Seed current Indonesian tax rates (2024/2025)

-- PPh 21 Progressive Brackets
INSERT INTO tax_rate_config (category, code, label, rate_value, threshold_min, threshold_max, sort_order, legal_basis, effective_date) VALUES
('PPH21_BRACKET', 'BRACKET_1', '5% (0 - Rp 60 juta)', 0.05, 0, 60000000, 1, 'Pasal 17 UU PPh, UU HPP 2021', '2022-01-01'),
('PPH21_BRACKET', 'BRACKET_2', '15% (Rp 60 juta - Rp 250 juta)', 0.15, 60000000, 250000000, 2, 'Pasal 17 UU PPh, UU HPP 2021', '2022-01-01'),
('PPH21_BRACKET', 'BRACKET_3', '25% (Rp 250 juta - Rp 500 juta)', 0.25, 250000000, 500000000, 3, 'Pasal 17 UU PPh, UU HPP 2021', '2022-01-01'),
('PPH21_BRACKET', 'BRACKET_4', '30% (Rp 500 juta - Rp 5 miliar)', 0.30, 500000000, 5000000000, 4, 'Pasal 17 UU PPh, UU HPP 2021', '2022-01-01'),
('PPH21_BRACKET', 'BRACKET_5', '35% (di atas Rp 5 miliar)', 0.35, 5000000000, NULL, 5, 'Pasal 17 UU PPh, UU HPP 2021', '2022-01-01');

-- PPh 23 Rates
INSERT INTO tax_rate_config (category, code, label, rate_value, sort_order, legal_basis, effective_date) VALUES
('PPH23', 'JASA_TEKNIK', 'Jasa Teknik', 0.02, 1, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'JASA_MANAJEMEN', 'Jasa Manajemen', 0.02, 2, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'JASA_KONSULTAN', 'Jasa Konsultan', 0.02, 3, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'SEWA', 'Sewa (selain tanah/bangunan)', 0.02, 4, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'DIVIDEN', 'Dividen', 0.15, 5, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'BUNGA', 'Bunga', 0.15, 6, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'ROYALTI', 'Royalti', 0.15, 7, 'Pasal 23 UU PPh', '2009-01-01'),
('PPH23', 'HADIAH', 'Hadiah/Penghargaan', 0.15, 8, 'Pasal 23 UU PPh', '2009-01-01');

-- PTKP (Non-Taxable Income)
INSERT INTO tax_rate_config (category, code, label, amount_value, sort_order, legal_basis, effective_date) VALUES
('PTKP', 'TK0', 'Tidak Kawin / 0 Tanggungan', 54000000, 1, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'TK1', 'Tidak Kawin / 1 Tanggungan', 58500000, 2, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'TK2', 'Tidak Kawin / 2 Tanggungan', 63000000, 3, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'TK3', 'Tidak Kawin / 3 Tanggungan', 67500000, 4, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'K0', 'Kawin / 0 Tanggungan', 58500000, 5, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'K1', 'Kawin / 1 Tanggungan', 63000000, 6, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'K2', 'Kawin / 2 Tanggungan', 67500000, 7, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'K3', 'Kawin / 3 Tanggungan', 72000000, 8, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'KI0', 'Kawin+Istri Gabung / 0', 112500000, 9, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'KI1', 'Kawin+Istri Gabung / 1', 117000000, 10, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'KI2', 'Kawin+Istri Gabung / 2', 121500000, 11, 'PMK 101/PMK.010/2016', '2016-01-01'),
('PTKP', 'KI3', 'Kawin+Istri Gabung / 3', 126000000, 12, 'PMK 101/PMK.010/2016', '2016-01-01');

-- Other Rates
INSERT INTO tax_rate_config (category, code, label, rate_value, sort_order, legal_basis, effective_date) VALUES
('PPN', 'STANDARD', 'PPN Standar', 0.11, 1, 'UU HPP 2021', '2022-04-01'),
('PPH_FINAL', 'UMKM', 'PPh Final UMKM (PP 55/2022)', 0.005, 1, 'PP 55 Tahun 2022', '2022-07-01'),
('CORPORATE', 'STANDARD', 'Tarif PPh Badan', 0.22, 1, 'Pasal 17 UU PPh', '2022-01-01'),
('CORPORATE', 'SME', 'Tarif UMKM Badan (omzet < 50M)', 0.11, 2, 'Pasal 31E UU PPh', '2022-01-01'),
('PPH22', 'IMPORT_NPWP', 'PPh 22 Impor (dengan NPWP)', 0.025, 1, 'PMK 34/PMK.010/2017', '2017-03-01'),
('PPH22', 'IMPORT_NO_NPWP', 'PPh 22 Impor (tanpa NPWP)', 0.075, 2, 'PMK 34/PMK.010/2017', '2017-03-01'),
('NPWP_SURCHARGE', 'NO_NPWP', 'Kenaikan tarif tanpa NPWP', 2.0, 1, 'Pasal 21 ayat 5a UU PPh', '2009-01-01');

-- Limits
INSERT INTO tax_rate_config (category, code, label, amount_value, rate_value, sort_order, legal_basis, effective_date) VALUES
('LIMITS', 'BIAYA_JABATAN_PCT', 'Biaya Jabatan (%)', NULL, 0.05, 1, 'PMK 250/2008', '2009-01-01'),
('LIMITS', 'BIAYA_JABATAN_MAX', 'Biaya Jabatan Maks/Tahun', 6000000, NULL, 2, 'PMK 250/2008', '2009-01-01'),
('LIMITS', 'IURAN_PENSIUN_MAX', 'Iuran Pensiun Maks/Tahun', 2400000, NULL, 3, 'PMK 250/2008', '2009-01-01'),
('LIMITS', 'UMKM_THRESHOLD', 'Batas Omzet UMKM', 4800000000, NULL, 4, 'PP 55/2022', '2022-07-01'),
('LIMITS', 'UMKM_EXEMPTION', 'Pembebasan UMKM', 500000000, NULL, 5, 'PP 55/2022', '2022-07-01');

-- Only PLATFORM_ADMIN can modify
ALTER TABLE tax_rate_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read" ON tax_rate_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can modify" ON tax_rate_config FOR ALL TO authenticated
USING (is_platform_admin()) WITH CHECK (is_platform_admin());

COMMENT ON TABLE tax_rate_config IS 'Configurable tax rates managed by platform admin';
