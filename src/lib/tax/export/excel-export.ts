/**
 * Excel Export Service
 *
 * Generates XLSX files for PPh23 transactions, PPN faktur, and SPT Masa summaries.
 * Uses xlsx (SheetJS) library.
 */

import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

/**
 * Generate Excel buffer from data rows
 */
export function generateExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title?: string
): Buffer {
  const wb = XLSX.utils.book_new();

  // Build header row + data rows
  const headers = columns.map(c => c.header);
  const dataRows = rows.map(row => columns.map(c => row[c.key] ?? ''));

  const wsData = title
    ? [[title], [], headers, ...dataRows]
    : [headers, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * PPh23 transaction export columns
 */
export const PPH23_COLUMNS: ExportColumn[] = [
  { header: 'Tanggal', key: 'transaction_date', width: 12 },
  { header: 'Jenis Jasa', key: 'service_type', width: 18 },
  { header: 'Lawan Transaksi', key: 'counterparty_name', width: 25 },
  { header: 'NPWP', key: 'counterparty_npwp', width: 20 },
  { header: 'DPP (Rp)', key: 'gross_amount', width: 18 },
  { header: 'Tarif', key: 'tax_rate', width: 8 },
  { header: 'PPh 23 (Rp)', key: 'tax_amount', width: 18 },
  { header: 'No. Invoice', key: 'invoice_number', width: 15 },
  { header: 'No. Bukti Potong', key: 'bukti_potong_number', width: 22 },
  { header: 'Keterangan', key: 'description', width: 25 },
];

/**
 * PPh26 transaction export columns
 */
export const PPH26_COLUMNS: ExportColumn[] = [
  { header: 'Tanggal', key: 'transaction_date', width: 12 },
  { header: 'Jenis Penghasilan', key: 'income_type', width: 18 },
  { header: 'Penerima', key: 'recipient_name', width: 25 },
  { header: 'Negara', key: 'recipient_country', width: 8 },
  { header: 'DPP (Rp)', key: 'gross_amount', width: 18 },
  { header: 'Tarif Standar', key: 'standard_rate', width: 12 },
  { header: 'Tarif Diterapkan', key: 'applied_rate', width: 14 },
  { header: 'PPh 26 (Rp)', key: 'tax_amount', width: 18 },
  { header: 'P3B', key: 'treaty_applied', width: 6 },
  { header: 'CoD', key: 'has_cod', width: 6 },
];

/**
 * PPN faktur export columns
 */
export const PPN_COLUMNS: ExportColumn[] = [
  { header: 'No. Faktur', key: 'faktur_number', width: 18 },
  { header: 'Tanggal', key: 'faktur_date', width: 12 },
  { header: 'Jenis', key: 'faktur_type', width: 12 },
  { header: 'Lawan Transaksi', key: 'counterparty_name', width: 25 },
  { header: 'NPWP', key: 'counterparty_npwp', width: 20 },
  { header: 'DPP (Rp)', key: 'dpp', width: 18 },
  { header: 'PPN (Rp)', key: 'ppn', width: 18 },
  { header: 'Status', key: 'status', width: 12 },
];
