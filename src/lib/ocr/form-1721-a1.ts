/**
 * Form 1721-A1 OCR Processor
 *
 * Specialized extraction for Indonesian Bukti Potong PPh 21
 * (Employee Withholding Tax Slip)
 *
 * Form 1721-A1 Fields:
 * - NPWP Pemotong (Employer Tax ID)
 * - Nama Pemotong (Employer Name)
 * - NPWP Dipotong (Employee Tax ID)
 * - NIK (National ID)
 * - Nama Dipotong (Employee Name)
 * - Alamat (Address)
 * - Penghasilan Bruto (Gross Income)
 * - PPh yang Dipotong (Tax Withheld)
 * - Masa Pajak (Tax Period)
 * - Tahun Pajak (Tax Year)
 */

import Anthropic from '@anthropic-ai/sdk';
import { OCRResult, ExtractedData } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Form1721A1Data extends ExtractedData {
  // Employer (Pemotong) info
  employerNpwp?: string;
  employerName?: string;
  employerAddress?: string;

  // Employee (Dipotong) info
  employeeNpwp?: string;
  employeeNik?: string;
  employeeName?: string;
  employeeAddress?: string;
  employeeStatus?: string; // TK/0, K/1, K/2, K/3, etc.

  // Income breakdown
  penghasilanBruto?: number; // Gross income
  biayaJabatan?: number; // Position costs (max 5% of gross, max Rp 6M/year)
  iuranPensiun?: number; // Pension contribution
  penghasilanNeto?: number; // Net income

  // Tax calculation
  ptkp?: number; // Non-taxable income (PTKP)
  pkp?: number; // Taxable income (PKP)
  pphTerutang?: number; // Tax due
  pphDipotong?: number; // Tax withheld

  // Period info
  masaPajakAwal?: string; // Start month (MM)
  masaPajakAkhir?: string; // End month (MM)
  tahunPajak?: number; // Tax year

  // Document metadata
  nomorBuktiPotong?: string; // Withholding slip number
  tanggalBuktiPotong?: string; // Date issued
}

/**
 * Process Form 1721-A1 document
 */
export async function processForm1721A1(
  documentId: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `You are an expert at extracting data from Indonesian tax Form 1721-A1 (Bukti Potong PPh Pasal 21).

This is a Bukti Potong (Withholding Tax Slip) for employee income tax (PPh 21).

Please extract ALL fields and respond with a JSON object:

{
  "confidence": 0.0-1.0,
  "rawText": "all visible text",

  "employerNpwp": "XX.XXX.XXX.X-XXX.XXX format - NPWP Pemotong",
  "employerName": "Nama Pemotong/Employer name",
  "employerAddress": "Alamat Pemotong",

  "employeeNpwp": "XX.XXX.XXX.X-XXX.XXX format - NPWP Dipotong",
  "employeeNik": "16 digit NIK",
  "employeeName": "Nama Dipotong/Employee name",
  "employeeAddress": "Alamat Dipotong",
  "employeeStatus": "TK/0, K/1, K/2, K/3, etc. - Status PTKP",

  "penghasilanBruto": numeric gross income,
  "biayaJabatan": numeric position costs,
  "iuranPensiun": numeric pension contribution,
  "penghasilanNeto": numeric net income,

  "ptkp": numeric PTKP amount,
  "pkp": numeric PKP (taxable income),
  "pphTerutang": numeric tax due,
  "pphDipotong": numeric tax withheld (this is the main tax amount),

  "masaPajakAwal": "MM" format - start month (e.g., "01"),
  "masaPajakAkhir": "MM" format - end month (e.g., "12"),
  "tahunPajak": numeric year (e.g., 2024),

  "nomorBuktiPotong": "Bukti Potong number (e.g., 1.1-MM.YY-XXXXXXX)",
  "tanggalBuktiPotong": "YYYY-MM-DD format"
}

Important extraction rules:
1. NPWP format: XX.XXX.XXX.X-XXX.XXX (15 digits with separators)
2. NIK: 16 digits, no separators
3. Convert Indonesian currency format to numbers (e.g., "Rp 50.000.000" → 50000000)
4. For decimals, Indonesian uses comma (e.g., "5,5%" → 0.055)
5. Tax period format: if "Januari s.d. Desember 2024", extract as masaPajakAwal: "01", masaPajakAkhir: "12", tahunPajak: 2024
6. Look for PTKP status codes: TK/0 (single), K/0, K/1, K/2, K/3 (married + dependents)
7. pphDipotong is the final tax withheld amount - this is the most important number

If any field is unclear or not present, omit it from the response.
Set confidence based on document clarity and how many fields were successfully extracted.`,
            },
          ],
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from OCR response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Form1721A1Data & {
      confidence: number;
      rawText: string;
    };

    // Post-process and validate
    const processedData = postProcessForm1721A1(parsed);

    return {
      documentId,
      status: 'COMPLETED',
      category: 'BUKTI_POTONG',
      confidence: parsed.confidence,
      extractedData: processedData,
      rawText: parsed.rawText || '',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[OCR] Form 1721-A1 processing failed:', error);

    return {
      documentId,
      status: 'FAILED',
      category: 'BUKTI_POTONG',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate and post-process Form 1721-A1 data
 */
function postProcessForm1721A1(data: Form1721A1Data): Form1721A1Data {
  const processed = { ...data };

  // Validate and format NPWPs
  if (processed.employerNpwp) {
    processed.employerNpwp = formatNPWP(processed.employerNpwp);
  }
  if (processed.employeeNpwp) {
    processed.employeeNpwp = formatNPWP(processed.employeeNpwp);
  }

  // Validate NIK (16 digits)
  if (processed.employeeNik) {
    const nikDigits = processed.employeeNik.replace(/\D/g, '');
    if (nikDigits.length === 16) {
      processed.employeeNik = nikDigits;
    } else {
      delete processed.employeeNik;
    }
  }

  // Ensure numeric values
  const numericFields: (keyof Form1721A1Data)[] = [
    'penghasilanBruto',
    'biayaJabatan',
    'iuranPensiun',
    'penghasilanNeto',
    'ptkp',
    'pkp',
    'pphTerutang',
    'pphDipotong',
    'tahunPajak',
  ];

  for (const field of numericFields) {
    if (processed[field] !== undefined) {
      const value = processed[field];
      if (typeof value === 'string') {
        (processed as Record<string, unknown>)[field] = parseIndonesianNumber(value);
      }
    }
  }

  // Validate tax year
  if (processed.tahunPajak) {
    const year = Number(processed.tahunPajak);
    if (year < 2000 || year > 2100) {
      delete processed.tahunPajak;
    }
  }

  // Validate tax period months
  if (processed.masaPajakAwal) {
    const month = parseInt(processed.masaPajakAwal, 10);
    if (month < 1 || month > 12) {
      delete processed.masaPajakAwal;
    } else {
      processed.masaPajakAwal = month.toString().padStart(2, '0');
    }
  }
  if (processed.masaPajakAkhir) {
    const month = parseInt(processed.masaPajakAkhir, 10);
    if (month < 1 || month > 12) {
      delete processed.masaPajakAkhir;
    } else {
      processed.masaPajakAkhir = month.toString().padStart(2, '0');
    }
  }

  // Validate PTKP status
  const validPTKPStatus = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3', 'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3'];
  if (processed.employeeStatus && !validPTKPStatus.includes(processed.employeeStatus.toUpperCase())) {
    delete processed.employeeStatus;
  } else if (processed.employeeStatus) {
    processed.employeeStatus = processed.employeeStatus.toUpperCase();
  }

  // Calculate missing fields if possible
  if (processed.penghasilanBruto && processed.penghasilanNeto === undefined) {
    // Net = Gross - Position costs - Pension
    const biaya = processed.biayaJabatan || 0;
    const pensiun = processed.iuranPensiun || 0;
    processed.penghasilanNeto = processed.penghasilanBruto - biaya - pensiun;
  }

  if (processed.penghasilanNeto && processed.ptkp && processed.pkp === undefined) {
    // PKP = Net - PTKP
    const pkp = processed.penghasilanNeto - processed.ptkp;
    processed.pkp = Math.max(0, pkp);
  }

  // Map to standard ExtractedData fields
  processed.npwp = processed.employeeNpwp;
  processed.nik = processed.employeeNik;
  processed.fullName = processed.employeeName;
  processed.address = processed.employeeAddress;
  processed.taxAmount = processed.pphDipotong;
  processed.grossAmount = processed.penghasilanBruto;
  processed.taxYear = processed.tahunPajak;
  processed.withholdingTaxType = 'PPh21';
  processed.documentNumber = processed.nomorBuktiPotong;
  processed.documentDate = processed.tanggalBuktiPotong;

  // Set tax period if available
  if (processed.masaPajakAkhir && processed.tahunPajak) {
    processed.taxPeriod = `${processed.tahunPajak}-${processed.masaPajakAkhir}`;
  }

  return processed;
}

/**
 * Format NPWP to standard format
 */
function formatNPWP(npwp: string): string {
  const digits = npwp.replace(/\D/g, '');
  if (digits.length === 15) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{1})(\d{3})(\d{3})/,
      '$1.$2.$3.$4-$5.$6'
    );
  }
  return npwp;
}

/**
 * Parse Indonesian number format
 */
function parseIndonesianNumber(value: string): number {
  // Remove currency symbol and whitespace
  let cleaned = value.replace(/Rp\.?\s*/gi, '').trim();

  // Indonesian uses dots for thousands, comma for decimal
  if (cleaned.includes(',')) {
    const [whole, decimal] = cleaned.split(',');
    cleaned = whole.replace(/\./g, '') + '.' + decimal;
  } else {
    cleaned = cleaned.replace(/\./g, '');
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Calculate PTKP based on status
 * PTKP 2024 rates
 */
export function calculatePTKP(status: string): number {
  const ptkpRates: Record<string, number> = {
    'TK/0': 54_000_000, // Single
    'TK/1': 58_500_000, // Single + 1 dependent
    'TK/2': 63_000_000, // Single + 2 dependents
    'TK/3': 67_500_000, // Single + 3 dependents
    'K/0': 58_500_000, // Married
    'K/1': 63_000_000, // Married + 1 dependent
    'K/2': 67_500_000, // Married + 2 dependents
    'K/3': 72_000_000, // Married + 3 dependents
    'K/I/0': 112_500_000, // Married + spouse income combined
    'K/I/1': 117_000_000,
    'K/I/2': 121_500_000,
    'K/I/3': 126_000_000,
  };

  return ptkpRates[status.toUpperCase()] || 54_000_000;
}

/**
 * Calculate PPh 21 from PKP
 * Progressive tax rates (2024)
 */
export function calculatePPh21(pkp: number): number {
  if (pkp <= 0) return 0;

  // Progressive rates
  const brackets = [
    { limit: 60_000_000, rate: 0.05 },
    { limit: 250_000_000, rate: 0.15 },
    { limit: 500_000_000, rate: 0.25 },
    { limit: 5_000_000_000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];

  let tax = 0;
  let remaining = pkp;
  let previousLimit = 0;

  for (const bracket of brackets) {
    const taxableInBracket = Math.min(remaining, bracket.limit - previousLimit);
    if (taxableInBracket <= 0) break;

    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
    previousLimit = bracket.limit;
  }

  return Math.round(tax);
}

/**
 * Validate Form 1721-A1 data completeness
 */
export function validateForm1721A1(data: Form1721A1Data): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const requiredFields: (keyof Form1721A1Data)[] = [
    'employerNpwp',
    'employerName',
    'employeeNpwp',
    'employeeName',
    'penghasilanBruto',
    'pphDipotong',
    'tahunPajak',
  ];

  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  }

  // Validation checks
  if (data.penghasilanBruto && data.pphDipotong) {
    const effectiveRate = data.pphDipotong / data.penghasilanBruto;
    if (effectiveRate > 0.35) {
      warnings.push('Effective tax rate exceeds maximum (35%)');
    }
    if (effectiveRate < 0.01 && data.penghasilanBruto > 60_000_000) {
      warnings.push('Effective tax rate seems too low');
    }
  }

  if (data.biayaJabatan && data.penghasilanBruto) {
    const maxBiayaJabatan = Math.min(data.penghasilanBruto * 0.05, 6_000_000);
    if (data.biayaJabatan > maxBiayaJabatan) {
      warnings.push('Position costs exceed maximum (5% of gross or Rp 6M)');
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
