/**
 * P6.1: master.test@aipajak.com 에 PLATFORM_MASTER role 겸직 부여.
 *
 * 기존 TAX_OPERATOR_MASTER 는 유지 (Coretax/Tax Rule/Luxury). 신규
 * PLATFORM_MASTER 를 추가로 부여 (통계/커스텀 가격/EXTERNAL 입점).
 *
 * dry-run 기본. --apply 로 INSERT.
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/grant-platform-master.ts [--apply]
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
const EMAIL = 'master.test@aipajak.com';

async function main() {
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    console.error('listUsers failed:', listErr.message);
    console.error('Falling back to email search via SQL raw not available; aborting.');
    process.exit(1);
  }
  const user = (users?.users || []).find(u => u.email === EMAIL);
  if (!user) {
    console.error(`user ${EMAIL} not found in auth.users`);
    process.exit(1);
  }

  console.log(`[user] ${EMAIL}  uid=${user.id}`);

  const { data: existing } = await admin
    .from('user_roles')
    .select('id, role, is_active')
    .eq('user_id', user.id);

  console.log(`[current roles]`);
  (existing || []).forEach(r => console.log(`   ${r.role}  is_active=${r.is_active}`));

  const already = (existing || []).some(r => r.role === 'PLATFORM_MASTER' && r.is_active);
  if (already) {
    console.log(`\n✅ already has PLATFORM_MASTER — nothing to do`);
    return;
  }

  console.log(`\n[plan] INSERT user_roles { role: PLATFORM_MASTER, is_active: true }`);

  if (!APPLY) {
    console.log(`(dry-run) rerun with --apply to execute`);
    return;
  }

  const { error } = await admin.from('user_roles').insert({
    user_id: user.id,
    role: 'PLATFORM_MASTER',
    is_active: true,
  });

  if (error) {
    console.error(`❌ insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`✅ PLATFORM_MASTER granted to ${EMAIL}`);
}

main().catch(e => { console.error(e); process.exit(1); });
