/**
 * JTC consultant 마이그레이션 잔재 정리 (결정 ① Phase 2 미완분).
 *
 * 은퇴(is_active=false)한 JTC consultant 를 여전히 가리키는 active
 * customer_consultant 행을 비활성화한다.
 *
 * 안전장치: 해당 고객이 active operator_client_assignments 를 가진 경우에만
 * 비활성화 (operator 백필이 안 된 고객의 배정은 건드리지 않는다).
 *
 * 기본 DRY-RUN. --apply 로 실제 갱신. 멱등 — 재실행 시 0건.
 *
 *   SEED_TARGET=prod npx tsx scripts/retire-jtc-customer-consultant.ts
 *   SEED_TARGET=prod npx tsx scripts/retire-jtc-customer-consultant.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const APPLY = process.argv.includes('--apply');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  console.log(`🧹 retire stale JTC customer_consultant — mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const { data: jtc } = await admin
    .from('tax_partner').select('id, name').eq('is_default_filing_partner', true).single();
  if (!jtc) throw new Error('default filing partner not found');

  const { data: retired } = await admin
    .from('consultant')
    .select('id, full_name')
    .eq('tax_partner_id', jtc.id).eq('is_active', false);
  const retiredIds = (retired ?? []).map(c => c.id);
  const nameById = new Map((retired ?? []).map(c => [c.id, c.full_name]));
  if (retiredIds.length === 0) { console.log('retired JTC consultants: 0 — nothing to do'); return; }

  const { data: cc } = await admin
    .from('customer_consultant')
    .select('id, customer_id, consultant_id')
    .eq('is_active', true)
    .in('consultant_id', retiredIds);
  if (!cc || cc.length === 0) { console.log('stale active customer_consultant rows: 0 — nothing to do'); return; }

  const { data: oca } = await admin
    .from('operator_client_assignments')
    .select('customer_id')
    .eq('is_active', true)
    .in('customer_id', cc.map(r => r.customer_id));
  const backfilled = new Set((oca ?? []).map(r => r.customer_id));

  const target = cc.filter(r => backfilled.has(r.customer_id));
  const blocked = cc.filter(r => !backfilled.has(r.customer_id));

  console.log(`stale rows: ${cc.length} · deactivatable (operator-backfilled): ${target.length} · blocked (no operator assignment): ${blocked.length}`);
  for (const r of target) console.log(`  - cc ${r.id} · customer ${r.customer_id} · was ${nameById.get(r.consultant_id)}`);
  for (const r of blocked) console.log(`  ⚠️ BLOCKED cc ${r.id} · customer ${r.customer_id} — run auto-assign first`);

  if (!APPLY) { console.log('\n🔎 DRY-RUN — no changes. Re-run with --apply.'); return; }

  const { error, count } = await admin
    .from('customer_consultant')
    .update({ is_active: false }, { count: 'exact' })
    .in('id', target.map(r => r.id));
  if (error) throw new Error(error.message);
  console.log(`\n✅ deactivated ${count} customer_consultant rows`);
}

main().catch(e => { console.error(e); process.exit(1); });
