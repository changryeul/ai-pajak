/**
 * PDF Processing for OCR
 *
 * Handles PDF documents by extracting pages and converting to images
 * for OCR processing.
 *
 * Note: For best OCR results, PDFs should be uploaded as images.
 * This processor attempts to extract text from PDF directly when possible.
 */

import { PDFDocument } from 'pdf-lib';
import Anthropic from '@anthropic-ai/sdk';
import { OCRResult, DocumentCategory } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Process a PDF document
 *
 * Strategy:
 * 1. Try to extract embedded text from PDF
 * 2. If PDF has images/scanned content, use base64 image approach
 * 3. For multi-page PDFs, process first page only (MVP)
 */
export async function processPDF(
  documentId: string,
  pdfBytes: ArrayBuffer,
  expectedCategory?: DocumentCategory
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      throw new Error('PDF has no pages');
    }

    // Get PDF info
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    // For now, we'll use Claude to analyze PDF content description
    // In production, this would convert PDF pages to images
    const result = await processPDFWithClaude(
      documentId,
      pdfBytes,
      pageCount,
      { width, height },
      expectedCategory
    );

    return result;
  } catch (error) {
    console.error('[PDF] Processing failed:', error);

    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'PDF processing failed',
    };
  }
}

/**
 * Process PDF using Claude's document understanding
 *
 * Note: This is a workaround until proper PDF-to-image conversion is implemented
 * Claude can understand PDF structure through text prompts
 */
async function processPDFWithClaude(
  documentId: string,
  pdfBytes: ArrayBuffer,
  pageCount: number,
  dimensions: { width: number; height: number },
  expectedCategory?: DocumentCategory
): Promise<OCRResult> {
  const startTime = Date.now();

  // Convert PDF to base64
  const base64 = Buffer.from(pdfBytes).toString('base64');

  try {
    // Use Claude with PDF as base64 data (document type)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are an expert at extracting data from Indonesian tax documents.

This is a PDF document with ${pageCount} page(s), dimensions: ${dimensions.width}x${dimensions.height} points.

Analyze this document and extract all relevant information. The document might be one of:
- Bukti Potong (Withholding Tax Slip) - PPh 21, 23, 26, or Final
- Faktur Pajak (Tax Invoice)
- Laporan Keuangan (Financial Statement)
- KTP (Indonesian ID Card)
- NPWP Card (Tax ID Card)
- SPT (Tax Return Form)
${expectedCategory ? `\nExpected document type: ${expectedCategory}` : ''}

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
    "withholdingTaxType": "PPh21/PPh23/PPh26/PPhFinal if applicable",
    "incomeType": "type of income if applicable",
    "fakturNumber": "XXX.XXX-XX.XXXXXXXX format if faktur",
    "dpp": numeric DPP amount if faktur,
    "ppn": numeric PPN amount if faktur,
    "nik": "16 digit NIK if ID document",
    "fullName": "person's full name",
    "birthDate": "YYYY-MM-DD if applicable",
    "address": "full address",
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

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      documentId,
      status: 'COMPLETED',
      category: parsed.category || 'UNKNOWN',
      confidence: parsed.confidence || 0.5,
      extractedData: parsed.extractedData || {},
      rawText: parsed.rawText || '',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    // If Claude doesn't support PDF directly, fall back to error message
    console.error('[PDF] Claude processing failed:', error);

    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage:
        'PDF processing requires image conversion. Please upload document as an image (JPEG, PNG) for best results.',
    };
  }
}

/**
 * Check if PDF is likely a scanned document (image-based)
 * vs a text-based PDF
 */
export async function isPDFScanned(pdfBytes: ArrayBuffer): Promise<boolean> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Check if PDF has embedded fonts (indicates text-based)
    // This is a heuristic - scanned PDFs typically have fewer fonts
    const fonts = pdfDoc.context.enumerateIndirectObjects().filter(([, obj]) => {
      return obj?.toString().includes('/Type /Font');
    });

    // If very few or no fonts, likely scanned
    return fonts.length < 2;
  } catch {
    // If we can't determine, assume it's scanned
    return true;
  }
}

/**
 * Get PDF page count
 */
export async function getPDFPageCount(pdfBytes: ArrayBuffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

/**
 * Extract text from PDF (if available)
 *
 * Note: pdf-lib doesn't support text extraction directly
 * This would require a more advanced library like pdf-parse
 */
export async function extractPDFText(pdfBytes: ArrayBuffer): Promise<string | null> {
  // pdf-lib doesn't support text extraction
  // In production, use pdf-parse or similar library
  console.warn('[PDF] Text extraction not implemented - use OCR for scanned documents');
  return null;
}
