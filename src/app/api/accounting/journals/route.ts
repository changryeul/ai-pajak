import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { getChartOfAccounts } from '@/lib/accounting/financial-statements';

/**
 * GET /api/accounting/journals?customerId=xxx&year=2025
 * POST /api/accounting/journals — Create journal entry with lines
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = new URL(request.url).searchParams;
    const customerId = p.get('customerId');
    const year = Number(p.get('year'));
    if (!customerId || !year) return NextResponse.json({ error: 'customerId and year required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: entries } = await admin.from('journal_entry')
      .select('id, entry_date, entry_number, description, source, created_at')
      .eq('customer_id', customerId).eq('fiscal_year', year)
      .order('entry_date').order('entry_number');

    // Load lines for each entry
    const journals = [];
    for (const entry of entries || []) {
      const { data: lines } = await admin.from('journal_entry_line')
        .select('account_code, debit, credit, description, line_order')
        .eq('journal_entry_id', entry.id)
        .order('line_order');

      // Enrich with account names
      const coa = getChartOfAccounts();
      const enrichedLines = (lines || []).map(l => ({
        ...l,
        debit: Number(l.debit),
        credit: Number(l.credit),
        account_name: coa.find(a => a.code === l.account_code)?.name || l.account_code,
      }));

      journals.push({ ...entry, lines: enrichedLines });
    }

    return NextResponse.json({ success: true, data: { journals, coa: getChartOfAccounts() } });
  } catch (error) {
    loggers.api.error({ err: error }, 'Journals GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

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
    const { customerId, fiscalYear, entryDate, description, lines } = body;

    if (!customerId || !fiscalYear || !entryDate || !description || !lines?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate balance
    const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 1) {
      return NextResponse.json({ error: `차변/대변 불일치: ${totalDebit} vs ${totalCredit}` }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Generate entry number
    const { count } = await admin.from('journal_entry')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('fiscal_year', fiscalYear);
    const seq = (count || 0) + 1;
    const entryNumber = `JV-${fiscalYear}-${String(seq).padStart(4, '0')}`;

    // Insert entry
    const { data: entry, error: entryErr } = await admin.from('journal_entry').insert({
      customer_id: customerId,
      fiscal_year: fiscalYear,
      entry_date: entryDate,
      entry_number: entryNumber,
      description,
      source: 'MANUAL',
      created_by: user.id,
    }).select().single();

    if (entryErr || !entry) {
      return NextResponse.json({ error: entryErr?.message || 'Failed to create entry' }, { status: 500 });
    }

    // Insert lines
    const lineRows = lines.map((l: { account_code: string; debit: number; credit: number; line_order?: number }, i: number) => ({
      journal_entry_id: entry.id,
      account_code: l.account_code,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      line_order: l.line_order || i + 1,
    }));

    await admin.from('journal_entry_line').insert(lineRows);

    loggers.api.info({ customerId, entryNumber, lines: lineRows.length }, 'Journal entry created');

    return NextResponse.json({
      success: true,
      data: { id: entry.id, entryNumber },
      message: `저널 ${entryNumber} 저장 완료`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Journal POST error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
