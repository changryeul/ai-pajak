/**
 * 수동 테스트용 양식 3종 — 실제 데이터로 채워진 xlsx 파일 생성.
 *
 *  - public/test-data/pph21-filled.xlsx  (PPh21 직원 등록 — 5 명)
 *  - public/test-data/wht-onesheet-filled.xlsx (PPh23/PPh4(2)/PPh26/PPN MASUKAN 8 행)
 *  - public/test-data/ppn-filled.xlsx    (VAT OUT 3 + VAT IN 3)
 *
 * 시나리오: docs/guides/TEST_SCENARIO.md 의 "다운로드 → 업로드" 흐름에서
 * 이 파일들을 그대로 업로드해서 검증.
 *
 *   npx tsx scripts/build-test-fixtures.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import XLSX from 'xlsx';

const ROOT = join(__dirname, '..', 'public', 'test-data');
mkdirSync(ROOT, { recursive: true });

/* ─────────────────────────────────────────────────────────────────────── */
/* PPh21 직원 등록 (34-col strict template + 5 employees)                */
/* ─────────────────────────────────────────────────────────────────────── */
function buildPph21(): void {
  const headers = [
    'employee_name','employee_npwp','employee_nik','ptkp_category','gross_salary',
    'position_allowance','overtime_pay','meal_allowance','transport_allowance','other_allowances',
    'bonus','thr','jht_employee','jp_employee','bpjs_kesehatan','other_deductions','worker_type',
    'employee_number','position','department','hire_date','resign_date','birth_date','gender',
    'marital_status','email','phone','address','bank_name','bank_account_no','bank_account_name',
    'emergency_contact_name','emergency_contact_phone','notes',
  ];
  const samples: (string | number)[][] = [
    ['Andi Wijaya',          '01.234.567.8-001.000', '3201111111110001', 'K/2', 15000000,
     2500000, 0, 300000, 200000, 0, 0, 0, 300000, 150000, 150000, 0, 'REGULAR',
     'EMP-001', 'Senior Engineer', 'IT', '2022-03-01', '', '1989-04-12', 'M',
     'MARRIED', 'andi@example.com', '+62 811 1111 1111', 'Jl. Sudirman 10',
     'BCA', '1111111111', 'Andi Wijaya', 'Wati', '+62 811 1111 1112', ''],
    ['Sari Lestari',         '', '3202222222220002', 'TK/0', 8000000,
     500000, 0, 300000, 200000, 0, 0, 0, 160000, 80000, 80000, 0, 'REGULAR',
     'EMP-002', 'Analyst', 'HR', '2024-08-15', '', '1996-09-25', 'F',
     'SINGLE', 'sari@example.com', '+62 812 2222 2222', 'Jl. Thamrin 5',
     'BCA', '2222222222', 'Sari Lestari', 'Rini', '+62 812 2222 2223', ''],
    ['Budi Hartono',         '02.345.678.9-002.000', '3203333333330003', 'K/1', 25000000,
     4000000, 0, 300000, 200000, 0, 0, 2083333, 500000, 250000, 250000, 0, 'REGULAR',
     'EMP-003', 'Director', 'Operations', '2020-01-15', '', '1982-11-08', 'M',
     'MARRIED', 'budi@example.com', '+62 813 3333 3333', 'Jl. Gatot 88',
     'Mandiri', '3333333333', 'Budi Hartono', 'Sri', '+62 813 3333 3334', ''],
    ['Citra Wulandari',      '03.456.789.0-003.000', '3204444444440004', 'TK/1', 12000000,
     1500000, 0, 300000, 200000, 0, 0, 0, 240000, 120000, 120000, 0, 'REGULAR',
     'EMP-004', 'Marketing Manager', 'Marketing', '2023-05-20', '', '1992-06-30', 'F',
     'SINGLE', 'citra@example.com', '+62 814 4444 4444', 'Jl. Cendana 22',
     'BNI', '4444444444', 'Citra Wulandari', 'Eka', '+62 814 4444 4445', ''],
    ['Dimas Pratama',        '04.567.890.1-004.000', '3205555555550005', 'K/0', 18000000,
     2000000, 500000, 300000, 200000, 0, 0, 0, 360000, 180000, 180000, 0, 'REGULAR',
     'EMP-005', 'Finance Manager', 'Finance', '2021-09-01', '', '1985-12-03', 'M',
     'MARRIED', 'dimas@example.com', '+62 815 5555 5555', 'Jl. Asia Afrika 33',
     'Mandiri', '5555555555', 'Dimas Pratama', 'Maya', '+62 815 5555 5556', ''],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...samples], { cellDates: true });
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, 'PPh21 직원 데이터');

  const guideRows: string[][] = [
    ['컬럼 / Column', '설명 / Keterangan'],
    ['employee_name', '직원 이름 (필수)'],
    ['ptkp_category', 'TK/0, TK/1, K/0, K/1, K/2 ...'],
    ['gross_salary', '월 기본급 (필수, 숫자)'],
    ['worker_type', 'REGULAR / CONTRACT / DAILY / FREELANCER / COMMISSIONER'],
    ['hire_date', '입사일 YYYY-MM-DD'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guideRows), '안내 - Petunjuk');

  XLSX.writeFile(wb, join(ROOT, 'pph21-filled.xlsx'));
  console.log('✓ pph21-filled.xlsx (5 employees)');
}

/* ─────────────────────────────────────────────────────────────────────── */
/* WHT one-sheet — 8 행 (PPh23 jasa+sewa + PPh4(2) + PPh26 + PPN)        */
/* ─────────────────────────────────────────────────────────────────────── */
function buildWHT(): void {
  // JTC 21-col WHT one-sheet layout — re-export based on public template structure.
  // Two-row merged header (rows 5+6), data starts at row 7.
  const HEADER_TOP = ['NO','DATA PERUSAHAAN/ COMPANY DATA','','','DATA INVOICE & FAKTUR PAJAK','','','DATA TANGGAL/ DATE DATA','','','TIPE TRANSAKSI (TYPE OF TRANSACTION)','','NOMINAL ATAS RINCIAN TRANSAKSI','','','',' JUMLAH YANG DIBAYARKAN KE VENDOR','NOTES'];
  const HEADER_DET = ['','ALAMAT (ADDRESS)','NAMA (NAME)','NPWP (TAX ID)','DESKRIPSI TRANSAKSI','NO. INVOICE','NO. FAKTUR PAJAK','TGL INVOICE','TGL JTH TEMPO','TGL PEMBAYARAN','PPh 21/23/26 JASA/SEWA','PPh 4(2) SEWA TNH & BANGUNAN','DPP PPN','PPN','DPP PIHAK KETIGA','PPh AMOUNT','BIAYA MATERAI','BIAYA LAIN-LAIN','JUMLAH'];
  const rows: (string | number)[][] = [
    // PPh23 jasa
    [1, 'Jl. Sudirman 10', 'PT Konsultan Hukum Jaya', '03.456.789.0-001.000',
     'Legal advisory June', 'KHJ/2026/06/001', '010.000-26.00000001',
     '2026-06-05', '2026-07-05', '2026-06-25',
     'Jasa', '', 10000000, 1200000, 10000000, 200000, '', '', 11000000, ''],
    // PPh23 sewa
    [2, 'Jl. Thamrin 5', 'CV Sewa Alat Berat', '04.567.890.1-002.000',
     'Equipment rental excavator', 'SAB/2026/06/045', '010.000-26.00000002',
     '2026-06-08', '2026-07-08', '2026-06-28',
     'Sewa', '', 50000000, 6000000, 50000000, 1000000, '', '', 55000000, ''],
    // PPh4(2) — sewa tanah/bangunan
    [3, 'Jl. Gatot Subroto 88', 'PT Gedung Office Park', '08.901.234.5-006.000',
     'Office space rental June 2026', 'GOP/2026/Q2/012', '010.000-26.00000003',
     '2026-06-01', '2026-07-01', '2026-06-30',
     '', 'Sewa', 30000000, 3600000, 30000000, 3000000, 10000, '', 30590000, ''],
    // PPh26 — foreign vendor
    [4, 'Singapore, Marina Bay', 'Global Tech Advisors Pte Ltd', '',
     'Cross-border IT consulting', 'GTA-INV-2026-1133', '',
     '2026-06-20', '2026-07-20', '2026-07-05',
     'PPh26', '', '', '', 20000000, 4000000, '', '', 16000000, ''],
    // PPN MASUKAN (vat only, no WHT)
    [5, 'Jl. Kuningan 21', 'PT Vendor Material', '12.222.222.2-001.000',
     'Office supplies June', 'VM/2026/06/077', '010.000-26.00000011',
     '2026-06-03', '2026-07-03', '2026-06-15',
     '', '', 5000000, 600000, '', '', '', 50000, 5650000, ''],
    // PPh23 jasa (catering)
    [6, 'Jl. Mampang 33', 'CV Catering Sehat', '07.890.123.4-005.000',
     'Office lunch catering June', 'CCS/2026/06/200', '',
     '2026-06-22', '2026-07-22', '2026-07-10',
     'Jasa', '', 5000000, '', 5000000, 100000, '', '', 4900000, ''],
    // PPh23 jasa (cleaning)
    [7, 'Jl. Asia Afrika 50', 'CV Bersih Sentosa', '06.789.012.3-004.000',
     'Cleaning service June', 'BS/2026/06/120', '',
     '2026-06-18', '2026-07-18', '2026-07-05',
     'Jasa', '', 2000000, '', 2000000, 40000, '', '', 1960000, ''],
    // PPh4(2) — gudang
    [8, 'Jl. Industri 200', 'PT Logistik Warehouse', '09.012.345.6-007.000',
     'Warehouse rental June 2026', 'LW/2026/06/032', '010.000-26.00000004',
     '2026-06-10', '2026-07-10', '2026-06-28',
     '', 'Sewa', 15000000, 1800000, 15000000, 1500000, '', '', 15300000, ''],
  ];

  // 빈 헤더 4행 + 메타 2행 같은 layout 유지
  const aoa: (string | number)[][] = [
    ['NAME', ': PT EXAMPLE INDONESIA'],
    ['NPWP', ': 99.999.999.9-999.000'],
    ['ADDRESS', ': Jakarta'],
    ['PERIODE', ': JUNE 2026'],
    ['TAX COMPLIANCE'],
    HEADER_TOP,
    HEADER_DET,
    ...rows,
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  XLSX.utils.book_append_sheet(wb, ws, 'WHT');
  XLSX.writeFile(wb, join(ROOT, 'wht-onesheet-filled.xlsx'));
  console.log('✓ wht-onesheet-filled.xlsx (8 rows: PPh23×3 + PPh4(2)×2 + PPh26×1 + PPN-only×1)');
}

/* ─────────────────────────────────────────────────────────────────────── */
/* PPN 13-col VAT template — 3 OUT + 3 IN                                 */
/* ─────────────────────────────────────────────────────────────────────── */
function buildPPN(): void {
  const OUT_HEADER = ['NO','NPWP','NAME','ADDRESS','INVOICE NO','DESC','EFAKTUR NO','EFAKTUR DATE','TAX BASE','DPP NILAI LAIN','TAX RATE','VAT','NOTES'];
  const IN_HEADER  = ['NO','NPWP','NAME','ADDRESS','INVOICE NO','DESC','EFAKTUR NO','EFAKTUR DATE','TAX BASE','',                  'TAX RATE','VAT','NOTES'];
  const aoa: (string | number)[][] = [
    ['NAME', ': PT EXAMPLE INDONESIA'],
    ['NPWP', ': 99.999.999.9-999.000'],
    ['ADDRESS', ': Jakarta'],
    ['PERIOD', ': JUNE 2026'],
    [''],
    [''],
    [''],
    ['VAT OUT'],
    OUT_HEADER,
    [1, '11.111.111.1-001.000', 'PT Pelanggan Satu', 'Jl. Sudirman 1', 'INV/2026/06/001',
     'Sale of consulting services', '040.000-26.00000001', '2026-06-05', 25000000, '', 0.12, 3000000, ''],
    [2, '12.222.222.2-002.000', 'PT Pelanggan Dua',  'Jl. Thamrin 2',  'INV/2026/06/002',
     'Sale of training module',    '040.000-26.00000002', '2026-06-12', 18000000, '', 0.12, 2160000, ''],
    [3, '13.333.333.3-003.000', 'CV Pelanggan Tiga', 'Jl. Asia Afrika 3', 'INV/2026/06/003',
     'Software license (PMK 131)', '040.000-26.00000003', '2026-06-18', 15000000, 13750000, 0.12, 1650000, 'DPP Nilai Lain (PMK 131/2024)'],
    [4, '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', 'TOTAL VAT OUT', '', '', '', 6810000, ''],
    [''],
    ['VAT IN'],
    IN_HEADER,
    [1, '21.111.111.1-001.000', 'PT Vendor Satu',  'Jl. Hayam 11', 'VINV/2026/06/A1',
     'Office supplies purchase',   '010.000-26.00000011', '2026-06-03', 5000000, '', 0.12, 600000, ''],
    [2, '22.222.222.2-002.000', 'CV Vendor Dua',   'Jl. Pemuda 12', 'VINV/2026/06/A2',
     'IT equipment maintenance',   '010.000-26.00000012', '2026-06-08', 12000000, '', 0.12, 1440000, ''],
    [3, '23.333.333.3-003.000', 'PT Vendor Tiga',  'Jl. Wahidin 13', 'VINV/2026/06/A3',
     'Cloud hosting subscription', '010.000-26.00000013', '2026-06-15', 6500000, '', 0.12, 780000, ''],
    [4, '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', 'TOTAL VAT IN', '', '', '', 2820000, ''],
    [''],
    ['', '', '', '', '', '', '', 'CALCULATION:'],
    ['', '', '', '', '', '', '', 'TOTAL VAT OUT', '', '', '', 6810000, ''],
    ['', '', '', '', '', '', '', 'TOTAL VAT IN',  '', '', '', 2820000, ''],
    ['', '', '', '', '', '', '', 'VAT PAYABLE',   '', '', '', 3990000, ''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  XLSX.utils.book_append_sheet(wb, ws, 'PPN');
  XLSX.writeFile(wb, join(ROOT, 'ppn-filled.xlsx'));
  console.log('✓ ppn-filled.xlsx (OUT 3 + IN 3, including DPP Nilai Lain PMK 131)');
}

(() => {
  console.log('▶ public/test-data/ 에 양식 3종 생성 중…');
  buildPph21();
  buildWHT();
  buildPPN();
  console.log('\n✅ 완료. docs/guides/TEST_SCENARIO.md 의 흐름에 따라 업로드 테스트 가능.');
})();
