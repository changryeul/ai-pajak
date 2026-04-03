/**
 * CSV/Excel Bulk Import Parser
 *
 * Parses CSV (via papaparse) and Excel (via xlsx) files
 * into structured data for PPh21 salary, PPh23 transactions, and PPN faktur.
 */

import Papa from 'papaparse';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  headers: string[];
}

/**
 * Parse CSV string into structured rows with validation
 */
export function parseCSV(csvContent: string): ParseResult {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const headers = result.meta.fields || [];
  const rows: ParsedRow[] = (result.data as Record<string, string>[]).map((row, idx) => ({
    rowNumber: idx + 1,
    data: row,
    errors: [],
    isValid: true,
  }));

  return {
    rows,
    totalRows: rows.length,
    validRows: rows.length,
    errorRows: 0,
    headers,
  };
}

/**
 * Validate PPh23 transaction rows
 */
export function validatePPh23Rows(parsed: ParseResult): ParseResult {
  const requiredFields = ['transaction_date', 'service_type', 'gross_amount', 'counterparty_name'];
  const validServiceTypes = ['JASA_TEKNIK', 'JASA_MANAJEMEN', 'JASA_KONSULTAN', 'JASA_LAINNYA', 'SEWA', 'DIVIDEN', 'BUNGA', 'ROYALTI', 'HADIAH'];

  let validCount = 0;
  let errorCount = 0;

  for (const row of parsed.rows) {
    row.errors = [];

    for (const field of requiredFields) {
      if (!row.data[field] || row.data[field].trim() === '') {
        row.errors.push(`Missing: ${field}`);
      }
    }

    if (row.data.service_type && !validServiceTypes.includes(row.data.service_type.toUpperCase())) {
      row.errors.push(`Invalid service_type: ${row.data.service_type}`);
    }

    const amount = parseFloat(row.data.gross_amount);
    if (isNaN(amount) || amount <= 0) {
      row.errors.push('gross_amount must be positive number');
    }

    row.isValid = row.errors.length === 0;
    if (row.isValid) validCount++; else errorCount++;
  }

  return { ...parsed, validRows: validCount, errorRows: errorCount };
}

/**
 * Validate PPN faktur rows
 */
export function validatePPNRows(parsed: ParseResult): ParseResult {
  const requiredFields = ['faktur_date', 'counterparty_name', 'dpp'];

  let validCount = 0;
  let errorCount = 0;

  for (const row of parsed.rows) {
    row.errors = [];

    for (const field of requiredFields) {
      if (!row.data[field] || row.data[field].trim() === '') {
        row.errors.push(`Missing: ${field}`);
      }
    }

    const dpp = parseFloat(row.data.dpp);
    if (isNaN(dpp) || dpp <= 0) {
      row.errors.push('dpp must be positive number');
    }

    const fakturType = (row.data.faktur_type || 'KELUARAN').toUpperCase();
    if (!['KELUARAN', 'MASUKAN'].includes(fakturType)) {
      row.errors.push('faktur_type must be KELUARAN or MASUKAN');
    }

    row.isValid = row.errors.length === 0;
    if (row.isValid) validCount++; else errorCount++;
  }

  return { ...parsed, validRows: validCount, errorRows: errorCount };
}

/**
 * Validate PPh21 salary rows
 */
export function validatePPh21Rows(parsed: ParseResult): ParseResult {
  const requiredFields = ['employee_name', 'ptkp_category', 'gross_salary'];
  const validPTKP = ['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3', 'KI0', 'KI1', 'KI2', 'KI3'];

  let validCount = 0;
  let errorCount = 0;

  for (const row of parsed.rows) {
    row.errors = [];

    for (const field of requiredFields) {
      if (!row.data[field] || row.data[field].trim() === '') {
        row.errors.push(`Missing: ${field}`);
      }
    }

    if (row.data.ptkp_category && !validPTKP.includes(row.data.ptkp_category.toUpperCase())) {
      row.errors.push(`Invalid ptkp_category: ${row.data.ptkp_category}`);
    }

    const salary = parseFloat(row.data.gross_salary);
    if (isNaN(salary) || salary <= 0) {
      row.errors.push('gross_salary must be positive number');
    }

    row.isValid = row.errors.length === 0;
    if (row.isValid) validCount++; else errorCount++;
  }

  return { ...parsed, validRows: validCount, errorRows: errorCount };
}

/**
 * Generate CSV template string for download
 */
export function generateTemplate(type: 'PPh23' | 'PPh21' | 'PPN'): string {
  const templates: Record<string, string> = {
    PPh23: 'transaction_date,service_type,counterparty_name,counterparty_npwp,gross_amount,invoice_number,description\n2025-01-15,JASA_TEKNIK,PT ABC,01.234.567.8-901.234,10000000,INV-001,Consulting',
    PPh21: 'employee_name,employee_npwp,employee_nik,ptkp_category,gross_salary,jht_employee,jp_employee,position_allowance,other_deductions\nJohn Doe,01.234.567.8-901.234,1234567890123456,TK0,10000000,200000,100000,0,0',
    PPN: 'faktur_type,faktur_date,counterparty_name,counterparty_npwp,dpp,description\nKELUARAN,2025-01-15,PT XYZ,02.345.678.9-012.345,50000000,Sales of goods',
  };
  return templates[type];
}
