/**
 * OCR Document Processor
 *
 * Processes uploaded documents using AI-powered OCR
 * Extracts structured data from Indonesian tax documents
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  OCRResult,
  OCRStatus,
  DocumentCategory,
  ExtractedData,
  DOCUMENT_KEYWORDS,
  TAX_PATTERNS,
} from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Process a document image/PDF and extract structured data
 */
export async function processDocument(
  documentId: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  expectedCategory?: DocumentCategory
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // Use Claude's vision capabilities for OCR
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
              text: `You are an expert at extracting data from Indonesian tax documents.

Analyze this document image and extract all relevant information. The document might be one of:
- Bukti Potong (Withholding Tax Slip) - PPh 21, 23, 26, or Final
- Faktur Pajak (Tax Invoice)
- Laporan Keuangan (Financial Statement)
- KTP (Indonesian ID Card)
- NPWP Card (Tax ID Card)
- SPT (Tax Return Form)

Please respond with a JSON object containing:
{
  "category": "BUKTI_POTONG" | "FAKTUR_PAJAK" | "LAPORAN_KEUANGAN" | "KTP" | "NPWP_CARD" | "SPT" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "rawText": "all text visible in the document",
  "extractedData": {
    "documentNumber": "if applicable",
    "documentDate": "YYYY-MM-DD format if found",
    "npwp": "XX.XXX.XXX.X-XXX.XXX format if found",
    "taxAmount": numeric value if found,
    "grossAmount": numeric value if found,
    "taxRate": percentage as decimal if found,
    "entityName": "company or person name",
    "entityAddress": "address if found",
    "taxPeriod": "YYYY-MM format if applicable",
    "taxYear": numeric year,
    // For Bukti Potong
    "withholdingTaxType": "PPh21/PPh23/PPh26/PPhFinal",
    "incomeType": "type of income",
    // For Faktur Pajak
    "fakturNumber": "XXX.XXX-XX.XXXXXXXX format",
    "dpp": numeric DPP amount,
    "ppn": numeric PPN amount,
    // For KTP/NPWP
    "nik": "16 digit NIK",
    "fullName": "person's full name",
    "birthDate": "YYYY-MM-DD",
    "address": "full address",
    // Any other fields
    "additionalFields": { "key": "value" }
  }
}

Important:
- Extract ALL visible numbers, especially monetary amounts
- Format NPWP as XX.XXX.XXX.X-XXX.XXX
- Convert Indonesian currency to numeric (e.g., "Rp 1.000.000" → 1000000)
- If unsure about a field, omit it rather than guess
- Set confidence based on document clarity and extraction certainty`,
            },
          ],
        },
      ],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from OCR response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      category: DocumentCategory;
      confidence: number;
      rawText: string;
      extractedData: ExtractedData;
    };

    // Validate and enhance category if expected category was provided
    let finalCategory = parsed.category;
    if (expectedCategory && expectedCategory !== 'UNKNOWN') {
      // Use expected category if confidence is low
      if (parsed.confidence < 0.7) {
        finalCategory = expectedCategory;
      }
    }

    // Post-process extracted data
    const processedData = postProcessExtractedData(parsed.extractedData);

    return {
      documentId,
      status: 'COMPLETED',
      category: finalCategory,
      confidence: parsed.confidence,
      extractedData: processedData,
      rawText: parsed.rawText,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[OCR] Processing failed:', error);

    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Classify document based on text content
 */
export function classifyDocument(text: string): {
  category: DocumentCategory;
  confidence: number;
} {
  const lowerText = text.toLowerCase();
  const scores: Record<DocumentCategory, number> = {
    BUKTI_POTONG: 0,
    FAKTUR_PAJAK: 0,
    LAPORAN_KEUANGAN: 0,
    KTP: 0,
    NPWP_CARD: 0,
    SPT: 0,
    UNKNOWN: 0,
  };

  // Count keyword matches
  for (const [category, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category as DocumentCategory] += 1;
      }
    }
  }

  // Find category with highest score
  let maxScore = 0;
  let bestCategory: DocumentCategory = 'UNKNOWN';

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category as DocumentCategory;
    }
  }

  // Calculate confidence
  const totalKeywords = Object.values(DOCUMENT_KEYWORDS).flat().length;
  const confidence = maxScore > 0 ? Math.min(maxScore / 3, 1) : 0;

  return {
    category: bestCategory,
    confidence,
  };
}

/**
 * Post-process and validate extracted data
 */
function postProcessExtractedData(data: ExtractedData): ExtractedData {
  const processed = { ...data };

  // Validate and format NPWP
  if (processed.npwp) {
    const npwpDigits = processed.npwp.replace(/\D/g, '');
    if (npwpDigits.length === 15) {
      processed.npwp = npwpDigits.replace(
        /(\d{2})(\d{3})(\d{3})(\d{1})(\d{3})(\d{3})/,
        '$1.$2.$3.$4-$5.$6'
      );
    }
  }

  // Validate NIK
  if (processed.nik) {
    const nikDigits = processed.nik.replace(/\D/g, '');
    if (nikDigits.length === 16) {
      processed.nik = nikDigits;
    } else {
      delete processed.nik;
    }
  }

  // Validate Faktur number
  if (processed.fakturNumber) {
    const match = processed.fakturNumber.match(/\d{3}[\.-]\d{3}[\.-]\d{2}[\.-]\d{8}/);
    if (match) {
      processed.fakturNumber = match[0].replace(/[.-]/g, (m, i) =>
        i === 3 || i === 7 ? '.' : '-'
      );
    }
  }

  // Ensure numeric values are numbers
  if (processed.taxAmount && typeof processed.taxAmount === 'string') {
    processed.taxAmount = parseIndonesianNumber(processed.taxAmount);
  }
  if (processed.grossAmount && typeof processed.grossAmount === 'string') {
    processed.grossAmount = parseIndonesianNumber(processed.grossAmount);
  }
  if (processed.dpp && typeof processed.dpp === 'string') {
    processed.dpp = parseIndonesianNumber(processed.dpp);
  }
  if (processed.ppn && typeof processed.ppn === 'string') {
    processed.ppn = parseIndonesianNumber(processed.ppn);
  }

  return processed;
}

/**
 * Parse Indonesian number format to numeric value
 * e.g., "Rp 1.234.567" → 1234567
 */
function parseIndonesianNumber(value: string): number {
  // Remove currency symbol and whitespace
  let cleaned = value.replace(/Rp\.?\s*/gi, '').trim();

  // Indonesian format uses dots for thousands, comma for decimal
  // e.g., 1.234.567,89
  if (cleaned.includes(',')) {
    // Has decimal part
    const [whole, decimal] = cleaned.split(',');
    cleaned = whole.replace(/\./g, '') + '.' + decimal;
  } else {
    // No decimal, just remove dots
    cleaned = cleaned.replace(/\./g, '');
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Extract NPWP from text using regex
 */
export function extractNPWP(text: string): string | null {
  const match = text.match(TAX_PATTERNS.NPWP);
  return match ? match[0] : null;
}

/**
 * Extract Faktur number from text
 */
export function extractFakturNumber(text: string): string | null {
  const match = text.match(TAX_PATTERNS.FAKTUR_NUMBER);
  return match ? match[0] : null;
}

/**
 * Extract all currency amounts from text
 */
export function extractCurrencyAmounts(text: string): number[] {
  const matches = text.match(TAX_PATTERNS.CURRENCY_IDR) || [];
  return matches.map(parseIndonesianNumber).filter((n) => n > 0);
}
