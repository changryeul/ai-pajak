/**
 * 미배정 30건 중 스모크/테스트 잔재로 의심되는 행을 이메일 + 생성일 + NPWP 로
 * 재검토해서 진짜 삭제해도 되는지 사람이 눈으로 볼 수 있게 표로 뿌린다.
 *
 * 실행: npx tsx scripts/inspect-smoke-orphans.ts
 * 부수 효과 없음. 삭제 실행은 별도 스크립트.
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

async function main() {
  // 활성 customer_consultant 없는 customer 만 (unassigned queue 와 동일 필터)
  const { data: assigned } = await admin
    .from('customer_consultant')
    .select('customer_id')
    .eq('is_active', true);
  const assignedIds = new Set((assigned || []).map(r => r.customer_id));

  const { data: customers } = await admin
    .from('customer')
    .select('id, customer_type, full_name, company_name, npwp, email, created_at, user_id')
    .in('full_name', SMOKE_NAMES);

  const unassigned = (customers || []).filter(c => !assignedIds.has(c.id));

  console.log(`\n${unassigned.length} candidate row(s) to delete\n`);
  console.log('type | full_name           | email                              | npwp      | created            | has_auth');
  console.log('-'.repeat(120));
  for (const c of unassigned) {
    console.log(
      [
        c.customer_type.padEnd(4),
        (c.full_name || '').padEnd(19),
        (c.email || '').padEnd(34),
        (c.npwp || '-').padEnd(9),
        new Date(c.created_at).toISOString().slice(0, 19).replace('T', ' '),
        c.user_id ? 'yes' : 'no',
      ].join(' | '),
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });
