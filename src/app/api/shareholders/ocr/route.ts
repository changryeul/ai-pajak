import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/shareholders/ocr
 *
 * Upload Akta Pendirian (articles of incorporation) as PDF or image.
 * AI extracts the shareholder list with name, legal form, shareholding %,
 * capital contribution, and director/commissioner roles.
 *
 * Returns a list ready to be reviewed and saved via /api/shareholders.
 */

const SYSTEM_PROMPT = `You are an Indonesian legal document reader specialized in Akta Pendirian
(articles of incorporation) and Akta Perubahan (amendment deeds).

Your task: Extract the complete list of shareholders (pemegang saham) and their details.

Look for sections titled:
- "MODAL DAN SAHAM" (capital and shares)
- "PEMEGANG SAHAM" (shareholders)
- "SUSUNAN PEMEGANG SAHAM" (shareholder composition)
- "PARA PENGHADAP" (parties appearing)
- "SUSUNAN PENGURUS" (management composition) — for directors/commissioners

For each shareholder, extract:
- name (full name as printed)
- is_entity (true if corporate/legal entity like PT/CV/Ltd, false if individual person)
- npwp (Indonesian tax ID — format XX.XXX.XXX.X-XXX.XXX — if printed)
- nik (Indonesian KTP number — 16 digits — for individuals only)
- country_code (ISO 3166-1 alpha-2; default "ID" for Indonesian)
- shareholding_pct (percentage of shares, 0-100)
- capital_amount (paid-up capital contributed in IDR as a number, without currency symbol)
- number_of_shares (jumlah saham) if printed
- share_class ("COMMON"/"PREFERRED"/etc, if mentioned)
- is_director (true if listed as Direktur/Direktur Utama)
- is_commissioner (true if listed as Komisaris/Komisaris Utama)
- is_beneficial_owner (default true; false only if explicitly marked as nominee/wakil)

Also extract:
- company_name (name of the company being incorporated)
- total_authorized_capital (modal dasar, in IDR)
- total_paid_up_capital (modal disetor, in IDR)
- incorporation_date (tanggal akta) in YYYY-MM-DD
- notary_name (nama notaris) if visible

Validation:
- Sum of shareholding_pct of all shareholders should be ≈ 100%
- If capital_amount is listed per shareholder, their sum should equal total_paid_up_capital

Respond ONLY with this JSON structure (no prose):
{
  "company_name": "string or null",
  "incorporation_date": "YYYY-MM-DD or null",
  "notary_name": "string or null",
  "total_authorized_capital": number or null,
  "total_paid_up_capital": number or null,
  "shareholders": [
    {
      "name": "string",
      "is_entity": boolean,
      "npwp": "string or null",
      "nik": "string or null",
      "country_code": "ID",
      "shareholding_pct": number,
      "capital_amount": number or null,
      "number_of_shares": number or null,
      "share_class": "string or null",
      "is_director": boolean,
      "is_commissioner": boolean,
      "is_beneficial_owner": true
    }
  ],
  "confidence": 0.0 to 1.0,
  "warnings": ["any validation issues or missing info"]
}

If the document is not an Akta Pendirian or shareholders cannot be identified,
return { "shareholders": [], "confidence": 0, "warnings": ["..."] }.`;

interface ExtractedShareholder {
  name: string;
  is_entity: boolean;
  npwp: string | null;
  nik: string | null;
  country_code: string;
  shareholding_pct: number;
  capital_amount: number | null;
  number_of_shares?: number | null;
  share_class: string | null;
  is_director: boolean;
  is_commissioner: boolean;
  is_beneficial_owner: boolean;
}

interface OcrResult {
  company_name: string | null;
  incorporation_date: string | null;
  notary_name: string | null;
  total_authorized_capital: number | null;
  total_paid_up_capital: number | null;
  shareholders: ExtractedShareholder[];
  confidence: number;
  warnings: string[];
}

async function handleOcr(req: RequestWithSession): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { error: 'Use JPEG, PNG, WebP, or PDF' },
        { status: 400 }
      );
    }

    // Allow larger PDFs for multi-page Akta
    const maxSize = file.type === 'application/pdf' ? 32 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return Response.json(
        { error: `File must be under ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const client = new Anthropic();

    const contentItem = file.type === 'application/pdf'
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64,
          },
        };

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          contentItem,
          { type: 'text', text: 'Extract all shareholders and company capital info from this Akta Pendirian.' },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip common markdown fences if AI wraps JSON
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as OcrResult;

      // Validation: check if shareholding sum is close to 100
      const totalPct = (parsed.shareholders || []).reduce(
        (sum, s) => sum + (Number(s.shareholding_pct) || 0),
        0
      );
      const extraWarnings: string[] = [];
      if (parsed.shareholders && parsed.shareholders.length > 0) {
        if (Math.abs(totalPct - 100) > 1) {
          extraWarnings.push(`주주 지분율 합계가 ${totalPct.toFixed(2)}% — 100%와 차이가 있습니다. 검토 필요.`);
        }
      } else {
        extraWarnings.push('주주 정보를 추출하지 못했습니다. 수동으로 입력하거나 더 선명한 문서를 올려주세요.');
      }

      loggers.api.info(
        {
          shareholderCount: parsed.shareholders?.length || 0,
          confidence: parsed.confidence,
          totalPct,
        },
        'Shareholder OCR completed'
      );

      return Response.json({
        success: true,
        data: {
          ...parsed,
          warnings: [...(parsed.warnings || []), ...extraWarnings],
        },
      });
    } catch (parseError) {
      loggers.api.warn({ parseError, textPreview: text.slice(0, 200) }, 'Shareholder OCR JSON parse failed');
      return Response.json({
        success: false,
        error: 'AI 응답을 파싱할 수 없습니다. 문서를 수동으로 확인해주세요.',
        rawText: text.slice(0, 500),
      }, { status: 200 });
    }
  } catch (error) {
    loggers.api.error({ err: error }, 'Shareholder OCR error');
    return Response.json(
      { error: 'Shareholder OCR failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return customerOperation('SHAREHOLDER_OCR')(request as RequestWithSession, handleOcr);
}
