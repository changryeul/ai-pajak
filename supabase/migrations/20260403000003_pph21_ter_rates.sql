-- PPh 21 TER (Tarif Efektif Rata-rata) Monthly Effective Rates
-- Based on PP 58/2023 and PMK 168/2023, effective January 1, 2024
-- Three categories: A (44 brackets), B (40 brackets), C (41 brackets)

-- Category A: PTKP TK/0, TK/1, K/0
INSERT INTO tax_rate_config (category, code, label, rate_value, threshold_min, threshold_max, sort_order, legal_basis, effective_date) VALUES
('PPH21_TER_A', 'TER_A_01', '0% (0 - 5.4 juta)', 0, 0, 5400000, 1, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_02', '0.25% (5.4 - 5.65 juta)', 0.0025, 5400000, 5650000, 2, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_03', '0.5% (5.65 - 5.95 juta)', 0.005, 5650000, 5950000, 3, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_04', '0.75% (5.95 - 6.3 juta)', 0.0075, 5950000, 6300000, 4, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_05', '1% (6.3 - 6.75 juta)', 0.01, 6300000, 6750000, 5, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_06', '1.25% (6.75 - 7.5 juta)', 0.0125, 6750000, 7500000, 6, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_07', '1.5% (7.5 - 8.55 juta)', 0.015, 7500000, 8550000, 7, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_08', '1.75% (8.55 - 9.65 juta)', 0.0175, 8550000, 9650000, 8, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_09', '2% (9.65 - 10.05 juta)', 0.02, 9650000, 10050000, 9, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_A', 'TER_A_10', '2.25% (10.05 - 10.35 juta)', 0.0225, 10050000, 10350000, 10, 'PP 58/2023, PMK 168/2023', '2024-01-01');

-- Category B: PTKP TK/2, TK/3, K/1, K/2 (representative brackets)
INSERT INTO tax_rate_config (category, code, label, rate_value, threshold_min, threshold_max, sort_order, legal_basis, effective_date) VALUES
('PPH21_TER_B', 'TER_B_01', '0% (0 - 6.2 juta)', 0, 0, 6200000, 1, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_B', 'TER_B_02', '0.25% (6.2 - 6.5 juta)', 0.0025, 6200000, 6500000, 2, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_B', 'TER_B_03', '0.5% (6.5 - 6.85 juta)', 0.005, 6500000, 6850000, 3, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_B', 'TER_B_04', '0.75% (6.85 - 7.3 juta)', 0.0075, 6850000, 7300000, 4, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_B', 'TER_B_05', '1% (7.3 - 9.2 juta)', 0.01, 7300000, 9200000, 5, 'PP 58/2023, PMK 168/2023', '2024-01-01');

-- Category C: PTKP K/3 (representative brackets)
INSERT INTO tax_rate_config (category, code, label, rate_value, threshold_min, threshold_max, sort_order, legal_basis, effective_date) VALUES
('PPH21_TER_C', 'TER_C_01', '0% (0 - 6.6 juta)', 0, 0, 6600000, 1, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_C', 'TER_C_02', '0.25% (6.6 - 6.95 juta)', 0.0025, 6600000, 6950000, 2, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_C', 'TER_C_03', '0.5% (6.95 - 7.35 juta)', 0.005, 6950000, 7350000, 3, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_C', 'TER_C_04', '0.75% (7.35 - 7.8 juta)', 0.0075, 7350000, 7800000, 4, 'PP 58/2023, PMK 168/2023', '2024-01-01'),
('PPH21_TER_C', 'TER_C_05', '1% (7.8 - 8.85 juta)', 0.01, 7800000, 8850000, 5, 'PP 58/2023, PMK 168/2023', '2024-01-01');

-- Note: Full bracket data (125 rows total) is implemented in src/config/pph21-ter-rates.ts
-- This migration stores representative rows for admin visibility and future DB-driven rate management
-- Complete data can be seeded via admin API or extended migration when ready

COMMENT ON TABLE tax_rate_config IS 'Configurable tax rates including PPh 21 TER (PP 58/2023), managed by platform admin';
