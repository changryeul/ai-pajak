import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import {
  generateFinancialStatements,
  getChartOfAccounts,
  type JournalLine,
} from '@/lib/accounting/financial-statements';

/**
 * GET /api/accounting/financial-statements?customerId=xxx&year=2025[&type=TRIAL_BALANCE|BALANCE_SHEET|INCOME_STATEMENT]
 *   → Returns saved financial statement or generates from journal entries
 *
 * POST /api/accounting/financial-statements
 *   body: { customerId, fiscalYear, action: 'generate' | 'save' }
 *   → 'generate': reads journal_entry + journal_entry_line → builds all statements
 *   → 'save': saves the generated statements to financial_statement table
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const year = Number(params.get('year'));
    const type = params.get('type');

    if (!customerId || !year) {
      return NextResponse.json({ error: 'customerId and year required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Return saved statement if exists
    if (type) {
      const { data } = await admin
        .from('financial_statement')
        .select('*')
        .eq('customer_id', customerId)
        .eq('fiscal_year', year)
        .eq('statement_type', type)
        .maybeSingle();

      return NextResponse.json({ success: true, data, coa: getChartOfAccounts() });
    }

    // Return all saved statements for the year
    const { data: statements } = await admin
      .from('financial_statement')
      .select('*')
      .eq('customer_id', customerId)
      .eq('fiscal_year', year);

    // Also return journal entry count
    const { count: journalCount } = await admin
      .from('journal_entry')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('fiscal_year', year);

    return NextResponse.json({
      success: true,
      data: {
        statements: statements || [],
        journalCount: journalCount || 0,
        coa: getChartOfAccounts(),
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Financial statements GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT', 'TAX_ADVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Only consultants can generate statements' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, fiscalYear, action = 'generate' } = body;

    if (!customerId || !fiscalYear) {
      return NextResponse.json({ error: 'customerId and fiscalYear required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Load all journal entries for the fiscal year
    const { data: entries } = await admin
      .from('journal_entry')
      .select('id')
      .eq('customer_id', customerId)
      .eq('fiscal_year', fiscalYear);

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        error: `${fiscalYear}년 저널이 없습니다. 먼저 저널을 입력하세요.`,
      }, { status: 404 });
    }

    // Load all journal lines
    const entryIds = entries.map(e => e.id);
    const { data: lines } = await admin
      .from('journal_entry_line')
      .select('account_code, debit, credit')
      .in('journal_entry_id', entryIds);

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: '저널에 상세 내역이 없습니다' }, { status: 404 });
    }

    // Generate financial statements
    const journalLines: JournalLine[] = lines.map(l => ({
      account_code: l.account_code,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }));

    const result = generateFinancialStatements(journalLines);

    // Save if action is 'save'
    if (action === 'save') {
      const statementsToSave = [
        { type: 'TRIAL_BALANCE', data: result.trialBalance },
        { type: 'INCOME_STATEMENT', data: result.incomeStatement },
        { type: 'BALANCE_SHEET', data: result.balanceSheet },
      ];

      for (const stmt of statementsToSave) {
        await admin.from('financial_statement').upsert({
          customer_id: customerId,
          fiscal_year: fiscalYear,
          statement_type: stmt.type,
          generated_by: user.id,
          data: stmt.data,
          status: 'DRAFT',
        }, { onConflict: 'customer_id,fiscal_year,statement_type' });
      }

      loggers.api.info({ customerId, fiscalYear, isValid: result.validation.isValid }, 'Financial statements saved');
    }

    return NextResponse.json({
      success: true,
      data: {
        trialBalance: result.trialBalance,
        incomeStatement: result.incomeStatement,
        balanceSheet: result.balanceSheet,
        validation: result.validation,
        journalLineCount: journalLines.length,
        journalEntryCount: entries.length,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Financial statements POST error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
