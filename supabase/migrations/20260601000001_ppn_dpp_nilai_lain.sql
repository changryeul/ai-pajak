-- PPN Phase 3.1 — DPP Nilai Lain 자동 보존 (PMK 131/2024)
--
-- Adds two metadata columns to ppn_faktur_monthly so the importer can persist
-- the adjusted DPP (essential goods 2025+ = dpp × 11/12) and the luxury flag
-- coming from the source VAT file's OTHER TAX BASE column.
--
-- Both columns are NULL-able — legacy rows keep NULL (meaningful: "pre-PMK
-- or not yet computed"). UI renders NULL as dash. Calculator fallback runs in
-- the API layer when the importer leaves the column empty.

alter table ppn_faktur_monthly
  add column dpp_nilai_lain numeric null,
  add column is_luxury boolean null;

comment on column ppn_faktur_monthly.dpp_nilai_lain is
  'DPP Nilai Lain (adjusted DPP per PMK 131/2024). Essential goods 2025+ = dpp × 11/12. NULL = pre-PMK or not yet computed.';
comment on column ppn_faktur_monthly.is_luxury is
  'Luxury item flag per PMK 131/2024 Pasal 2. TRUE = full 12%. FALSE/NULL = essential (effective 11%).';
