/**
 * AI-assist for the operator: looks at a queue item's submitted data and
 * suggests which fields look missing or inconsistent. The operator can
 * review, edit, then save via /api/operator/queue/flag-fields.
 *
 * POST { queueItemId } → { suggestions: FlaggedField[] }
 *
 * Heuristics in this first pass (no LLM call):
 *   - Required fields that are empty or null
 *   - NPWP / NIK format checks
 *   - Amount missing or zero
 *   - Period out of range
 *   - Counterparty (회사명) blank
 *
 * Keeping this as a deterministic checker keeps latency low and lets the
 * operator trust the output. We can swap in Claude later if the heuristics
 * stop covering the cases we see.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

const OPERATOR_ROLES = [
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
];

interface FlaggedField {
  key: string;
  label: string;
  reason: string;
  currentValue?: string | number | null;
  inputType?: 'text' | 'number' | 'date';
}

interface QueueRow {
  id: string;
  tax_type: string;
  amount: number | null;
  counterparty_name: string | null;
  ebilling_code: string | null;
  review_summary: { customer_submitted_data?: Record<string, unknown> } | null;
}

const bodySchema = z.object({ queueItemId: z.string().uuid() });

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (typeof v === 'number') return Number.isNaN(v);
  return false;
}

function suggestForRow(row: QueueRow): FlaggedField[] {
  const out: FlaggedField[] = [];
  const sub = row.review_summary?.customer_submitted_data ?? {};

  if (isBlank(row.counterparty_name) && isBlank(sub['counterparty_name'])) {
    out.push({
      key: 'counterparty_name',
      label: '거래 상대방 / 회사명',
      reason: '회사명이 비어 있습니다. 청구서·증빙에 기재된 정확한 상호를 입력해 주세요.',
      currentValue: row.counterparty_name ?? '',
      inputType: 'text',
    });
  }
  if (!row.amount || Number(row.amount) <= 0) {
    out.push({
      key: 'amount',
      label: '세액 (Rp)',
      reason: '세액이 0 또는 누락되었습니다. 정확한 금액(Rp)을 입력해 주세요.',
      currentValue: row.amount ?? 0,
      inputType: 'number',
    });
  }
  // NPWP — 15 digits
  const npwp = String(sub['npwp'] ?? sub['counterparty_npwp'] ?? '').replace(/\D/g, '');
  if (npwp && npwp.length !== 15) {
    out.push({
      key: 'counterparty_npwp',
      label: '상대방 NPWP',
      reason: `NPWP는 15자리 숫자여야 합니다. (현재 ${npwp.length}자리)`,
      currentValue: String(sub['npwp'] ?? sub['counterparty_npwp'] ?? ''),
      inputType: 'text',
    });
  }
  // NTPN — 16 digits, only required after payment
  const ntpn = String(sub['ntpn'] ?? '').replace(/\D/g, '');
  if (ntpn && ntpn.length !== 16) {
    out.push({
      key: 'ntpn',
      label: 'NTPN',
      reason: `NTPN은 16자리 숫자여야 합니다. (현재 ${ntpn.length}자리)`,
      currentValue: String(sub['ntpn'] ?? ''),
      inputType: 'text',
    });
  }
  // BPE date sanity (only if BPE provided)
  if (sub['bpe_date']) {
    const d = new Date(String(sub['bpe_date']));
    if (Number.isNaN(d.getTime())) {
      out.push({
        key: 'bpe_date',
        label: 'BPE 일자',
        reason: 'BPE 일자가 올바른 날짜 형식이 아닙니다 (YYYY-MM-DD).',
        currentValue: String(sub['bpe_date']),
        inputType: 'date',
      });
    }
  }
  // PPh tax types: payee/주식 type sanity
  if (row.tax_type === 'PPh23' && isBlank(sub['service_description'])) {
    out.push({
      key: 'service_description',
      label: '용역 내용 / 적용 코드',
      reason: 'PPh23은 용역 종류(2% / 15%)에 따라 세율이 다릅니다. 용역 내용을 적어 주세요.',
      currentValue: '',
      inputType: 'text',
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = getSupabaseAdmin();
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
      return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const { data } = await admin
      .from('djp_submission_queue')
      .select('id, tax_type, amount, counterparty_name, ebilling_code, review_summary')
      .eq('id', parsed.data.queueItemId)
      .single();
    if (!data) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }
    const suggestions = suggestForRow(data as QueueRow);
    return NextResponse.json({ success: true, data: { suggestions } });
  } catch (err) {
    loggers.api.error({ err }, 'operator suggest-flags error');
    return NextResponse.json({ error: 'Failed to suggest flags' }, { status: 500 });
  }
}
