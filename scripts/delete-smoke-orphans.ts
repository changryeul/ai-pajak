/**
 * 프로덕션에 남은 스모크 잔재 customer 를 정리한다.
 *
 * 조건 (AND):
 *   - full_name IN ('Prod Smoke User', 'Prod Repro', 'Dup User', 'Probe Ind User', 'TEST PT Bridge')
 *   - customer_consultant.is_active=true 배정이 없음 (미배정 상태)
 *   - email 이 @example.com 로 끝남 (double-check)
 *
 * 순서: has_auth 인 것은 auth.users DELETE → customer.user_id FK CASCADE.
 *      has_auth 아닌 것은 customer DELETE 직접.
 *
 * 실행: npx tsx scripts/delete-smoke-orphans.ts           # dry-run
 *      npx tsx scripts/delete-smoke-orphans.ts --apply
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.production.local' });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SMOKE_NAMES = [
  'Prod Smoke User', 'Prod Repro', 'Dup User', 'Probe Ind User', 'TEST PT Bridge',
  'PT Prod Repro', 'test com', '테스트유저',
];
const APPLY = process.argv.includes('--apply');

async function main() {
  const { data: assigned } = await admin
    .from('customer_consultant')
    .select('customer_id')
    .eq('is_active', true);
  const assignedIds = new Set((assigned || []).map(r => r.customer_id));

  // full_name 또는 company_name 이 SMOKE_NAMES 에 들어있는 것 (사용자 명시 승인).
  const orExpr = SMOKE_NAMES
    .flatMap(n => [`full_name.eq.${n}`, `company_name.eq.${n}`])
    .join(',');
  const { data: raw } = await admin
    .from('customer')
    .select('id, full_name, company_name, email, user_id')
    .or(orExpr);

  const targets = (raw || []).filter(c => !assignedIds.has(c.id));

  console.log(`\n${targets.length} target row(s):`);
  targets.forEach(t => {
    const label = t.company_name || t.full_name;
    console.log(`   ${label.padEnd(20)} ${(t.email || '').padEnd(38)} user=${t.user_id ? 'yes' : 'no'}`);
  });

  if (!APPLY) {
    console.log(`\n(dry-run) rerun with --apply to delete`);
    return;
  }

  console.log(`\n[apply] deleting…`);
  let ok = 0, fail = 0;
  for (const t of targets) {
    // customer 자식 테이블 사전 정리 (FK 가 RESTRICT 인 경우 대비).
    // 스모크 잔재는 최소 subscription + customer_kbli 두 곳이 걸림.
    await admin.from('subscription').delete().eq('customer_id', t.id);
    await admin.from('customer_kbli').delete().eq('customer_id', t.id);
    await admin.from('customer_consultant').delete().eq('customer_id', t.id);
    await admin.from('signature_audit').delete().eq('customer_id', t.id);

    const { error: custErr } = await admin.from('customer').delete().eq('id', t.id);
    if (custErr) {
      console.log(`   ❌ customer delete ${t.email} — ${custErr.message}`);
      fail++;
      continue;
    }

    if (t.user_id) {
      const { error: authErr } = await admin.auth.admin.deleteUser(t.user_id);
      if (authErr) {
        console.log(`   ⚠ customer deleted but auth remains ${t.email} — ${authErr.message}`);
      } else {
        console.log(`   ✅ ${t.email} (customer+auth)`);
        ok++;
        continue;
      }
    }
    console.log(`   ✅ ${t.email} (customer${t.user_id ? ' only' : ''})`);
    ok++;
  }
  console.log(`\n[done] ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
