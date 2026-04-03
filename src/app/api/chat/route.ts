import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { loggers } from '@/lib/logger';

const SYSTEM_PROMPT = `You are "Asisten Pajak AI", an expert Indonesian tax assistant integrated into the AI Pajak platform.

Your capabilities:
1. Answer tax questions about Indonesian tax law (UU PPh, UU PPN, UU HPP, PP, PMK)
2. Explain tax calculations (PPh 21, PPh 23, PPh Final, PPN, SPT)
3. Guide users through tax filing processes
4. Provide tax planning advice and optimization tips
5. Explain tax deadlines and penalties
6. Help with NPWP registration questions

Key tax knowledge:
- PPh 21: Progressive rates 5%-35% on employment income
- PPh 23: 15% on dividends/interest, 2% on services/rent
- PPh Final UMKM: 0.5% of gross revenue (PP 55/2022), first Rp 500M exempt
- PPN: 11% standard rate (UU HPP)
- PTKP 2024: TK/0 = Rp 54M, K/0 = Rp 58.5M, per dependent +Rp 4.5M
- SPT deadline: Individual March 31, Corporate April 30
- Late penalty: Rp 100,000 (individual), Rp 1,000,000 (corporate)

Rules:
- Respond in the user's language (auto-detect from their message)
- Use specific regulation references (e.g., "Pasal 17 UU PPh")
- Include calculations with numbers when relevant
- For complex cases, recommend consulting a tax professional
- Be friendly but professional
- Use markdown formatting for clarity
- Keep answers concise but thorough`;

/**
 * POST /api/chat
 *
 * AI Tax Chatbot endpoint
 * Input: { messages: [{role, content}], language?: string }
 * Output: { reply: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateCheck = await checkRateLimit(user.id, 'chatbot');
    if (!rateCheck.allowed) {
      return NextResponse.json(rateLimitResponse(rateCheck, 'chatbot'), { status: 429 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chat service not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { messages, language } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      language?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // Limit conversation history to last 20 messages
    const recentMessages = messages.slice(-20);

    const anthropic = new Anthropic({ apiKey });

    const langSuffix = language && language !== 'id'
      ? `\n\nIMPORTANT: You MUST respond entirely in ${getLanguageName(language)}. All explanations, tax terms, and examples must be in ${getLanguageName(language)}. Only keep official Indonesian tax codes (e.g., PPh, PPN, NPWP, SPT) in their original form.`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + langSuffix,
      messages: recentMessages,
    });

    const content = response.content[0];
    const reply = content.type === 'text' ? content.text : '';

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    loggers.api.error({ err: error }, 'Chat error');
    return NextResponse.json(
      { error: 'Chat failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    id: 'Indonesian (Bahasa Indonesia)',
    en: 'English',
    ko: 'Korean (한국어)',
    ja: 'Japanese (日本語)',
    zh: 'Chinese (中文)',
  };
  return map[code] || 'the user\'s language';
}
