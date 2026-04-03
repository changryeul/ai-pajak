import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { processForm1721A1 } from '@/lib/ocr/form-1721-a1';
import { processDocument } from '@/lib/ocr/processor';
import { processReceipt } from '@/lib/ocr/receipt-processor';
import type { DocumentCategory, OCRResult } from '@/lib/ocr/types';
import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

/**
 * POST /api/documents/ocr-extract
 *
 * Directly process a file with OCR without storing to database.
 * Used for SPT auto-fill flow where immediate results are needed.
 *
 * Input: FormData with file + expectedCategory
 * Output: OCR result with extracted data
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const rateCheck = await checkRateLimit(user.id, 'ocr');
    if (!rateCheck.allowed) {
      return NextResponse.json(rateLimitResponse(rateCheck, 'OCR'), { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const expectedCategory = formData.get('expectedCategory') as string | undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or PDF.' },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum 10MB.' },
        { status: 400 }
      );
    }

    const documentId = crypto.randomUUID();

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    let result;

    if (file.type === 'application/pdf') {
      if (expectedCategory === 'RECEIPT') {
        result = await processReceipt(documentId, base64, 'application/pdf');
      } else {
        result = await processPDFAs1721A1(documentId, arrayBuffer, expectedCategory as DocumentCategory | undefined);
      }
    } else if (expectedCategory === 'RECEIPT') {
      // Receipt OCR
      result = await processReceipt(documentId, base64, file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif');
    } else if (expectedCategory === 'BUKTI_POTONG') {
      // Use specialized 1721-A1 processor
      result = await processForm1721A1(
        documentId,
        base64,
        file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      );
    } else {
      // General OCR
      result = await processDocument(
        documentId,
        base64,
        file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        expectedCategory as DocumentCategory | undefined
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    loggers.ocr.error({ err: error }, 'OCR extract error');
    return NextResponse.json(
      {
        error: 'OCR processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Process PDF document using Claude's native PDF support
 */
async function processPDFAs1721A1(
  documentId: string,
  pdfBytes: ArrayBuffer,
  expectedCategory?: DocumentCategory
): Promise<OCRResult> {
  const startTime = Date.now();
  const base64 = Buffer.from(pdfBytes).toString('base64');

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const isBuktiPotong = expectedCategory === 'BUKTI_POTONG';

  const extractionPrompt = isBuktiPotong
    ? `You are an expert at extracting data from Indonesian tax Form 1721-A1 (Bukti Potong PPh Pasal 21).

Please extract ALL fields and respond with a JSON object:

{
  "confidence": 0.0-1.0,
  "rawText": "all visible text",
  "employerNpwp": "XX.XXX.XXX.X-XXX.XXX format",
  "employerName": "Employer name",
  "employerAddress": "Employer address",
  "employeeNpwp": "XX.XXX.XXX.X-XXX.XXX format",
  "employeeNik": "16 digit NIK",
  "employeeName": "Employee name",
  "employeeAddress": "Employee address",
  "employeeStatus": "TK/0, K/1, K/2, K/3, etc.",
  "penghasilanBruto": numeric gross income,
  "biayaJabatan": numeric position costs,
  "iuranPensiun": numeric pension contribution,
  "penghasilanNeto": numeric net income,
  "ptkp": numeric PTKP amount,
  "pkp": numeric taxable income,
  "pphTerutang": numeric tax due,
  "pphDipotong": numeric tax withheld,
  "masaPajakAwal": "MM" format start month,
  "masaPajakAkhir": "MM" format end month,
  "tahunPajak": numeric year,
  "nomorBuktiPotong": "Bukti Potong number",
  "tanggalBuktiPotong": "YYYY-MM-DD format"
}

Rules:
1. NPWP format: XX.XXX.XXX.X-XXX.XXX
2. Convert "Rp 50.000.000" to 50000000
3. Extract PTKP status: TK/0, K/0, K/1, K/2, K/3, K/I/0 etc.
4. pphDipotong is the final tax withheld amount`
    : `You are an expert at extracting data from Indonesian tax documents.
Analyze this document and extract all relevant data as JSON with fields:
category, confidence, rawText, extractedData (with documentNumber, npwp, taxAmount, grossAmount, entityName, taxYear, etc.)`;

  try {
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
            { type: 'text', text: extractionPrompt },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (isBuktiPotong) {
      // Map 1721-A1 fields to standard extractedData format
      return {
        documentId,
        status: 'COMPLETED',
        category: 'BUKTI_POTONG',
        confidence: parsed.confidence || 0.8,
        extractedData: {
          ...parsed,
          npwp: parsed.employeeNpwp,
          nik: parsed.employeeNik,
          fullName: parsed.employeeName,
          address: parsed.employeeAddress,
          taxAmount: parsed.pphDipotong,
          grossAmount: parsed.penghasilanBruto,
          taxYear: parsed.tahunPajak,
          withholdingTaxType: 'PPh21',
          documentNumber: parsed.nomorBuktiPotong,
          documentDate: parsed.tanggalBuktiPotong,
        },
        rawText: parsed.rawText || '',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      documentId,
      status: 'COMPLETED',
      category: parsed.category || 'UNKNOWN',
      confidence: parsed.confidence || 0.5,
      extractedData: parsed.extractedData || parsed,
      rawText: parsed.rawText || '',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    loggers.ocr.error({ err: error }, 'PDF OCR processing failed');
    return {
      documentId,
      status: 'FAILED',
      category: 'UNKNOWN',
      confidence: 0,
      extractedData: {},
      rawText: '',
      processingTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'PDF OCR failed',
    };
  }
}
