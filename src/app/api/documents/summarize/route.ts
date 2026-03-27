import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/documents/summarize
 *
 * AI-powered document summarizer for tax regulations, PMK, PP, UU documents.
 * Upload a PDF/image of a regulation and get:
 * - Summary
 * - Key changes
 * - Affected tax calculations
 * - Action items
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const textContent = formData.get('text') as string | null;

    if (!file && !textContent) {
      return NextResponse.json({ error: 'file or text required' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });
    let content: Anthropic.MessageCreateParams['messages'][0]['content'];

    if (file) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      if (file.type === 'application/pdf') {
        content = [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: SUMMARIZE_PROMPT },
        ];
      } else {
        content = [
          { type: 'image', source: { type: 'base64', media_type: file.type as 'image/jpeg', data: base64 } },
          { type: 'text', text: SUMMARIZE_PROMPT },
        ];
      }
    } else {
      content = `${SUMMARIZE_PROMPT}\n\nDokumen:\n${textContent}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    });

    const text = response.content[0];
    const reply = text.type === 'text' ? text.text : '';

    // Try to parse structured output
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    let structured = null;
    if (jsonMatch) {
      try { structured = JSON.parse(jsonMatch[0]); } catch { /* use raw */ }
    }

    return NextResponse.json({
      success: true,
      data: structured || {
        summary: reply,
        documentType: 'UNKNOWN',
        keyChanges: [],
        affectedAreas: [],
        actionItems: [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 });
  }
}

const SUMMARIZE_PROMPT = `Anda adalah ahli hukum pajak Indonesia. Analisis dokumen ini dan berikan ringkasan dalam format JSON:

{
  "documentType": "UU|PP|PMK|SE|PERATURAN_DJP|OTHER",
  "documentNumber": "nomor dokumen",
  "documentTitle": "judul",
  "effectiveDate": "tanggal berlaku",
  "summary": "ringkasan 2-3 paragraf",
  "keyChanges": [
    { "section": "Pasal X", "change": "deskripsi perubahan", "impact": "LOW|MEDIUM|HIGH" }
  ],
  "affectedAreas": ["PPh 21", "PPN", "PTKP", etc.],
  "affectedTaxpayers": ["Karyawan", "UMKM", "Badan", etc.],
  "actionItems": ["langkah yang harus dilakukan"],
  "penalties": "sanksi jika tidak dipatuhi (jika ada)"
}

Gunakan bahasa Indonesia. Jika dokumen bukan regulasi pajak, tetap berikan ringkasan umum.`;
