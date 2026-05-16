/**
 * P3 mvp mock parser.
 *
 * Generates realistic row data per slot so the rule engine + UI can be
 * exercised without a real file. The next iteration (P3.b) replaces this
 * with a Claude Sonnet 4.6 streaming call against the stored file.
 */

export interface MockRow {
  rowIndex: number;
  entityLabel: string;
  fields: Record<string, unknown>;
}

const PAYROLL_ROWS: MockRow[] = [
  {
    rowIndex: 1,
    entityLabel: 'Pratiwi Sari',
    fields: {
      employeeName: 'Pratiwi Sari',
      npwpNik: '3275010101010001',
      ptkp: 'TK/0',
      basicSalary: 14_500_000,
      bonus: 2_500_000,
      overtime: 1_000_000,
      bpjsKesEmployee: 145_000,
      taxMethod: 'Gross',
      residency: 'Resident',
      bankAccount: 'BCA 123-456',
    },
  },
  {
    rowIndex: 2,
    entityLabel: 'Wulan Hasanah',
    fields: {
      employeeName: 'Wulan Hasanah',
      npwpNik: '',
      ptkp: 'K/1',
      basicSalary: 18_000_000,
      bonus: 2_500_000,
      overtime: 0,
      bpjsKesEmployee: 0,
      taxMethod: 'Gross-up',
      residency: 'Resident',
      bankAccount: 'Mandiri 987',
    },
  },
  {
    rowIndex: 3,
    entityLabel: 'Minho Kim',
    fields: {
      employeeName: 'Minho Kim',
      npwpNik: 'TEMP-PAS123',
      ptkp: 'K/2',
      basicSalary: 42_000_000,
      bonus: 6_000_000,
      overtime: 0,
      bpjsKesEmployee: 520_000,
      taxMethod: '',
      residency: 'Expat',
      bankAccount: '',
    },
  },
  {
    rowIndex: 4,
    entityLabel: 'Rudi Hartono',
    fields: {
      employeeName: 'Rudi Hartono',
      npwpNik: '3174011502010001',
      ptkp: 'K/4',
      basicSalary: 1_500_000,
      bonus: 0,
      overtime: 0,
      bpjsKesEmployee: 0,
      taxMethod: 'Gross',
      residency: 'Resident',
      bankAccount: 'BNI 444-55',
    },
  },
];

const WITHHOLDING_INVOICE_ROWS: MockRow[] = [
  {
    rowIndex: 1,
    entityLabel: 'PT Service Digital · INV-043',
    fields: {
      counterpartyName: 'PT Service Digital',
      counterpartyNpwp: '04.321.987.6-012.000',
      invoiceNo: 'INV-043',
      transactionDate: '2026-04-02',
      transactionType: 'Jasa IT',
      dpp: 45_000_000,
      vat: 5_000_000,
      gross: 50_000_000,
      country: 'ID',
      suggestedPph: 'PPh 23',
      suggestedRate: 0.02,
      dgtFormRequired: false,
    },
  },
  {
    rowIndex: 2,
    entityLabel: 'PT Archi Konstruksi · INV-077',
    fields: {
      counterpartyName: 'PT Archi Konstruksi',
      counterpartyNpwp: '02.456.789.1-055.000',
      invoiceNo: 'INV-077',
      transactionDate: '2026-04-12',
      transactionType: 'Jasa Konstruksi',
      dpp: 3_600_000_000,
      vat: 399_500_000,
      gross: 4_000_000_000,
      country: 'ID',
      suggestedPph: 'PPh 4(2) Construction (B)',
      suggestedRate: 0.0265,
      dgtFormRequired: false,
    },
  },
  {
    rowIndex: 3,
    entityLabel: 'ABC Pte Ltd · INV-SG-011',
    fields: {
      counterpartyName: 'ABC Pte Ltd',
      counterpartyNpwp: '',
      invoiceNo: 'INV-SG-011',
      transactionDate: '2026-04-19',
      transactionType: 'Foreign Service',
      dpp: 120_000_000,
      vat: 0,
      gross: 120_000_000,
      country: 'SG',
      suggestedPph: 'PPh 26',
      suggestedRate: 0.2,
      dgtFormRequired: true,
      dgtFormDate: null,
    },
  },
];

const VAT_IN_OUT_ROWS: MockRow[] = [
  ...['Customer Alpha', 'Customer Beta', 'Customer Gamma'].map((name, i) => ({
    rowIndex: i + 1,
    entityLabel: `OUTPUT · ${name}`,
    fields: {
      type: 'OUTPUT',
      fakturNo: `010.001-26.123${i}`,
      counterpartyName: `PT ${name}`,
      counterpartyNpwp: `0${i + 1}.111.222.${i + 3}-001`,
      transactionDate: '2026-04-15',
      dpp: [280_000_000, 300_000_000, 200_000_000][i],
      vat: [30_800_000, 33_000_000, 22_000_000][i],
    },
  })),
  ...['Vendor Office', 'Cloud Service', 'Rental Space'].map((name, i) => ({
    rowIndex: i + 4,
    entityLabel: `INPUT · ${name}`,
    fields: {
      type: 'INPUT',
      fakturNo: `011.001-26.876${i}`,
      counterpartyName: `PT ${name}`,
      counterpartyNpwp: `0${i + 4}.444.555.${i + 6}-002`,
      transactionDate: '2026-04-20',
      dpp: [110_000_000, 150_000_000, 50_000_000][i],
      vat: [12_100_000, 16_500_000, 5_500_000][i],
    },
  })),
];

const BANK_STATEMENT_ROWS: MockRow[] = [
  { rowIndex: 1, entityLabel: '급여 지급', fields: { type: 'DEBIT', amount: 94_000_000, description: 'Gaji April' } },
  { rowIndex: 2, entityLabel: 'INV-043 결제', fields: { type: 'DEBIT', amount: 45_000_000, description: 'PT Service Digital' } },
];

const SLOT_MOCKS: Record<string, MockRow[]> = {
  PAYROLL: PAYROLL_ROWS,
  WITHHOLDING_INVOICE: WITHHOLDING_INVOICE_ROWS,
  VAT_IN_OUT: VAT_IN_OUT_ROWS,
  BANK_STATEMENT: BANK_STATEMENT_ROWS,
  CORP_TAX_INPUT: [],
  OTHER_REFERENCE: [],
};

export function getMockRowsForSlot(slot: string): MockRow[] {
  return SLOT_MOCKS[slot] ?? [];
}
