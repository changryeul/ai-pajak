import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { generateFinancialStatements, type JournalLine } from '@/lib/accounting/financial-statements';

/**
 * GET /api/accounting/financial-statements/pdf?customerId=xxx&year=2025&type=all|income|balance
 *
 * Returns financial statements as a simple HTML table (printable).
 * For production, this would use @react-pdf/renderer.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const year = Number(params.get('year'));

    if (!customerId || !year) {
      return NextResponse.json({ error: 'customerId and year required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get customer info
    const { data: customer } = await admin.from('customer').select('company_name, full_name, npwp').eq('id', customerId).single();
    const companyName = customer?.company_name || customer?.full_name || 'Company';
    const npwp = customer?.npwp || '-';

    // Load journal entries
    const { data: entries } = await admin.from('journal_entry').select('id').eq('customer_id', customerId).eq('fiscal_year', year);
    if (!entries || entries.length === 0) {
      return new NextResponse('No journal entries found', { status: 404 });
    }

    const { data: lines } = await admin.from('journal_entry_line').select('account_code, debit, credit').in('journal_entry_id', entries.map(e => e.id));
    const journalLines: JournalLine[] = (lines || []).map(l => ({ account_code: l.account_code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    const result = generateFinancialStatements(journalLines);

    const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    // Generate printable HTML
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Laporan Keuangan ${companyName} ${year}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; font-size: 12px; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
  h2 { text-align: center; font-size: 14px; color: #666; margin-top: 0; }
  h3 { font-size: 14px; margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th { background: #f0f0f0; padding: 6px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
  td { padding: 5px 6px; border: 1px solid #ddd; font-size: 11px; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .total-row { background: #e8f4fd; font-weight: bold; }
  .net-income { background: #d4edda; font-weight: bold; font-size: 13px; }
  .header-info { text-align: center; margin-bottom: 20px; }
  .balance-check { text-align: center; margin: 10px 0; padding: 8px; border-radius: 4px; }
  .balanced { background: #d4edda; color: #155724; }
  .unbalanced { background: #f8d7da; color: #721c24; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<div class="header-info">
  <h1>${companyName}</h1>
  <h2>NPWP: ${npwp}</h2>
  <h2>Laporan Keuangan Tahun ${year}</h2>
</div>

<h3>I. Neraca Saldo (Trial Balance)</h3>
<table>
  <thead><tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th class="right">Debet</th><th class="right">Kredit</th><th class="right">Saldo</th></tr></thead>
  <tbody>
    ${result.trialBalance.entries.map(e => `<tr><td>${e.accountCode}</td><td>${e.accountName}</td><td>${e.accountType}</td><td class="right">${e.totalDebit > 0 ? fmtRp(e.totalDebit) : ''}</td><td class="right">${e.totalCredit > 0 ? fmtRp(e.totalCredit) : ''}</td><td class="right">${fmtRp(e.balance)}</td></tr>`).join('\n')}
    <tr class="total-row"><td colspan="3">TOTAL</td><td class="right">${fmtRp(result.trialBalance.totalDebit)}</td><td class="right">${fmtRp(result.trialBalance.totalCredit)}</td><td class="right">${result.trialBalance.isBalanced ? '✓' : 'UNBALANCED'}</td></tr>
  </tbody>
</table>

<h3>II. Laporan Laba Rugi (Income Statement)</h3>
<table>
  <tbody>
    ${result.incomeStatement.revenue.map(i => `<tr><td>${i.code}</td><td>${i.name}</td><td class="right">${fmtRp(i.amount)}</td></tr>`).join('\n')}
    <tr class="total-row"><td colspan="2">Laba Kotor (Gross Profit)</td><td class="right">${fmtRp(result.incomeStatement.grossProfit)}</td></tr>
    ${result.incomeStatement.operatingExpenses.map(i => `<tr><td>${i.code}</td><td>${i.name}</td><td class="right">(${fmtRp(i.amount)})</td></tr>`).join('\n')}
    <tr class="total-row"><td colspan="2">Laba Operasional</td><td class="right">${fmtRp(result.incomeStatement.operatingIncome)}</td></tr>
    ${result.incomeStatement.otherIncome.map(i => `<tr><td>${i.code}</td><td>${i.name}</td><td class="right">${fmtRp(i.amount)}</td></tr>`).join('\n')}
    <tr class="total-row"><td colspan="2">Laba Sebelum Pajak</td><td class="right">${fmtRp(result.incomeStatement.incomeBeforeTax)}</td></tr>
    ${result.incomeStatement.taxExpense.map(i => `<tr><td>${i.code}</td><td>${i.name}</td><td class="right">(${fmtRp(i.amount)})</td></tr>`).join('\n')}
    <tr class="net-income"><td colspan="2">LABA BERSIH (Net Income)</td><td class="right">${fmtRp(result.incomeStatement.netIncome)}</td></tr>
  </tbody>
</table>

<h3>III. Neraca (Balance Sheet) — Per 31 Desember ${year}</h3>
<table>
  <thead><tr><th colspan="2">AKTIVA (Assets)</th><th colspan="2">PASIVA (Liabilities & Equity)</th></tr></thead>
  <tbody>
    ${(() => {
      const allAssets = [...result.balanceSheet.assets.current, ...result.balanceSheet.assets.fixed, ...result.balanceSheet.assets.other];
      const allLiab = [...result.balanceSheet.liabilities.current, ...result.balanceSheet.liabilities.longTerm];
      const allEquity = [...result.balanceSheet.equity.items, { code: '3300', name: 'Laba Bersih', amount: result.balanceSheet.equity.netIncome }];
      const maxRows = Math.max(allAssets.length, allLiab.length + allEquity.length);
      let rows = '';
      for (let i = 0; i < maxRows; i++) {
        const a = allAssets[i];
        const rightItems = [...allLiab, ...allEquity];
        const r = rightItems[i];
        rows += `<tr><td>${a ? a.name : ''}</td><td class="right">${a ? fmtRp(a.amount) : ''}</td><td>${r ? r.name : ''}</td><td class="right">${r ? fmtRp(r.amount) : ''}</td></tr>`;
      }
      return rows;
    })()}
    <tr class="total-row"><td>Total Aktiva</td><td class="right">${fmtRp(result.balanceSheet.assets.totalAssets)}</td><td>Total Pasiva</td><td class="right">${fmtRp(result.balanceSheet.totalLiabilitiesAndEquity)}</td></tr>
  </tbody>
</table>
<div class="balance-check ${result.balanceSheet.isBalanced ? 'balanced' : 'unbalanced'}">
  ${result.balanceSheet.isBalanced ? '✓ BALANCED — Aktiva = Pasiva' : '✗ UNBALANCED — Aktiva ≠ Pasiva'}
</div>

<div style="margin-top:40px; font-size:10px; color:#999; text-align:center;">
  Generated by AI Pajak × Jakarta Tax Consulting — ${new Date().toISOString().substring(0, 10)}
</div>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Laporan-Keuangan-${companyName.replace(/\s+/g, '-')}-${year}.html"`,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Financial statements PDF error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
