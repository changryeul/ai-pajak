import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/accounting/drilldown?customerId=xxx&year=2025&accountCode=6100
 *
 * Returns all journal entries that affected the given account code.
 * Used for drill-down from financial statements.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = new URL(request.url).searchParams;
    const customerId = p.get('customerId');
    const year = Number(p.get('year'));
    const accountCode = p.get('accountCode');

    if (!customerId || !year || !accountCode) {
      return NextResponse.json({ error: 'customerId, year, accountCode required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Find all journal lines for this account
    const { data: lines } = await admin
      .from('journal_entry_line')
      .select('journal_entry_id, debit, credit, description, line_order')
      .eq('account_code', accountCode);

    if (!lines || lines.length === 0) {
      return NextResponse.json({ success: true, data: { transactions: [], total: 0 } });
    }

    // Get parent journal entries (filtered by customer + year)
    const entryIds = [...new Set(lines.map(l => l.journal_entry_id))];
    const { data: entries } = await admin
      .from('journal_entry')
      .select('id, entry_date, entry_number, description, source, reference_doc')
      .in('id', entryIds)
      .eq('customer_id', customerId)
      .eq('fiscal_year', year)
      .order('entry_date');

    if (!entries) {
      return NextResponse.json({ success: true, data: { transactions: [], total: 0 } });
    }

    const validEntryIds = new Set(entries.map(e => e.id));

    // Build transaction list
    const transactions = entries.map(entry => {
      const entryLines = lines.filter(l => l.journal_entry_id === entry.id && validEntryIds.has(l.journal_entry_id));
      const debit = entryLines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const credit = entryLines.reduce((s, l) => s + Number(l.credit || 0), 0);
      return {
        entryId: entry.id,
        date: entry.entry_date,
        number: entry.entry_number,
        description: entry.description,
        source: entry.source,
        reference: entry.reference_doc,
        debit,
        credit,
      };
    });

    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);

    return NextResponse.json({
      success: true,
      data: {
        accountCode,
        transactions,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
        count: transactions.length,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Drilldown error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
