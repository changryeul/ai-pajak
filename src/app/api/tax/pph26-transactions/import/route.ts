import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { parseCSV, validatePPh26Rows, type ParsedRow } from '@/lib/tax/bulk-import/csv-parser';
import type { RequestWithSession } from '@/types/auth';

/**
 * POST /api/tax/pph26-transactions/import
 *
 * Bulk import of PPh 26 (non-resident withholding) transactions. Same shape as
 * the PPh23 bulk endpoint — supports both `csvContent` (papaparse) and `rows`
 * (OCR / wholesale importer output) inputs.
 *
 * 단순화 정책 (v1):
 *   - bulk 는 standard 20% flat rate 만 적용. treaty rate / CoD 검증은 단건
 *     POST 흐름 (TaxResolutionEngine) 에서만 처리. 대량 수입 시 사용자가
 *     올린 ledger 에는 CoD 정보가 없으므로 보수적으로 20% 로 잡고, 추후
 *     단건 화면에서 정정한다.
 *   - 검증 실패 행은 insert 하지 않고 errors 배열로 반환.
 *   - counterparty_id / recipient_country / has_cod 매칭은 v1 에서 생략.
 */

interface ImportRow {
  transaction_date: string;       // 'YYYY-MM-DD'
  income_type: string;            // DIVIDEND / INTEREST / ROYALTY / SERVICE / OTHER
  gross_amount: number | string;
  counterparty_name: string;
  counterparty_npwp?: string;
  invoice_number?: string;
  description?: string;
}

interface RequestBody {
  customerId?: string;
  taxPeriod: string;
  csvContent?: string;
  rows?: ImportRow[];
}

// pph26_transaction.income_type stores lowercase per server INCOME_TYPES const
// (dividend/interest/royalty/service/salary/pension/insurance/other). The
// wholesale importer emits UPPERCASE — normalise before insert so both bulk
// + single-entry paths produce identical column values.
const UPPER_TO_LOWER: Record<string, string> = {
  DIVIDEND: 'dividend',
  INTEREST: 'interest',
  ROYALTY: 'royalty',
  SERVICE: 'service',
  OTHER: 'other',
};

function rowsFromBody(body: RequestBody): { rows: ParsedRow[]; headers: string[] } | null {
  if (typeof body.csvContent === 'string' && body.csvContent.trim().length > 0) {
    const parsed = parseCSV(body.csvContent);
    return { rows: parsed.rows, headers: parsed.headers };
  }
  if (Array.isArray(body.rows)) {
    const headers = ['transaction_date', 'income_type', 'gross_amount', 'counterparty_name', 'counterparty_npwp', 'invoice_number', 'description'];
    const rows: ParsedRow[] = body.rows.map((r, idx) => ({
      rowNumber: idx + 1,
      data: {
        transaction_date: String(r.transaction_date ?? ''),
        income_type: String(r.income_type ?? ''),
        gross_amount: String(r.gross_amount ?? ''),
        counterparty_name: String(r.counterparty_name ?? ''),
        counterparty_npwp: String(r.counterparty_npwp ?? ''),
        invoice_number: String(r.invoice_number ?? ''),
        description: String(r.description ?? ''),
      },
      errors: [],
      isValid: true,
    }));
    return { rows, headers };
  }
  return null;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { taxPeriod } = body;

  const sb = getSupabaseAdmin();
  let customerId = body.customerId;
  if (!customerId && req.session.role === 'CUSTOMER') {
    const { data } = await sb.from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
    customerId = data?.id;
  }
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
  }
  if (!taxPeriod || !/^\d{4}-\d{2}$/.test(taxPeriod)) {
    return NextResponse.json({ success: false, error: 'taxPeriod (YYYY-MM) required' }, { status: 400 });
  }

  const inputBundle = rowsFromBody(body);
  if (!inputBundle) {
    return NextResponse.json(
      { success: false, error: 'Either csvContent or rows is required' },
      { status: 400 },
    );
  }
  if (inputBundle.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No input rows' },
      { status: 400 },
    );
  }
  if (inputBundle.rows.length > 500) {
    return NextResponse.json(
      { success: false, error: 'At most 500 rows per request' },
      { status: 400 },
    );
  }

  const validated = validatePPh26Rows({
    rows: inputBundle.rows,
    totalRows: inputBundle.rows.length,
    validRows: inputBundle.rows.length,
    errorRows: 0,
    headers: inputBundle.headers,
  });

  const rate = 0.20; // PPh26 flat 20% (treaty NOT applied in bulk v1)

  const inserts = validated.rows
    .filter((r) => r.isValid)
    .map((r) => {
      const incomeTypeUpper = r.data.income_type.toUpperCase();
      const incomeType = UPPER_TO_LOWER[incomeTypeUpper] ?? incomeTypeUpper.toLowerCase();
      const gross = parseFloat(r.data.gross_amount);
      const taxAmount = Math.round(gross * rate);
      return {
        customer_id: customerId,
        tax_period: taxPeriod,
        transaction_date: r.data.transaction_date,
        description: r.data.description || null,
        income_type: incomeType,
        invoice_number: r.data.invoice_number || null,
        gross_amount: gross,
        standard_rate: 0.20,
        applied_rate: rate,
        tax_amount: taxAmount,
        recipient_name: r.data.counterparty_name || null,
        recipient_npwp: r.data.counterparty_npwp || null,
        treaty_applied: false,
        has_cod: false,
      };
    });

  let insertedCount = 0;
  let insertError: string | null = null;
  if (inserts.length > 0) {
    const { error, count } = await sb
      .from('pph26_transaction')
      .insert(inserts, { count: 'exact' });
    if (error) {
      insertError = error.message;
      loggers.tax.error({ err: error, customerId, taxPeriod }, 'PPh26 bulk insert failed');
    } else {
      insertedCount = count ?? inserts.length;
    }
  }

  const errors = validated.rows
    .filter((r) => !r.isValid)
    .slice(0, 50)
    .map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.errors,
      data: r.data,
    }));

  return NextResponse.json({
    success: insertError == null,
    data: {
      totalRows: validated.totalRows,
      validRows: validated.validRows,
      errorRows: validated.errorRows,
      insertedCount,
      errors,
      insertError,
      taxPeriod,
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    withAudit('PPH26_BULK_IMPORT'),
  )(request as RequestWithSession, handle);
}
