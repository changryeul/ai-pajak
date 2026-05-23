/**
 * Accurate Invoice Classifier
 *
 * Transforms raw Accurate invoices into tax_calculation-ready records.
 * Classifies each invoice by Indonesian tax regime:
 *
 * SALES invoices:
 *   - has_ppn: taxAmount1 > 0 → PPN Keluaran (output VAT)
 *   - customer NPWP missing → NPWP surcharge warning
 *
 * PURCHASE invoices:
 *   - has_ppn: taxAmount1 > 0 → PPN Masukan (input VAT, creditable)
 *   - Service vendors → likely PPh 23 withholding (2% typical)
 *   - Goods-only → PPh 22 not applicable; no withholding
 *   - Vendor without NPWP → 100% PPh 23 surcharge
 */

export type TaxType = 'PPN_OUTPUT' | 'PPN_INPUT' | 'PPh23' | 'PPh4_FINAL' | 'NONE';

export interface ClassificationResult {
  tax_type: TaxType;
  tax_rate: number;           // e.g., 0.11 for PPN, 0.02 for PPh23
  tax_base: number;           // Amount subject to tax
  calculated_tax: number;     // tax_base × tax_rate
  warnings: string[];         // e.g., 'Missing NPWP', 'Possible service — verify PPh23'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InvoiceInput {
  invoice_type: 'SALES' | 'PURCHASE';
  counterparty_name: string | null;
  counterparty_npwp: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  has_ppn: boolean;
}

/**
 * Heuristic service-vendor detection based on name keywords.
 * For accuracy, this should eventually use KBLI code from the vendor record.
 */
const SERVICE_KEYWORDS = [
  'jasa', 'service', 'consult', 'consulting', 'agency', 'agen',
  'law', 'legal', 'advokat', 'notaris', 'akuntan', 'audit',
  'engineering', 'konsultan', 'design', 'marketing', 'maintenance',
  'teknik', 'pemeliharaan', 'service provider',
];

function looksLikeService(name: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return SERVICE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Classify a single invoice. Returns an array because a purchase invoice
 * can trigger multiple tax events (PPN input + PPh 23 withholding).
 */
export function classifyInvoice(inv: InvoiceInput): ClassificationResult[] {
  const results: ClassificationResult[] = [];

  if (inv.invoice_type === 'SALES') {
    // PPN Keluaran (output VAT)
    if (inv.has_ppn && inv.tax_amount > 0) {
      const warnings: string[] = [];
      if (!inv.counterparty_npwp) {
        warnings.push('Customer NPWP missing — Faktur Pajak issuance may fail.');
      }
      results.push({
        tax_type: 'PPN_OUTPUT',
        tax_rate: 0.11,
        tax_base: inv.subtotal,
        calculated_tax: inv.tax_amount,
        warnings,
        confidence: inv.counterparty_npwp ? 'HIGH' : 'MEDIUM',
      });
    }
    // Sales without PPN → likely small taxpayer, no classification needed
  } else {
    // PURCHASE

    // PPN Masukan (input VAT, creditable if vendor is PKP)
    if (inv.has_ppn && inv.tax_amount > 0) {
      const warnings: string[] = [];
      if (!inv.counterparty_npwp) {
        warnings.push('Supplier NPWP missing — input PPN cannot be credited.');
      }
      results.push({
        tax_type: 'PPN_INPUT',
        tax_rate: 0.11,
        tax_base: inv.subtotal,
        calculated_tax: inv.tax_amount,
        warnings,
        confidence: inv.counterparty_npwp ? 'HIGH' : 'LOW',
      });
    }

    // PPh 23 withholding (services, 2%)
    if (looksLikeService(inv.counterparty_name)) {
      const warnings: string[] = ['Estimated to be a service supplier — verify PPh 23 withholding.'];
      const hasNpwp = !!inv.counterparty_npwp;
      const rate = hasNpwp ? 0.02 : 0.04; // 100% surcharge if no NPWP
      if (!hasNpwp) {
        warnings.push('NPWP missing — PPh 23 4% rate applies (100% surcharge).');
      }
      results.push({
        tax_type: 'PPh23',
        tax_rate: rate,
        tax_base: inv.subtotal,
        calculated_tax: Math.round(inv.subtotal * rate),
        warnings,
        confidence: 'MEDIUM',
      });
    }
  }

  return results;
}

/**
 * Suggest tax period (YYYY-MM) from invoice date
 */
export function toTaxPeriod(invoiceDate: string): string {
  return invoiceDate.substring(0, 7); // YYYY-MM
}
