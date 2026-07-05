/**
 * customer/consultant/user_roles 등 어디에도 참조되지 않는 auth.users 잔재를
 * 정리한다. 스모크 스크립트가 남긴 것을 특정하기 위해 이메일 패턴 필터.
 *
 * 필터 (AND):
 *   - email 이 스모크 패턴 매치 (prod.smoke./probe.ind./dup.prod./repro.prod./bridge-)
 *   - customer.user_id 로 참조되지 않음
 *   - consultant.user_id 로 참조되지 않음
 *   - user_roles.user_id 로 참조되지 않음
 *
 * dry-run 기본. --apply 로 삭제. 삭제 실패 시 상세 원인 dump.
 *
 * 실행: npx tsx scripts/cleanup-dangling-auth.ts [--apply]
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.production.local' });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const APPLY = process.argv.includes('--apply');
const SMOKE_EMAIL_RE = /^(prod\.smoke\.|probe\.ind\.|dup\.prod\.|repro\.prod\.|bridge-|newtest|crlee1234)/i;

async function fetchAllAuthUsers() {
  const all: Array<{ id: string; email: string | undefined; created_at: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    all.push(...(data.users || []).map(u => ({
      id: u.id, email: u.email, created_at: u.created_at,
    })));
    if (!data.users || data.users.length < 200) break;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

async function main() {
  const users = await fetchAllAuthUsers();
  const smokeUsers = users.filter(u => SMOKE_EMAIL_RE.test(u.email || ''));
  console.log(`[scan] ${users.length} total auth.users, ${smokeUsers.length} matching smoke pattern`);

  if (smokeUsers.length === 0) return;

  const ids = smokeUsers.map(u => u.id);

  const [custRes, consRes, rolesRes] = await Promise.all([
    admin.from('customer').select('user_id').in('user_id', ids),
    admin.from('consultant').select('user_id').in('user_id', ids),
    admin.from('user_roles').select('user_id').in('user_id', ids),
  ]);
  const referenced = new Set<string>();
  [...(custRes.data || []), ...(consRes.data || []), ...(rolesRes.data || [])]
    .forEach(r => referenced.add(r.user_id));

  const dangling = smokeUsers.filter(u => !referenced.has(u.id));

  console.log(`[dangling] ${dangling.length} auth.users with no customer/consultant/user_roles reference:`);
  dangling.forEach(u => console.log(`   ${u.id}  ${u.email}`));

  if (!APPLY) {
    console.log(`\n(dry-run) rerun with --apply to delete`);
    return;
  }

  console.log(`\n[apply] deleting…`);
  let ok = 0, fail = 0;
  const failures: Array<{ email: string; reason: string }> = [];
  for (const u of dangling) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) {
      failures.push({ email: u.email || '', reason: error.message });
      fail++;
      console.log(`   ❌ ${u.email} — ${error.message}`);
    } else {
      ok++;
      console.log(`   ✅ ${u.email}`);
    }
  }
  console.log(`\n[done] ok=${ok} fail=${fail}`);

  if (failures.length > 0) {
    console.log(`\n[hint] auth.admin.deleteUser 가 실패하는 흔한 원인:`);
    console.log(`   - audit_log.actor_user_id 참조 (스모크 활동이 감사 로그에 남았을 수 있음)`);
    console.log(`   - tax_activity_log.actor_user_id 참조`);
    console.log(`   - poa.granted_by_user_id 등 각종 FK`);
    console.log(`   → Supabase Dashboard SQL Editor 에서 감사 로그 정리 후 재실행 권장`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
