/**
 * Phase A 시드 보강 검증 — service-role admin client로 EMP001 케이스 직접 조회.
 *
 * 실행:
 *   SEED_TARGET=prod npx tsx scripts/verify-staff-demo-cases.ts
 *
 * 기대값:
 *   - C-005 (PT Sehat Sentosa, APPROVED, EMP001) 존재
 *   - C-006 (PT Maju Bersama, EBILLING_GENERATED, EMP001, ebilling_code=820...) 존재
 *   - 두 케이스 모두 review_summary.reviewRequired === 0
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
config({ path: resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { persistSession: false } });

interface ReviewSummary { reviewRequired?: number; items?: Array<unknown> }
interface CaseRow {
  case_code: string;
  status: string;
  priority: string;
  amount: number;
  ebilling_code: string | null;
  bpe_number: string | null;
  review_summary: ReviewSummary | null;
  customer_id: string;
  operator_id: string | null;
}

async function main() {
  console.log(`🔎 Verifying staff demo cases on ${url}\n`);

  const { data: emp001 } = await admin
    .from('tax_operators').select('id, employee_id, name')
    .eq('employee_id', 'EMP001').maybeSingle();
  if (!emp001) {
    console.error('❌ EMP001 not found in tax_operators — run seed-supervisor-demo.ts first');
    process.exit(1);
  }
  console.log(`  EMP001 = ${emp001.id} (${emp001.name})`);

  const codes = ['C-001', 'C-002', 'C-005', 'C-006'];
  for (const code of codes) {
    const { data: row } = await admin
      .from('djp_submission_queue')
      .select('case_code, status, priority, amount, ebilling_code, bpe_number, review_summary, customer_id, operator_id')
      .eq('case_code', code).maybeSingle();
    if (!row) { console.log(`  ${code}: ❌ MISSING`); continue; }
    const r = row as CaseRow;
    const { data: cust } = await admin.from('customer').select('full_name, company_name').eq('id', r.customer_id).maybeSingle();
    const name = cust?.company_name || cust?.full_name || '—';
    const isMine = r.operator_id === emp001.id ? '✓ EMP001' : `✗ other (${r.operator_id?.slice(0, 8)}…)`;
    const reviewRequired = r.review_summary?.reviewRequired ?? '—';
    const items = r.review_summary?.items?.length ?? 0;
    console.log(`  ${code.padEnd(7)} ${name.padEnd(20)} status=${r.status.padEnd(20)} priority=${r.priority.padEnd(7)} amount=${r.amount.toLocaleString('id-ID').padStart(13)} ebilling=${(r.ebilling_code ?? '—').padEnd(16)} review=(req:${reviewRequired}, items:${items}) ${isMine}`);
  }

  console.log('\n✅ Verification done.');
}

main().catch(err => { console.error(err); process.exit(1); });
