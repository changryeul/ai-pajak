/**
 * Receipt OCR Processor
 *
 * Specialized extraction for receipts, invoices, and expense documents.
 * Used for UMKM expense tracking (Year 4+ transition from PPh Final to progressive).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { OCRResult } from './types';

export interface ReceiptData {
  // Merchant info
  merchantName?: string;
  merchantAddress?: string;
  merchantNpwp?: string;
  merchantPhone?: string;

  // Transaction
  receiptNumber?: string;
  receiptDate?: string; // YYYY-MM-DD
  paymentMethod?: string; // CASH, DEBIT, CREDIT, QRIS, TRANSFER

  // Items
  items: ReceiptItem[];

  // Totals
  subtotal?: number;
  discount?: number;
  taxAmount?: number; // PPN if applicable
  serviceCharge?: number;
  total: number;

  // Category
  expenseCategory: ExpenseCategory;

  // Raw
  currency: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type ExpenseCategory =
  | 'INVENTORY'       // Pembelian barang dagangan
  | 'SUPPLIES'        // Perlengkapan kantor
  | 'RENT'            // Sewa
  | 'UTILITIES'       // Listrik, air, internet
  | 'TRANSPORT'       // Transportasi
  | 'MEALS'           // Makan/minum usaha
  | 'MARKETING'       // Iklan, promosi
  | 'MAINTENANCE'     // Pemeliharaan
  | 'PROFESSIONAL'    // Jasa profesional
  | 'INSURANCE'       // Asuransi
  | 'OTHER';

/**
 * Process a receipt image/PDF using Claude Vision
 */
export async function processReceipt(
  documentId: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<OCRResult> {
  const startTime = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const contentBlock = mediaType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: `You are an expert at extracting data from Indonesian receipts, invoices, and expense documents.

Extract ALL information and respond with a JSON object:

{
  "confidence": 0.0-1.0,
  "rawText": "all visible text",
  "merchantName": "store/company name",
  "merchantAddress": "address if visible",
  "merchantNpwp": "XX.XXX.XXX.X-XXX.XXX if visible",
  "merchantPhone": "phone number if visible",
  "receiptNumber": "receipt/invoice number",
  "receiptDate": "YYYY-MM-DD",
  "paymentMethod": "CASH/DEBIT/CREDIT/QRIS/TRANSFER",
  "items": [
    { "name": "item name", "quantity": 1, "unitPrice": 10000, "amount": 10000 }
  ],
  "subtotal": numeric,
  "discount": numeric or 0,
  "taxAmount": numeric (PPN if shown),
  "serviceCharge": numeric or 0,
  "total": numeric (final amount paid),
  "expenseCategory": "INVENTORY|SUPPLIES|RENT|UTILITIES|TRANSPORT|MEALS|MARKETING|MAINTENANCE|PROFESSIONAL|INSURANCE|OTHER",
  "currency": "IDR"
}

Rules:
1. Convert Indonesian format: "Rp 50.000" → 50000, "1.234.567" → 1234567
2. Determine expenseCategory from merchant type and items
3. If PPN/tax line exists, extract taxAmount separately
4. receiptDate in YYYY-MM-DD format
5. items array should list individual items if visible
6. If receipt is unclear, set lower confidence`,
          },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON');

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      documentId,
      status: 'COMPLETED',
      category: 'LAPORAN_KEUANGAN', // Receipts fall under financial docs
      confidence: parsed.confidence || 0.7,
      extractedData: {
        ...parsed,
        documentType: 'RECEIPT',
        entityName: parsed.merchantName,
        documentNumber: parsed.receiptNumber,
        documentDate: parsed.receiptDate,
        grossAmount: parsed.total,
        taxAmount: parsed.taxAmount,
      },
      rawText: parsed.rawText || '',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Receipt OCR failed',
    };
  }
}
