-- PPh 4(2) Construction Service Rates by SBU Grade (PP 9/2022)
-- Effective: 2022-02-21
-- Replaces flat 4% rate with SBU-differentiated rates

INSERT INTO tax_rate_config (category, code, label, rate_value, sort_order, legal_basis, effective_date) VALUES
('PPH42_CONSTRUCTION', 'WORK_SMALL', 'Jasa Pelaksana Konstruksi - SBU Kecil (Grade 1-4)', 0.0175, 1, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'WORK_MEDIUM_LARGE', 'Jasa Pelaksana Konstruksi - SBU Menengah/Besar', 0.0265, 2, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'WORK_NONE', 'Jasa Pelaksana Konstruksi - Tanpa SBU/SKK', 0.04, 3, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'CONSULT_SBU', 'Jasa Konsultansi Konstruksi - Dengan SBU/SKK', 0.035, 4, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'CONSULT_NONE', 'Jasa Konsultansi Konstruksi - Tanpa SBU/SKK', 0.06, 5, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'INTEGRATED_SBU', 'Pekerjaan Konstruksi Terintegrasi - Dengan SBU', 0.0265, 6, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21'),
('PPH42_CONSTRUCTION', 'INTEGRATED_NONE', 'Pekerjaan Konstruksi Terintegrasi - Tanpa SBU', 0.04, 7, 'PP 9/2022 Pasal 3 ayat (1)', '2022-02-21');
