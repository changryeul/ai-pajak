import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an Indonesian NPWP card reader. Analyze the image and extract:
{
  "npwp": "XX.XXX.XXX.X-XXX.XXX format",
  "name": "taxpayer name as printed",
  "nik": "NIK number if visible (16 digits)",
  "address": "full address if visible",
  "registrationDate": "registration date if visible (YYYY-MM-DD)",
  "taxOffice": "KPP name if visible",
  "confidence": 0.0 to 1.0
}
Respond ONLY with JSON. If a field is not visible, use null.`;

/**
 * POST /api/customer/npwp-ocr
 *
 * Upload NPWP card photo → AI extracts NPWP number, name, address
 */
async function handleNpwpOcr(req: RequestWithSession): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Use JPEG, PNG, or WebP' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File must be under 10MB' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: file.type as 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Extract NPWP data from this card.' },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const parsed = JSON.parse(text);
      loggers.api.info({ npwp: parsed.npwp, confidence: parsed.confidence }, 'NPWP OCR completed');

      return Response.json({
        success: true,
        data: {
          npwp: parsed.npwp || null,
          name: parsed.name || null,
          nik: parsed.nik || null,
          address: parsed.address || null,
          registrationDate: parsed.registrationDate || null,
          taxOffice: parsed.taxOffice || null,
          confidence: parsed.confidence || 0,
        },
      });
    } catch {
      return Response.json({
        success: true,
        data: { npwp: null, name: null, nik: null, address: null, registrationDate: null, taxOffice: null, confidence: 0 },
        rawText: text,
      });
    }
  } catch (error) {
    loggers.api.error({ err: error }, 'NPWP OCR error');
    return Response.json({ error: 'NPWP OCR failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return customerOperation('NPWP_OCR')(request as RequestWithSession, handleNpwpOcr);
}
