import type { OCRResult } from '@/types';

/**
 * OCR Service - Document text extraction using AI
 * Supports Google Cloud Vision and OpenAI GPT-4 Vision
 */
export class OCRService {
  private static googleVisionApiKey = process.env.GOOGLE_CLOUD_API_KEY;
  private static openaiApiKey = process.env.OPENAI_API_KEY;

  /**
   * Extract text and data from an image using Google Cloud Vision
   */
  static async extractWithGoogleVision(imageBase64: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: imageBase64,
                },
                features: [
                  { type: 'TEXT_DETECTION' },
                  { type: 'DOCUMENT_TEXT_DETECTION' },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      const textAnnotations = data.responses?.[0]?.textAnnotations;
      const fullText = textAnnotations?.[0]?.description || '';

      return {
        success: true,
        document_type: this.detectDocumentType(fullText),
        confidence: this.calculateConfidence(data.responses?.[0]),
        extracted_data: this.parseExtractedText(fullText),
        raw_text: fullText,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Google Vision OCR error:', error);
      return {
        success: false,
        document_type: 'unknown',
        confidence: 0,
        extracted_data: {},
        raw_text: '',
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract text and structured data using OpenAI GPT-4 Vision
   */
  static async extractWithOpenAI(imageBase64: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert OCR and document analysis system specialized in Indonesian tax documents.
              Extract all relevant information from the document and return it in a structured JSON format.

              For tax documents, extract:
              - Document type (faktur pajak, bukti potong, SPT, etc.)
              - NPWP numbers
              - Names and addresses
              - Amounts and tax calculations
              - Dates
              - Transaction details

              Return the data in Indonesian field names where applicable.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this Indonesian tax document and extract all relevant information. Return the result as a JSON object.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Try to parse JSON from the response
      let extractedData = {};
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                          content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
      } catch {
        extractedData = { raw_response: content };
      }

      const documentType = (extractedData as Record<string, unknown>).document_type as string ||
                          this.detectDocumentType(content);

      return {
        success: true,
        document_type: documentType,
        confidence: 0.95, // GPT-4 Vision generally high confidence
        extracted_data: extractedData,
        raw_text: content,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('OpenAI Vision OCR error:', error);
      return {
        success: false,
        document_type: 'unknown',
        confidence: 0,
        extracted_data: {},
        raw_text: '',
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Smart extraction using multiple providers
   */
  static async extractSmart(imageBase64: string): Promise<OCRResult> {
    // Use OpenAI for structured extraction, fall back to Google Vision
    const openaiResult = await this.extractWithOpenAI(imageBase64);

    if (openaiResult.success && openaiResult.confidence > 0.8) {
      return openaiResult;
    }

    // Fall back to Google Vision
    const googleResult = await this.extractWithGoogleVision(imageBase64);

    if (googleResult.success) {
      return googleResult;
    }

    return openaiResult; // Return OpenAI result even if less confident
  }

  /**
   * Detect document type from text content
   */
  private static detectDocumentType(text: string): string {
    const textLower = text.toLowerCase();

    if (textLower.includes('faktur pajak')) return 'faktur_pajak';
    if (textLower.includes('bukti potong') || textLower.includes('bukti pemotongan')) {
      if (textLower.includes('pph 21') || textLower.includes('pasal 21')) return 'bukti_potong_pph21';
      if (textLower.includes('pph 23') || textLower.includes('pasal 23')) return 'bukti_potong_pph23';
      return 'bukti_potong';
    }
    if (textLower.includes('spt tahunan')) return 'spt_tahunan';
    if (textLower.includes('slip gaji') || textLower.includes('payslip')) return 'slip_gaji';
    if (textLower.includes('invoice') || textLower.includes('tagihan')) return 'invoice';
    if (textLower.includes('npwp')) return 'kartu_npwp';

    return 'unknown';
  }

  /**
   * Calculate confidence score from API response
   */
  private static calculateConfidence(response: Record<string, unknown>): number {
    if (!response) return 0;

    const fullTextAnnotation = response.fullTextAnnotation as Record<string, unknown>;
    if (fullTextAnnotation?.pages) {
      const pages = fullTextAnnotation.pages as Array<{ confidence?: number }>;
      const avgConfidence = pages.reduce((sum: number, page) => {
        return sum + (page.confidence || 0);
      }, 0) / pages.length;
      return avgConfidence;
    }

    return 0.85; // Default confidence if not available
  }

  /**
   * Parse extracted text into structured data
   */
  private static parseExtractedText(text: string): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Extract NPWP (format: XX.XXX.XXX.X-XXX.XXX)
    const npwpMatch = text.match(/\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}/);
    if (npwpMatch) data.npwp = npwpMatch[0];

    // Extract amounts (Indonesian format: Rp X.XXX.XXX)
    const amountMatches = text.match(/Rp\.?\s*[\d.,]+/g);
    if (amountMatches) {
      data.amounts = amountMatches.map((a) =>
        parseFloat(a.replace(/[Rp.\s]/g, '').replace(',', '.'))
      );
    }

    // Extract dates (DD/MM/YYYY or DD-MM-YYYY)
    const dateMatches = text.match(/\d{2}[/-]\d{2}[/-]\d{4}/g);
    if (dateMatches) data.dates = dateMatches;

    // Extract NIK (16 digits)
    const nikMatch = text.match(/\b\d{16}\b/);
    if (nikMatch) data.nik = nikMatch[0];

    return data;
  }

  /**
   * Convert file to base64
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }
}
