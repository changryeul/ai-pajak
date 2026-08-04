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

import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';

const ROOT = join(__dirname, '..', 'public', 'test-data');
mkdirSync(ROOT, { recursive: true });

/* ─────────────────────────────────────────────────────────────────────── */
/* PPh21 직원 등록 (43-col 표준 양식 + 5 employees with Employment status)  */
/*                                                                       */
/* 표준 양식 = public/templates/pph21-template.xlsx (사용자가 2026-06-19 자  */
/* 로 표준화 결정). Employment status (col 1) — 1:Pegawai Tetap, 2:Tidak   */
/* Tetap, 3:Bukan Pegawai (PMK 66/2023 분류).                              */
/* ─────────────────────────────────────────────────────────────────────── */
function buildPph21(): void {
  // 표준 양식 base 그대로 읽어와서 헤더 + 안내 시트 보존
  const baseBuf = readFileSync(join(__dirname, '..', 'public', 'templates', 'pph21-template.xlsx'));
  const baseWb = XLSX.read(baseBuf, { type: 'buffer', cellDates: true });
  const baseWs = baseWb.Sheets['PPh21'];
  const baseAoa = XLSX.utils.sheet_to_json<unknown[]>(baseWs, { header: 1, defval: null }) as unknown[][];
  const headers = baseAoa[0]; // 43 columns

  // 5 employees:
  //  Andi/Sari/Budi → Pegawai Tetap (1) — 정직원, BPJS 모두 적용
  //  Citra          → Pegawai Tidak Tetap (2) — 단기 계약
  //  Dimas          → Bukan Pegawai (3) — 외부 컨설턴트 / commission
  // PMK 66/2023 분류 그대로 반영. Type 2/3 은 BPJS / JKK / JKM / JKP 비움.
  const samples: (unknown[])[] = [
    // col index:                          0          1                                          2                              3                       4               5      6                              7         8       9        10      11     12  13  14  15      16  17  18  19  20      21      22      23  24      25      26      27  28                  29           30           31  32           33   34                   35                    36                          37        38            39                40                        41                42
    [/*employee_number*/'EMP-001', /*Employment status*/1, /*employee_name*/'Andi Wijaya',          /*npwp*/'01.234.567.8-001.000', /*nik*/'3201111111110001', /*ptkp*/'K/2', /*tax method*/'Gross',         /*gross_salary*/15000000, /*pos_all*/2500000, /*overtime*/0, /*meal*/300000, /*transport*/200000, /*other_all*/0,   /*natura*/'', /*bonus*/0, /*thr*/0,         /*pinjaman*/'', /*potong*/'', /*jkk*/100000, /*jkm*/30000, /*jht_co*/450000, /*jp_co*/300000, /*bpjs_co*/600000, /*jkp_co*/30000, /*jht_emp*/300000, /*jp_emp*/150000, /*bpjs_emp*/150000, /*jkp_emp*/0, /*position*/'Senior Engineer', /*dept*/'IT',         /*join*/'2022-03-01', /*resign*/'', /*birth*/'1989-04-12', /*gender*/'M', /*email*/'andi@example.com',  /*phone*/'+62 811 1111 1111', /*address*/'Jl. Sudirman 10',     /*bank*/'BCA',     /*acc_no*/'1111111111', /*acc_name*/'Andi Wijaya',     /*emerg_name*/'Wati',  /*emerg_phone*/'+62 811 1111 1112', /*notes*/''],
    [          'EMP-002',                       1,                       'Sari Lestari',                            '',                              '3202222222220002', 'TK/0',          'Gross',                                  8000000,         500000,         0,         300000,           200000,            0,         '',           0,         0,                  '',             '',         60000,         18000,         240000,         160000,         320000,         16000,         160000,         80000,         80000,         0, 'Analyst',                       'HR',                       '2024-08-15',         '',                       '1996-09-25',           'F',         'sari@example.com',                       '+62 812 2222 2222',                       'Jl. Thamrin 5',                                'BCA',                       '2222222222',                              'Sari Lestari',                       'Rini',                       '+62 812 2222 2223',         ''],
    [          'EMP-003',                       1,                       'Budi Hartono',                            '02.345.678.9-002.000',          '3203333333330003', 'K/1',           'Gross Up',                              25000000,         4000000,        0,         300000,           200000,            0,         '',     2083333,         0,                  '',             '',        150000,         50000,         750000,         500000,         1000000,        50000,         500000,         250000,         250000,         0, 'Director',                      'Operations',               '2020-01-15',         '',                       '1982-11-08',           'M',         'budi@example.com',                       '+62 813 3333 3333',                       'Jl. Gatot 88',                                 'Mandiri',                   '3333333333',                              'Budi Hartono',                       'Sri',                       '+62 813 3333 3334',         ''],
    // Pegawai Tidak Tetap (2) — BPJS / JKK / JKM / JKP 미적용 (빈 칸)
    [          'EMP-004',                       2,                       'Citra Wulandari',                         '03.456.789.0-003.000',          '3204444444440004', 'TK/1',          'Gross',                                  6000000,               0,        0,              0,                0,            0,         '',           0,         0,                  '',             '',            '',            '',             '',             '',              '',           '',             '',            '',              '',         '', 'Field Worker',                  'Operations',               '2026-04-10',         '',                       '1992-06-30',           'F',         'citra@example.com',                       '+62 814 4444 4444',                       'Jl. Cendana 22',                                  '',                       '',                                      'Citra Wulandari',                       'Eka',                       '+62 814 4444 4445',         '6개월 단기 계약'],
    // Bukan Pegawai (3) — 외부 컨설턴트, 임금/공제 항목 거의 비움
    [          'EMP-005',                       3,                       'Dimas Pratama',                           '04.567.890.1-004.000',          '3205555555550005', 'K/0',           'Gross',                                   3500000,               0,        0,              0,                0,            0,         '',           0,         0,                  '',             '',            '',            '',             '',             '',              '',           '',             '',            '',              '',         '', 'External Consultant',           'Project',                  '2026-05-15',         '',                       '1985-12-03',           'M',         'dimas@example.com',                       '+62 815 5555 5555',                       'Jl. Asia Afrika 33',                              '',                       '',                                      'Dimas Pratama',                       'Maya',                       '+62 815 5555 5556',         '프로젝트 단위 계약'],
  ];

  // headers + 5 sample rows
  const filledAoa: unknown[][] = [headers, ...samples];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filledAoa, { cellDates: true });
  XLSX.utils.book_append_sheet(wb, ws, 'PPh21');
  // 안내 시트 그대로 복사
  if (baseWb.Sheets['Petunjuk (Guideline)']) {
    XLSX.utils.book_append_sheet(wb, baseWb.Sheets['Petunjuk (Guideline)'], 'Petunjuk (Guideline)');
  }
  XLSX.writeFile(wb, join(ROOT, 'pph21-filled.xlsx'));
  console.log('✓ pph21-filled.xlsx (5 employees: type 1×3 + 2×1 + 3×1, 43-col 표준 양식)');
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
