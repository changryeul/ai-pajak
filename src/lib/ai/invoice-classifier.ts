/**
 * Invoice Classifier — AI-powered invoice analysis
 *
 * Analyzes invoice images/PDFs using Claude Vision to extract:
 * - Service type (PMK 141/2015 classification)
 * - Transaction amount (DPP)
 * - Counterparty info (name, NPWP)
 * - Recommended PPh type + rate via Resolution Engine
 */

import Anthropic from '@anthropic-ai/sdk';
import { logAIUsage } from './usage-tracker';

export interface InvoiceClassification {
  /** Detected service category */
  serviceCategory: string;
  /** PMK 141/2015 service code (for PPh 23) */
  serviceCode?: string;
  /** Counterparty name */
  counterpartyName: string;
  /** Counterparty NPWP if visible */
  counterpartyNpwp?: string;
  /** Gross amount (DPP) */
  grossAmount: number;
  /** PPN amount if visible */
  ppnAmount?: number;
  /** Invoice number */
  invoiceNumber?: string;
  /** Invoice date */
  invoiceDate?: string;
  /** Description */
  description: string;
  /** AI confidence (0-1) */
  confidence: number;
  /** Raw AI reasoning */
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an Indonesian tax document analyzer. Analyze the invoice/receipt image and extract the following information in JSON format:

{
  "serviceCategory": "SERVICE|CONSTRUCTION|RENTAL|DIVIDEND|INTEREST|ROYALTY|IMPORT|SHIPPING|OTHER",
  "serviceCode": "e-Bupot code if identifiable (e.g., JASA_KONSULTAN, JASA_TEKNIK, JASA_KEBERSIHAN)",
  "counterpartyName": "company or person name on the invoice",
  "counterpartyNpwp": "NPWP number if visible (format: XX.XXX.XXX.X-XXX.XXX)",
  "grossAmount": number (amount before tax, in Rupiah),
  "ppnAmount": number or null (PPN/VAT amount if shown),
  "invoiceNumber": "invoice number if visible",
  "invoiceDate": "YYYY-MM-DD if visible",
  "description": "brief description of service/goods",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of classification"
}

Rules:
- grossAmount should be the DPP (Dasar Pengenaan Pajak), NOT the total including tax
- serviceCategory should match Indonesian withholding tax categories
- serviceCode should match PMK 141/2015 jasa lain codes if applicable
- If you can't determine a field, use null
- Always provide confidence score based on document clarity
- For construction services, also note if SBU/qualification info is visible

Respond ONLY with the JSON object, no markdown or explanation.`;

export class InvoiceClassifier {
  private static client: Anthropic | null = null;

  private static getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic();
    }
    return this.client;
  }

  /**
   * Classify an invoice from base64 image
   */
  static async classify(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<InvoiceClassification> {
    const client = this.getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyze this Indonesian invoice/receipt and extract the data as specified.',
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Log AI usage
    await logAIUsage({
      feature: 'INVOICE_CLASSIFY',
      model: 'claude-sonnet-4-20250514',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }).catch(() => {});

    try {
      const parsed = JSON.parse(text);
      return {
        serviceCategory: parsed.serviceCategory || 'SERVICE',
        serviceCode: parsed.serviceCode || undefined,
        counterpartyName: parsed.counterpartyName || 'Unknown',
        counterpartyNpwp: parsed.counterpartyNpwp || undefined,
        grossAmount: parsed.grossAmount || 0,
        ppnAmount: parsed.ppnAmount || undefined,
        invoiceNumber: parsed.invoiceNumber || undefined,
        invoiceDate: parsed.invoiceDate || undefined,
        description: parsed.description || '',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return {
        serviceCategory: 'SERVICE',
        counterpartyName: 'Unknown',
        grossAmount: 0,
        description: 'Failed to parse AI response',
        confidence: 0,
        reasoning: text,
      };
    }
  }
}
