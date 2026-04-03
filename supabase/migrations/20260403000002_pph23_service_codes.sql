-- PPh 23 Jasa Lain Service Codes (PMK 141/PMK.03/2015)
-- Adds e-Bupot service code mapping to KLU codes table
-- Stores all 62 service types in tax_rate_config for admin visibility

-- Add e-Bupot service code column to klu_codes
ALTER TABLE klu_codes ADD COLUMN IF NOT EXISTS ebupot_service_code VARCHAR(20);

COMMENT ON COLUMN klu_codes.ebupot_service_code IS 'e-Bupot service code per PMK 141/2015 for PPh 23 reporting';

-- Map known KBLI codes to e-Bupot service codes
UPDATE klu_codes SET ebupot_service_code = '24-104-03' WHERE code = '69200'; -- Accounting
UPDATE klu_codes SET ebupot_service_code = '24-104-04' WHERE code = '69100'; -- Legal
UPDATE klu_codes SET ebupot_service_code = '24-104-05' WHERE code = '71101'; -- Architecture
UPDATE klu_codes SET ebupot_service_code = '24-104-06' WHERE code = '71102'; -- City planning
UPDATE klu_codes SET ebupot_service_code = '24-104-07' WHERE code = '74100'; -- Design
UPDATE klu_codes SET ebupot_service_code = '24-104-21' WHERE code IN ('62010', '62020', '62090'); -- Software
UPDATE klu_codes SET ebupot_service_code = '24-104-22' WHERE code = '63110'; -- Website
UPDATE klu_codes SET ebupot_service_code = '24-104-25' WHERE code = '33200'; -- Machine installation
UPDATE klu_codes SET ebupot_service_code = '24-104-26' WHERE code = '33110'; -- Maintenance
UPDATE klu_codes SET ebupot_service_code = '24-104-28' WHERE code = '80100'; -- Security
UPDATE klu_codes SET ebupot_service_code = '24-104-37' WHERE code = '82300'; -- Event organizer
UPDATE klu_codes SET ebupot_service_code = '24-104-39' WHERE code = '81290'; -- Pest control
UPDATE klu_codes SET ebupot_service_code = '24-104-40' WHERE code = '81210'; -- Cleaning
UPDATE klu_codes SET ebupot_service_code = '24-104-44' WHERE code = '56210'; -- Catering
UPDATE klu_codes SET ebupot_service_code = '24-104-49' WHERE code = '82920'; -- Packaging
UPDATE klu_codes SET ebupot_service_code = '24-104-16' WHERE code = '66110'; -- Securities

-- Seed all 62 service types into tax_rate_config for admin reference
INSERT INTO tax_rate_config (category, code, label, rate_value, sort_order, legal_basis, effective_date) VALUES
('PPH23_SERVICE', 'JASA_PENILAI', 'Jasa penilai (appraisal)', 0.02, 1, 'PMK 141/PMK.03/2015 No.1', '2015-08-24'),
('PPH23_SERVICE', 'JASA_AKTUARIS', 'Jasa aktuaris', 0.02, 2, 'PMK 141/PMK.03/2015 No.2', '2015-08-24'),
('PPH23_SERVICE', 'JASA_AKUNTANSI', 'Jasa akuntansi, pembukuan, atestasi', 0.02, 3, 'PMK 141/PMK.03/2015 No.3', '2015-08-24'),
('PPH23_SERVICE', 'JASA_HUKUM', 'Jasa hukum', 0.02, 4, 'PMK 141/PMK.03/2015 No.4', '2015-08-24'),
('PPH23_SERVICE', 'JASA_ARSITEKTUR', 'Jasa arsitektur', 0.02, 5, 'PMK 141/PMK.03/2015 No.5', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERENCANAAN_KOTA', 'Jasa perencanaan kota dan lansekap', 0.02, 6, 'PMK 141/PMK.03/2015 No.6', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERANCANG', 'Jasa perancang (desain)', 0.02, 7, 'PMK 141/PMK.03/2015 No.7', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGEBORAN_MIGAS', 'Jasa pengeboran migas', 0.02, 8, 'PMK 141/PMK.03/2015 No.8', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENUNJANG_MIGAS', 'Jasa penunjang migas', 0.02, 9, 'PMK 141/PMK.03/2015 No.9', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENAMBANGAN', 'Jasa penambangan selain migas', 0.02, 10, 'PMK 141/PMK.03/2015 No.10', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENUNJANG_PENERBANGAN', 'Jasa penunjang penerbangan/bandara', 0.02, 11, 'PMK 141/PMK.03/2015 No.11', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENEBANGAN_HUTAN', 'Jasa penebangan hutan', 0.02, 12, 'PMK 141/PMK.03/2015 No.12', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGOLAHAN_LIMBAH', 'Jasa pengolahan limbah', 0.02, 13, 'PMK 141/PMK.03/2015 No.13', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYEDIA_TENAGA_KERJA', 'Jasa penyedia tenaga kerja (outsourcing)', 0.02, 14, 'PMK 141/PMK.03/2015 No.14', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERANTARA', 'Jasa perantara/keagenan', 0.02, 15, 'PMK 141/PMK.03/2015 No.15', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERDAGANGAN_EFEK', 'Jasa perdagangan surat berharga', 0.02, 16, 'PMK 141/PMK.03/2015 No.16', '2015-08-24'),
('PPH23_SERVICE', 'JASA_KUSTODIAN', 'Jasa kustodian/penyimpanan', 0.02, 17, 'PMK 141/PMK.03/2015 No.17', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGISIAN_SUARA', 'Jasa pengisian suara (dubbing)', 0.02, 18, 'PMK 141/PMK.03/2015 No.18', '2015-08-24'),
('PPH23_SERVICE', 'JASA_MIXING_FILM', 'Jasa mixing film', 0.02, 19, 'PMK 141/PMK.03/2015 No.19', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PEMBUATAN_SARANA_PROMOSI', 'Jasa pembuatan sarana promosi film/iklan', 0.02, 20, 'PMK 141/PMK.03/2015 No.20', '2015-08-24'),
('PPH23_SERVICE', 'JASA_SEHUBUNGAN_SOFTWARE', 'Jasa software/hardware/komputer', 0.02, 21, 'PMK 141/PMK.03/2015 No.21', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PEMBUATAN_WEBSITE', 'Jasa pembuatan/pengelolaan website', 0.02, 22, 'PMK 141/PMK.03/2015 No.22', '2015-08-24'),
('PPH23_SERVICE', 'JASA_INTERNET', 'Jasa internet', 0.02, 23, 'PMK 141/PMK.03/2015 No.23', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYIMPANAN', 'Jasa penyimpanan/pengolahan data', 0.02, 24, 'PMK 141/PMK.03/2015 No.24', '2015-08-24'),
('PPH23_SERVICE', 'JASA_INSTALASI_MESIN', 'Jasa instalasi/pemasangan mesin', 0.02, 25, 'PMK 141/PMK.03/2015 No.25', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERAWATAN', 'Jasa perawatan/perbaikan/pemeliharaan', 0.02, 26, 'PMK 141/PMK.03/2015 No.26', '2015-08-24'),
('PPH23_SERVICE', 'JASA_MAKLON', 'Jasa maklon', 0.02, 27, 'PMK 141/PMK.03/2015 No.27', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYELIDIKAN', 'Jasa penyelidikan/keamanan', 0.02, 28, 'PMK 141/PMK.03/2015 No.28', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENERJEMAHAN', 'Jasa penerjemahan', 0.02, 29, 'PMK 141/PMK.03/2015 No.29', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGANGKUTAN_BARANG', 'Jasa pengangkutan/ekspedisi', 0.02, 30, 'PMK 141/PMK.03/2015 No.30', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PELAYANAN_KEPELABUHANAN', 'Jasa pelayanan kepelabuhanan', 0.02, 31, 'PMK 141/PMK.03/2015 No.31', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGANGKUTAN_JALUR_PIPA', 'Jasa pengangkutan jalur pipa', 0.02, 32, 'PMK 141/PMK.03/2015 No.32', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGELOLAAN_PENITIPAN_ANAK', 'Jasa pengelolaan penitipan anak', 0.02, 33, 'PMK 141/PMK.03/2015 No.33', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PELATIHAN', 'Jasa pelatihan/kursus', 0.02, 34, 'PMK 141/PMK.03/2015 No.34', '2015-08-24'),
('PPH23_SERVICE', 'JASA_TELEKOMUNIKASI', 'Jasa telekomunikasi bukan umum', 0.02, 35, 'PMK 141/PMK.03/2015 No.35', '2015-08-24'),
('PPH23_SERVICE', 'JASA_SEHUBUNGAN_PENGGUNAAN_HARTA', 'Jasa penggunaan harta selain tanah/bangunan', 0.02, 36, 'PMK 141/PMK.03/2015 No.36', '2015-08-24'),
('PPH23_SERVICE', 'JASA_EVENT_ORGANIZER', 'Jasa penyelenggara kegiatan (EO)', 0.02, 37, 'PMK 141/PMK.03/2015 No.37', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYEDIAAN_TEMPAT_WAKTU_MEDIA', 'Jasa penyediaan tempat/waktu media', 0.02, 38, 'PMK 141/PMK.03/2015 No.38', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PEMBASMIAN_HAMA', 'Jasa pembasmian hama', 0.02, 39, 'PMK 141/PMK.03/2015 No.39', '2015-08-24'),
('PPH23_SERVICE', 'JASA_KEBERSIHAN', 'Jasa kebersihan (cleaning service)', 0.02, 40, 'PMK 141/PMK.03/2015 No.40', '2015-08-24'),
('PPH23_SERVICE', 'JASA_SEDOT_SEPTIC_TANK', 'Jasa sedot septic tank/WC', 0.02, 41, 'PMK 141/PMK.03/2015 No.41', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PERMAK', 'Jasa permak/rubah desain/bordir', 0.02, 42, 'PMK 141/PMK.03/2015 No.42', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENATU', 'Jasa penatu (laundry)', 0.02, 43, 'PMK 141/PMK.03/2015 No.43', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PEMBUATAN_KATERING', 'Jasa katering/tata boga', 0.02, 44, 'PMK 141/PMK.03/2015 No.44', '2015-08-24'),
('PPH23_SERVICE', 'JASA_FREIGHT_FORWARDING', 'Jasa freight forwarding', 0.02, 45, 'PMK 141/PMK.03/2015 No.45', '2015-08-24'),
('PPH23_SERVICE', 'JASA_LOGISTIK', 'Jasa logistik', 0.02, 46, 'PMK 141/PMK.03/2015 No.46', '2015-08-24'),
('PPH23_SERVICE', 'JASA_FUMIGASI', 'Jasa fumigasi', 0.02, 47, 'PMK 141/PMK.03/2015 No.47', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGURUSAN_DOKUMEN', 'Jasa pengurusan dokumen', 0.02, 48, 'PMK 141/PMK.03/2015 No.48', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGEPAKAN', 'Jasa pengepakan', 0.02, 49, 'PMK 141/PMK.03/2015 No.49', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYEDIAAN_TENAGA_AHLI', 'Jasa penyediaan tenaga ahli', 0.02, 50, 'PMK 141/PMK.03/2015 No.50', '2015-08-24'),
('PPH23_SERVICE', 'JASA_SURVEY', 'Jasa survei', 0.02, 51, 'PMK 141/PMK.03/2015 No.51', '2015-08-24'),
('PPH23_SERVICE', 'JASA_TESTER', 'Jasa tester', 0.02, 52, 'PMK 141/PMK.03/2015 No.52', '2015-08-24'),
('PPH23_SERVICE', 'JASA_SELAM', 'Jasa selam (diving)', 0.02, 53, 'PMK 141/PMK.03/2015 No.53', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGOLAHAN_HASIL_PERTANIAN', 'Jasa pengolahan hasil pertanian/perikanan', 0.02, 54, 'PMK 141/PMK.03/2015 No.54', '2015-08-24'),
('PPH23_SERVICE', 'JASA_DEKORASI', 'Jasa dekorasi', 0.02, 55, 'PMK 141/PMK.03/2015 No.55', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENCETAKAN', 'Jasa pencetakan/penerbitan', 0.02, 56, 'PMK 141/PMK.03/2015 No.56', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYELAMAN', 'Jasa penyelaman', 0.02, 57, 'PMK 141/PMK.03/2015 No.57', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PEMELIHARAAN_KOLAM', 'Jasa pemeliharaan kolam', 0.02, 58, 'PMK 141/PMK.03/2015 No.58', '2015-08-24'),
('PPH23_SERVICE', 'JASA_KATERING_TRANSPORTASI', 'Jasa katering transportasi', 0.02, 59, 'PMK 141/PMK.03/2015 No.59', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENGOLAHAN_DATA', 'Jasa pengolahan data', 0.02, 60, 'PMK 141/PMK.03/2015 No.60', '2015-08-24'),
('PPH23_SERVICE', 'JASA_PENYEDIAAN_SDM', 'Jasa penyediaan sumber daya manusia', 0.02, 61, 'PMK 141/PMK.03/2015 No.61', '2015-08-24'),
('PPH23_SERVICE', 'JASA_LAINNYA', 'Jasa lainnya (dipotong PPh 21)', 0.02, 62, 'PMK 141/PMK.03/2015 No.62', '2015-08-24');
