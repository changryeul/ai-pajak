import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { convertBankStatementToJournals, type BankTransaction } from '@/lib/accounting/bank-to-journal';

/**
 * POST /api/accounting/bank-to-journal
 * body: { customerId, fiscalYear, transactions: BankTransaction[] }
 *
 * Converts bank transactions to journal entries.
 * action: 'preview' (default) — returns generated journals without saving
 * action: 'save' — saves to journal_entry + journal_entry_line
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'CUSTOMER'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, fiscalYear, transactions, action = 'preview' } = body as {
      customerId: string;
      fiscalYear: number;
      transactions: BankTransaction[];
      action?: 'preview' | 'save';
    };

    if (!customerId || !fiscalYear || !transactions?.length) {
      return NextResponse.json({ error: 'customerId, fiscalYear, transactions required' }, { status: 400 });
    }

    const result = convertBankStatementToJournals(transactions);

    if (action === 'save') {
      const admin = getSupabaseAdmin();

      // Get current sequence
      const { count } = await admin.from('journal_entry')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId).eq('fiscal_year', fiscalYear);
      let seq = (count || 0) + 1;

      let saved = 0;
      for (const j of result.journals) {
        const entryNumber = `JV-${fiscalYear}-${String(seq).padStart(4, '0')}`;

        const { data: entry, error: entryErr } = await admin.from('journal_entry').insert({
          customer_id: customerId,
          fiscal_year: fiscalYear,
          entry_date: j.entryDate,
          entry_number: entryNumber,
          description: j.description,
          source: 'BANK_IMPORT',
          created_by: user.id,
        }).select().single();

        if (entryErr || !entry) continue;

        const lineRows = j.lines.map((l, i) => ({
          journal_entry_id: entry.id,
          account_code: l.account_code,
          debit: l.debit,
          credit: l.credit,
          line_order: i + 1,
        }));
        await admin.from('journal_entry_line').insert(lineRows);
        saved++;
        seq++;
      }

      loggers.api.info({ customerId, fiscalYear, saved, total: result.journals.length }, 'Bank→journal saved');

      return NextResponse.json({
        success: true,
        data: { ...result, saved },
        message: `${saved}건 저널 저장 완료 (${result.summary.high} HIGH, ${result.summary.medium} MEDIUM, ${result.summary.low} LOW)`,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    loggers.api.error({ err: error }, 'Bank→journal error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
