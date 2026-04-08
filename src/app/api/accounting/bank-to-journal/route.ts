import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { convertBankStatementToJournals, extractPattern, type BankTransaction, type CoaMemoryEntry } from '@/lib/accounting/bank-to-journal';

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

    const admin = getSupabaseAdmin();

    // Load customer's COA mapping memory
    const { data: memoryRows } = await admin
      .from('coa_mapping_memory')
      .select('description_pattern, account_code, account_name, transaction_type')
      .eq('customer_id', customerId);

    const memory: CoaMemoryEntry[] = (memoryRows || []).map(r => ({
      description_pattern: r.description_pattern,
      account_code: r.account_code,
      account_name: r.account_name || '',
      transaction_type: r.transaction_type as 'DEBIT' | 'CREDIT',
    }));

    const result = convertBankStatementToJournals(transactions, memory);

    if (action === 'save') {

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

      // Learn: save each mapping to COA memory for future auto-use
      for (const j of result.journals) {
        if (j.source === 'DEFAULT' || j.source === 'RULE') {
          // Only learn non-memory mappings (RULE and DEFAULT get confirmed by saving)
          const accountLine = j.lines.find(l => l.account_code !== '1200');
          if (accountLine) {
            const pattern = extractPattern(j.description);
            if (pattern.length >= 3) {
              try {
                await admin.from('coa_mapping_memory').upsert({
                  customer_id: customerId,
                  description_pattern: pattern,
                  account_code: accountLine.account_code,
                  account_name: accountLine.account_name,
                  transaction_type: accountLine.debit > 0 ? 'DEBIT' : 'CREDIT',
                  used_count: 1,
                  last_used_at: new Date().toISOString(),
                }, { onConflict: 'customer_id,description_pattern,transaction_type' });
              } catch { /* non-blocking */ }
            }
          }
        }
      }

      loggers.api.info({ customerId, fiscalYear, saved, total: result.journals.length, learned: result.journals.filter(j => j.source !== 'MEMORY').length }, 'Bank→journal saved + learned');

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
