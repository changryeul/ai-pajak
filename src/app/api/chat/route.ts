import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { loggers } from '@/lib/logger';

const BASE_SYSTEM = `You are "Asisten Pajak AI", an expert Indonesian tax assistant integrated into the AI Pajak platform.

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
- Use specific regulation references (e.g., "Pasal 17 UU PPh", "PMK 213/PMK.03/2016")
- Include calculations with numbers when relevant
- For complex cases, recommend consulting a tax professional
- Be friendly but professional
- Use markdown formatting for clarity
- Keep answers concise but thorough

When the user asks about THEIR own tax data (e.g., "내 NPWP는?", "이번달 원천세 얼마야?"), use the
CUSTOMER CONTEXT block below. Never invent numbers. If the context doesn't cover the question,
say so and suggest where to look in the app (e.g., /tax/billing, /my-profile).

After your answer, ALWAYS add 2-3 follow-up suggestions on new lines prefixed with
"➤ " — these become clickable chips in the UI. Keep each suggestion under 40 characters.
Example:
  Jawaban utama Anda di sini.

  ➤ Hitung PPh 21 dengan bonus
  ➤ Deadline SPT bulan ini
  ➤ Cara lapor UMKM`;

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    id: 'Indonesian (Bahasa Indonesia)',
    en: 'English',
    ko: 'Korean (한국어)',
  };
  return map[code] || 'the user\'s language';
}

async function buildCustomerContext(userId: string): Promise<string> {
  try {
    const admin = getSupabaseAdmin();
    const { data: customer } = await admin
      .from('customer')
      .select('id, customer_type, full_name, company_name, npwp, nik, ptkp_status, is_pkp, annual_revenue')
      .eq('user_id', userId)
      .maybeSingle();
    if (!customer) return '';

    // Latest 3 filings
    const { data: filings } = await admin
      .from('tax_filing')
      .select('tax_type, tax_period, status, filed_at, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // Open queue items
    const { data: queue } = await admin
      .from('djp_submission_queue')
      .select('tax_type, tax_period_month, tax_period_year, amount, status')
      .eq('customer_id', customer.id)
      .in('status', ['PENDING', 'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING'])
      .order('tax_period_year', { ascending: false })
      .order('tax_period_month', { ascending: false })
      .limit(5);

    const name = customer.company_name || customer.full_name || '—';
    const lines = [
      `### CUSTOMER CONTEXT (use only when user asks about their own data)`,
      `- Name: ${name}`,
      `- Type: ${customer.customer_type}`,
      customer.npwp ? `- NPWP: ${customer.npwp}` : '',
      customer.nik ? `- NIK: ${customer.nik}` : '',
      customer.ptkp_status ? `- PTKP: ${customer.ptkp_status}` : '',
      customer.is_pkp != null ? `- PKP: ${customer.is_pkp ? 'YES' : 'NO'}` : '',
      customer.annual_revenue ? `- Annual revenue: Rp ${Number(customer.annual_revenue).toLocaleString('id-ID')}` : '',
      filings?.length ? `- Recent filings: ${filings.map((f) => `${f.tax_type} ${f.tax_period} ${f.status}`).join('; ')}` : '',
      queue?.length
        ? `- Open queue items: ${queue
            .map((q) => `${q.tax_type} ${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')} Rp${Number(q.amount).toLocaleString('id-ID')} [${q.status}]`)
            .join('; ')}`
        : '- Open queue items: none',
    ].filter(Boolean);

    return '\n\n' + lines.join('\n');
  } catch (err) {
    loggers.api.warn({ err }, 'chat: customer context build failed');
    return '';
  }
}

function extractFollowups(reply: string): { body: string; followups: string[] } {
  const lines = reply.split('\n');
  const followups: string[] = [];
  const bodyLines: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*➤\s*(.+)$/);
    if (m) followups.push(m[1].trim());
    else bodyLines.push(l);
  }
  return {
    body: bodyLines.join('\n').trim(),
    followups: followups.slice(0, 4),
  };
}

/**
 * POST /api/chat
 * Body: { messages: [{ role, content }], language?: 'id'|'en'|'ko' }
 * Returns: { success, reply, followups: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const recentMessages = messages.slice(-20);
    const customerContext = await buildCustomerContext(user.id);
    const langSuffix = language && language !== 'id'
      ? `\n\nIMPORTANT: You MUST respond entirely in ${getLanguageName(language)}. Only keep official Indonesian tax codes (PPh, PPN, NPWP, SPT) in their original form.`
      : '';

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1600,
      system: BASE_SYSTEM + customerContext + langSuffix,
      messages: recentMessages,
    });

    const raw = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();
    const { body: replyBody, followups } = extractFollowups(raw);

    return NextResponse.json({ success: true, reply: replyBody, followups });
  } catch (error) {
    loggers.api.error({ err: error }, 'Chat error');
    return NextResponse.json(
      { error: 'Chat failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
