/**
 * Generate Sample Form 1721-A1 (Bukti Potong PPh 21) PDF
 *
 * Run: npx tsx scripts/generate-sample-1721a1.ts
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function generateSample1721A1() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 9;
  const smallFont = 7.5;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const blue = rgb(0, 0, 0.6);

  let y = 800;
  const leftMargin = 40;
  const rightMargin = 555;

  // Helper functions
  const drawText = (text: string, x: number, yPos: number, options?: { font?: typeof font; size?: number; color?: typeof black }) => {
    page.drawText(text, {
      x,
      y: yPos,
      font: options?.font || font,
      size: options?.size || fontSize,
      color: options?.color || black,
    });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: black,
    });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, fill?: typeof lightGray) => {
    page.drawRectangle({
      x, y: yPos, width: w, height: h,
      borderColor: black,
      borderWidth: 0.5,
      color: fill,
    });
  };

  // ===== HEADER =====
  drawText('DEPARTEMEN KEUANGAN REPUBLIK INDONESIA', leftMargin, y, { font: fontBold, size: 10 });
  y -= 14;
  drawText('DIREKTORAT JENDERAL PAJAK', leftMargin, y, { font: fontBold, size: 10 });
  y -= 20;

  // Form title
  drawRect(leftMargin, y - 15, rightMargin - leftMargin, 30, lightGray);
  drawText('FORMULIR 1721 - A1', 200, y, { font: fontBold, size: 12, color: blue });
  y -= 12;
  drawText('BUKTI PEMOTONGAN PAJAK PENGHASILAN PASAL 21 BAGI PEGAWAI TETAP', 100, y, { font: fontBold, size: 8 });
  y -= 18;

  // Lembar info
  drawText('Lembar 1 : untuk Penerima Penghasilan', leftMargin, y, { size: smallFont, color: gray });
  drawText('Lembar 2 : untuk Pemotong Pajak', 300, y, { size: smallFont, color: gray });
  y -= 20;

  // ===== NOMOR & MASA PAJAK =====
  drawLine(leftMargin, y, rightMargin, y);
  y -= 15;
  drawText('NOMOR', leftMargin, y, { font: fontBold });
  drawText(': 1.1-12.25-0000001', leftMargin + 80, y);
  drawText('MASA PEROLEHAN PENGHASILAN', 300, y, { font: fontBold });
  y -= 12;
  drawText('', leftMargin, y);
  drawText('01 - 2025  s.d.  12 - 2025', 300, y);
  y -= 5;
  drawLine(leftMargin, y, rightMargin, y);
  y -= 20;

  // ===== SECTION A: IDENTITAS PENERIMA PENGHASILAN =====
  drawText('A. IDENTITAS PENERIMA PENGHASILAN / KARYAWAN', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;

  const labelX = leftMargin + 10;
  const valueX = leftMargin + 180;

  const drawField = (label: string, value: string) => {
    drawText(label, labelX, y);
    drawText(`:  ${value}`, valueX, y);
    y -= 14;
  };

  drawField('1. NPWP', '09.876.543.2-012.000');
  drawField('2. NIK / No. KTP', '3201234567890001');
  drawField('3. Nama', 'BUDI SANTOSO');
  drawField('4. Alamat', 'Jl. Merdeka No. 123, RT 001/RW 002');
  drawText('', labelX, y);
  drawText(':  Kelurahan Menteng, Kec. Menteng', valueX, y);
  y -= 14;
  drawText('', labelX, y);
  drawText(':  Jakarta Pusat, DKI Jakarta 10310', valueX, y);
  y -= 14;
  drawField('5. Jenis Kelamin', 'Laki-Laki');
  drawField('6. Status / Jumlah Tanggungan', 'K/2 (Kawin, 2 Tanggungan)');
  drawField('7. Nama Jabatan', 'Senior Software Engineer');
  y -= 5;
  drawLine(leftMargin, y, rightMargin, y);
  y -= 20;

  // ===== SECTION B: RINCIAN PENGHASILAN =====
  drawText('B. RINCIAN PENGHASILAN DAN PENGHITUNGAN PPh PASAL 21', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;

  // Table header
  const col1 = leftMargin + 10;
  const col2 = 350;
  const col3 = rightMargin - 10;

  drawRect(col1 - 5, y - 12, col2 - col1 + 5, 16, lightGray);
  drawRect(col2, y - 12, col3 - col2, 16, lightGray);
  drawText('URAIAN', col1 + 100, y - 8, { font: fontBold, size: 8 });
  drawText('JUMLAH (Rp)', col2 + 40, y - 8, { font: fontBold, size: 8 });
  y -= 16;

  const drawRow = (no: string, label: string, value: string, bold?: boolean) => {
    drawText(no, col1, y);
    drawText(label, col1 + 25, y, { font: bold ? fontBold : font });
    drawText(value, col3 - font.widthOfTextAtSize(value, fontSize) - 5, y, { font: bold ? fontBold : font });
    y -= 14;
  };

  // PENGHASILAN BRUTO
  drawText('PENGHASILAN BRUTO :', col1, y, { font: fontBold });
  y -= 14;
  drawRow('1.', 'Gaji / Pensiun atau THT / JHT', '180.000.000');
  drawRow('2.', 'Tunjangan PPh', '0');
  drawRow('3.', 'Tunjangan Lainnya, Uang Lembur dsb', '24.000.000');
  drawRow('4.', 'Honorarium dan Imbalan Lain Sejenisnya', '0');
  drawRow('5.', 'Premi Asuransi yg dibayar Pemberi Kerja', '3.600.000');
  drawRow('6.', 'Penerimaan Dalam Bentuk Natura', '0');
  drawRow('7.', 'Tantiem, Bonus, Gratifikasi, THR dsb', '30.000.000');
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('8.', 'JUMLAH PENGHASILAN BRUTO (1 s.d. 7)', '237.600.000', true);
  y -= 5;
  drawLine(leftMargin, y + 5, rightMargin, y + 5);

  // PENGURANG
  drawText('PENGURANG :', col1, y, { font: fontBold });
  y -= 14;
  drawRow('9.', 'Biaya Jabatan (5% x 8, maks Rp 6.000.000)', '6.000.000');
  drawRow('10.', 'Iuran Pensiun / Iuran JHT', '2.400.000');
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('11.', 'JUMLAH PENGURANG (9 + 10)', '8.400.000', true);
  y -= 5;
  drawLine(leftMargin, y + 5, rightMargin, y + 5);

  // PENGHITUNGAN PPh
  drawText('PENGHITUNGAN PPh PASAL 21 :', col1, y, { font: fontBold });
  y -= 14;
  drawRow('12.', 'JUMLAH PENGHASILAN NETO (8 - 11)', '229.200.000', true);
  drawRow('13.', 'Penghasilan Neto Masa Sebelumnya', '0');
  drawRow('14.', 'JUMLAH PENGHASILAN NETO (12 + 13)', '229.200.000', true);
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('15.', 'PTKP (K/2)', '67.500.000');
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('16.', 'PKP = PENGHASILAN KENA PAJAK (14 - 15)', '161.700.000', true);
  y -= 5;
  drawLine(leftMargin, y + 5, rightMargin, y + 5);

  // TAX CALCULATION
  drawText('PPh PASAL 21 TERUTANG :', col1, y, { font: fontBold });
  y -= 14;
  drawRow('17.', 'PPh Pasal 21 atas PKP :', '');
  drawRow('', '   5%  x  Rp 60.000.000  =', '3.000.000');
  drawRow('', '  15%  x  Rp 101.700.000 =', '15.255.000');
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('18.', 'PPh PASAL 21 YANG TERUTANG', '18.255.000', true);
  drawRow('19.', 'PPh Pasal 21 yang telah Dipotong Masa Sebelumnya', '0');
  y -= 3;
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('20.', 'PPh PASAL 21 YANG TELAH DIPOTONG', '18.255.000', true);
  y -= 10;
  drawLine(leftMargin, y + 5, rightMargin, y + 5);

  // ===== SECTION C: IDENTITAS PEMOTONG =====
  y -= 5;
  drawText('C. IDENTITAS PEMOTONG PAJAK / PEMBERI KERJA', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;

  drawField('1. NPWP', '01.234.567.8-091.000');
  drawField('2. Nama', 'PT TEKNOLOGI MAJU INDONESIA');
  drawField('3. Alamat', 'Jl. Sudirman No. 456, Jakarta Selatan 12190');
  y -= 5;

  // Signature area
  y -= 10;
  drawText('Jakarta, 15 Januari 2026', 350, y);
  y -= 14;
  drawText('Pemotong Pajak,', 350, y);
  y -= 40;
  drawText('AHMAD WIJAYA', 350, y, { font: fontBold });
  y -= 12;
  drawText('Direktur Keuangan', 350, y, { size: smallFont });

  // Footer
  y = 30;
  drawText('F.1.1.33.01', leftMargin, y, { size: smallFont, color: gray });
  drawText('Tahun Pajak: 2025', 250, y, { size: smallFont, color: gray });

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  const outputDir = path.resolve(process.cwd(), 'test-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'sample-1721-A1.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`\nSample Form 1721-A1 generated: ${outputPath}`);
  console.log('\nData in this sample:');
  console.log('  Employee: BUDI SANTOSO');
  console.log('  NPWP: 09.876.543.2-012.000');
  console.log('  NIK: 3201234567890001');
  console.log('  Status PTKP: K/2');
  console.log('  Employer: PT TEKNOLOGI MAJU INDONESIA');
  console.log('  Employer NPWP: 01.234.567.8-091.000');
  console.log('  Gross Income: Rp 237,600,000');
  console.log('  Position Costs: Rp 6,000,000');
  console.log('  Pension: Rp 2,400,000');
  console.log('  Net Income: Rp 229,200,000');
  console.log('  PTKP: Rp 67,500,000');
  console.log('  PKP: Rp 161,700,000');
  console.log('  Tax Due (PPh 21): Rp 18,255,000');
  console.log('  Tax Withheld: Rp 18,255,000');
  console.log('  Tax Year: 2025');
  console.log('  Period: 01-2025 s.d. 12-2025');

  // Generate a second sample with different data
  await generateSecondSample(outputDir);
}

async function generateSecondSample(outputDir: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 9;
  const smallFont = 7.5;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const blue = rgb(0, 0, 0.6);

  let y = 800;
  const leftMargin = 40;
  const rightMargin = 555;

  const drawText = (text: string, x: number, yPos: number, options?: { font?: typeof font; size?: number; color?: typeof black }) => {
    page.drawText(text, { x, y: yPos, font: options?.font || font, size: options?.size || fontSize, color: options?.color || black });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, fill?: typeof lightGray) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: black, borderWidth: 0.5, color: fill });
  };

  // Header
  drawText('DEPARTEMEN KEUANGAN REPUBLIK INDONESIA', leftMargin, y, { font: fontBold, size: 10 });
  y -= 14;
  drawText('DIREKTORAT JENDERAL PAJAK', leftMargin, y, { font: fontBold, size: 10 });
  y -= 20;

  drawRect(leftMargin, y - 15, rightMargin - leftMargin, 30, lightGray);
  drawText('FORMULIR 1721 - A1', 200, y, { font: fontBold, size: 12, color: blue });
  y -= 12;
  drawText('BUKTI PEMOTONGAN PAJAK PENGHASILAN PASAL 21 BAGI PEGAWAI TETAP', 100, y, { font: fontBold, size: 8 });
  y -= 35;

  // Nomor & Masa Pajak
  drawLine(leftMargin, y + 5, rightMargin, y + 5);
  drawText('NOMOR : 1.1-12.25-0000045', leftMargin, y, { font: fontBold });
  drawText('MASA PEROLEHAN : 01 - 2025  s.d.  12 - 2025', 300, y);
  y -= 5;
  drawLine(leftMargin, y, rightMargin, y);
  y -= 20;

  // Section A
  drawText('A. IDENTITAS PENERIMA PENGHASILAN', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;

  const labelX = leftMargin + 10;
  const valueX = leftMargin + 180;

  const drawField = (label: string, value: string) => {
    drawText(label, labelX, y);
    drawText(`:  ${value}`, valueX, y);
    y -= 14;
  };

  drawField('1. NPWP', '09.876.543.2-012.000');
  drawField('2. NIK', '3201234567890001');
  drawField('3. Nama', 'BUDI SANTOSO');
  drawField('4. Alamat', 'Jl. Merdeka No. 123, Jakarta Pusat');
  drawField('5. Status PTKP', 'K/2');
  y -= 5;
  drawLine(leftMargin, y, rightMargin, y);
  y -= 20;

  // Section B - Simplified
  drawText('B. RINCIAN PENGHASILAN DAN PENGHITUNGAN PPh', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;

  const col2 = 350;
  const col3 = rightMargin - 10;

  const drawRow = (label: string, value: string, bold?: boolean) => {
    drawText(label, labelX, y, { font: bold ? fontBold : font });
    drawText(value, col3 - font.widthOfTextAtSize(value, fontSize) - 5, y, { font: bold ? fontBold : font });
    y -= 14;
  };

  drawRow('Gaji Pokok', '120.000.000');
  drawRow('Tunjangan', '18.000.000');
  drawRow('THR / Bonus', '12.000.000');
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('PENGHASILAN BRUTO', '150.000.000', true);
  y -= 5;
  drawRow('Biaya Jabatan (5%)', '6.000.000');
  drawRow('Iuran Pensiun', '1.800.000');
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('JUMLAH PENGURANG', '7.800.000', true);
  y -= 5;
  drawRow('PENGHASILAN NETO', '142.200.000', true);
  drawRow('PTKP (K/2)', '67.500.000');
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('PKP (PENGHASILAN KENA PAJAK)', '74.700.000', true);
  y -= 5;
  drawRow('PPh 21:  5% x 60.000.000 =', '3.000.000');
  drawRow('        15% x 14.700.000 =', '2.205.000');
  drawLine(col2, y + 3, col3, y + 3);
  drawRow('PPh PASAL 21 TERUTANG', '5.205.000', true);
  drawRow('PPh PASAL 21 YANG DIPOTONG', '5.205.000', true);
  y -= 10;
  drawLine(leftMargin, y + 5, rightMargin, y + 5);

  // Section C
  y -= 5;
  drawText('C. IDENTITAS PEMOTONG PAJAK', leftMargin, y, { font: fontBold, size: 10 });
  y -= 18;
  drawField('1. NPWP', '02.345.678.9-054.000');
  drawField('2. Nama', 'PT KONSULTAN DIGITAL NUSANTARA');
  drawField('3. Alamat', 'Jl. Gatot Subroto No. 789, Jakarta Selatan');

  y -= 20;
  drawText('Jakarta, 20 Januari 2026', 350, y);
  y -= 14;
  drawText('Pemotong Pajak,', 350, y);
  y -= 35;
  drawText('SITI RAHAYU', 350, y, { font: fontBold });
  y -= 12;
  drawText('Direktur HRD', 350, y, { size: smallFont });

  // Footer
  drawText('Tahun Pajak: 2025', 250, 30, { size: smallFont, color: gray });

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(outputDir, 'sample-1721-A1-second-employer.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`\nSecond sample generated: ${outputPath}`);
  console.log('\nData in second sample:');
  console.log('  Employee: BUDI SANTOSO (same person, second employer)');
  console.log('  Employer: PT KONSULTAN DIGITAL NUSANTARA');
  console.log('  Employer NPWP: 02.345.678.9-054.000');
  console.log('  Gross Income: Rp 150,000,000');
  console.log('  Net Income: Rp 142,200,000');
  console.log('  Tax Withheld: Rp 5,205,000');
}

generateSample1721A1().catch(console.error);
