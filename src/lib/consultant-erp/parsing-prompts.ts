/**
 * Slot-specific Claude prompts for Consultant ERP document parsing.
 *
 * Each prompt asks Claude to read a single source document and return a JSON
 * `{ rows: [...] }` payload whose fields line up exactly with the rule engine
 * keys in parse-row-rules.ts. Keep schemas in sync.
 */

const PAYROLL_PROMPT = `You are extracting Indonesian payroll data for a tax-consultant ERP.

Read the attached payroll document (Excel/CSV/PDF/image) and return a JSON
object with the shape:

{
  "rows": [
    {
      "employeeName": string,
      "npwpNik": string,         // NPWP or NIK (Indonesian ID); empty string if missing
      "ptkp": string,            // TK/0, TK/1, K/0, K/1, K/2, K/3, HB/0, …
      "basicSalary": number,
      "bonus": number,
      "overtime": number,
      "bpjsKesEmployee": number, // employee portion only
      "taxMethod": string,       // "Gross" | "Gross-up" | "Net" | ""
      "residency": string,       // "Resident" | "Expat" | ""
      "bankAccount": string
    }, ...
  ]
}

Rules:
- Use 0 (number) for missing numeric fields, "" (string) for missing strings.
- Preserve the original order. Do not invent rows.
- Numbers must be plain integers (no commas, no Rp).
- Output ONLY the JSON. No markdown fences, no commentary.`;

const WITHHOLDING_INVOICE_PROMPT = `You are extracting withholding-tax related invoices for an Indonesian tax
ERP. Read the attached document (PDF, image, Excel, or CSV) and return:

{
  "rows": [
    {
      "counterpartyName": string,
      "counterpartyNpwp": string,  // empty if foreign
      "invoiceNo": string,
      "transactionDate": string,   // ISO YYYY-MM-DD if known
      "transactionType": string,   // e.g. "Jasa IT", "Jasa Konstruksi", "Foreign Service"
      "dpp": number,                // base amount
      "vat": number,
      "gross": number,
      "country": string,            // ISO-2, default "ID"
      "suggestedPph": string,       // e.g. "PPh 23", "PPh 4(2) Construction (B)", "PPh 26"
      "suggestedRate": number,      // decimal (0.02 for 2%)
      "dgtFormRequired": boolean,
      "dgtFormDate": string|null    // ISO date or null
    }, ...
  ]
}

Heuristics:
- counterparty country: if address mentions Singapore/Malaysia/USA/Korea etc.,
  set country accordingly and dgtFormRequired=true.
- For construction services, use "PPh 4(2) Construction (B)" with 2.65% rate
  unless the SBU/SKK grade clearly indicates Small (1.75%) or
  Medium/Large (4%).
- For IT/management/consulting, default to "PPh 23" at 2%.

Output ONLY the JSON. No markdown fences.`;

const VAT_IN_OUT_PROMPT = `You are extracting Indonesian VAT (Faktur Pajak) entries for tax filing.

Read the attached document and return rows for BOTH output Faktur Keluaran and
input Faktur Masukan in a single list (use the "type" field to distinguish):

{
  "rows": [
    {
      "type": "OUTPUT" | "INPUT",
      "fakturNo": string,
      "counterpartyName": string,
      "counterpartyNpwp": string,
      "transactionDate": string,
      "dpp": number,
      "vat": number
    }, ...
  ]
}

Output ONLY the JSON. No markdown fences.`;

const CORP_TAX_INPUT_PROMPT = `Extract corporate tax inputs for a monthly PPh 25 / UMKM Final decision:

{
  "rows": [
    {
      "fieldName": "annualRevenue" | "monthlyRevenue" | "prevYearTax" |
                   "establishedYear" | "legalForm" | "npwpDate" | "manualNote",
      "value": number | string
    }, ...
  ]
}

Output ONLY the JSON.`;

const BANK_STATEMENT_PROMPT = `Extract debit/credit lines from this bank statement:

{
  "rows": [
    {
      "description": string,
      "type": "DEBIT" | "CREDIT",
      "transactionDate": string,
      "amount": number,
      "counterpartyName": string
    }, ...
  ]
}

Output ONLY the JSON.`;

const SLOT_PROMPTS: Record<string, string> = {
  PAYROLL: PAYROLL_PROMPT,
  WITHHOLDING_INVOICE: WITHHOLDING_INVOICE_PROMPT,
  VAT_IN_OUT: VAT_IN_OUT_PROMPT,
  CORP_TAX_INPUT: CORP_TAX_INPUT_PROMPT,
  BANK_STATEMENT: BANK_STATEMENT_PROMPT,
};

export function promptForSlot(slot: string): string | null {
  return SLOT_PROMPTS[slot] ?? null;
}
