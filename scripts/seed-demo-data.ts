/**
 * Seed realistic demo data for tax firm sales presentations.
 *
 * Creates:
 * 1. Demo external tax_partner "PT Mitra Pajak Demo"
 * 2. Demo consultant account (demo.consultant@mitrapajak.com)
 * 3. Three realistic Indonesian client companies:
 *    - PT Maju Jaya (trading, 15 employees)
 *    - CV Berkah Sentosa (service, 8 employees)
 *    - Budi Santoso (individual freelancer)
 * 4. Sample billing transactions for each
 *
 * Run: SEED_TARGET=prod npx tsx scripts/seed-demo-data.ts
 *
 * Idempotent — safe to re-run.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PASSWORD = 'DemoPassword123!';
const PLATFORM_ID = '00000000-0000-0000-0000-000000000002';

// Fixed UUIDs for idempotent upserts
const DEMO_PARTNER_ID    = '00000000-0000-0000-0000-d00000000001';
const DEMO_CONSULTANT_ID = '00000000-0000-0000-0000-d00000000002';
const DEMO_CUSTOMER_1_ID = '00000000-0000-4000-8000-d00000000010'; // PT Maju Jaya
const DEMO_CUSTOMER_2_ID = '00000000-0000-4000-8000-d00000000011'; // CV Berkah Sentosa
const DEMO_CUSTOMER_3_ID = '00000000-0000-4000-8000-d00000000012'; // Budi Santoso

async function findOrCreateUser(email: string, fullName: string, role: string) {
  // Try to create; if exists, sign in to get user_id
  const { data: createData } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  let userId: string;
  if (createData?.user?.id) {
    userId = createData.user.id;
    console.log(`   ✅ auth user created: ${email}`);
  } else {
    // Already exists — sign in to get id
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (!signIn?.user?.id) {
      console.error(`   ❌ cannot find user ${email}`);
      throw new Error(`Cannot find user ${email}`);
    }
    userId = signIn.user.id;
    console.log(`   ⏭️  auth user exists: ${email}`);
  }

  // Upsert role
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('user_roles').insert({
    user_id: userId,
    role,
    is_active: true,
  });

  return userId;
}

async function main() {
  console.log('🎯 세무사 데모 데이터 시드\n');

  // ── 1. Demo tax partner ──
  console.log('━━ 1. Demo 세무사무소 ━━');
  const { error: tpErr } = await supabase.from('tax_partner').upsert({
    id: DEMO_PARTNER_ID,
    platform_id: PLATFORM_ID,
    name: 'PT Mitra Pajak Demo',
    legal_name: 'PT Mitra Pajak Demo',
    partner_type: 'EXTERNAL',
    is_default_filing_partner: false,
    is_active: true,
  }, { onConflict: 'id' });
  if (tpErr) console.error('   ❌ tax_partner:', tpErr.message);
  else console.log('   ✅ tax_partner: PT Mitra Pajak Demo');

  // ── 2. Demo consultant ──
  console.log('\n━━ 2. Demo 컨설턴트 ━━');
  const consultantUserId = await findOrCreateUser(
    'demo.consultant@mitrapajak.com',
    'Sarah Kim (Demo)',
    'CONSULTANT',
  );

  const { error: cErr } = await supabase.from('consultant').upsert({
    id: DEMO_CONSULTANT_ID,
    tax_partner_id: DEMO_PARTNER_ID,
    user_id: consultantUserId,
    full_name: 'Sarah Kim (Demo)',
    email: 'demo.consultant@mitrapajak.com',
    is_active: true,
  }, { onConflict: 'id' });
  if (cErr) console.error('   ❌ consultant:', cErr.message);
  else console.log('   ✅ consultant: Sarah Kim');

  // ── 3. Demo customers (3 companies + 1 individual) ──
  console.log('\n━━ 3. Demo 고객 3곳 ━━');

  const customers = [
    {
      id: DEMO_CUSTOMER_1_ID,
      customer_type: 'COMPANY',
      full_name: 'PT Maju Jaya',
      company_name: 'PT Maju Jaya',
      email: 'finance@majujaya.co.id',
      npwp: '0112345678901000',
      address: 'Jl. Gatot Subroto No. 12, Jakarta Selatan',
      business_category: 'TRADING',
      legal_form: 'PT',
      established_year: 2018,
      annual_revenue: 8_500_000_000,
      has_employees: true,
      employee_count: 15,
      is_pkp: true,
      is_umkm: false,
      pays_service_fees: true,
    },
    {
      id: DEMO_CUSTOMER_2_ID,
      customer_type: 'COMPANY',
      full_name: 'CV Berkah Sentosa',
      company_name: 'CV Berkah Sentosa',
      email: 'admin@berkahsentosa.com',
      npwp: '0298765432109000',
      address: 'Jl. Raya Bogor KM 25, Depok',
      business_category: 'SERVICE',
      legal_form: 'CV',
      established_year: 2020,
      annual_revenue: 2_800_000_000,
      has_employees: true,
      employee_count: 8,
      is_pkp: true,
      is_umkm: false,
      pays_service_fees: true,
    },
    {
      id: DEMO_CUSTOMER_3_ID,
      customer_type: 'INDIVIDUAL',
      full_name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      npwp: '3456789012345678',
      address: 'Jl. Kemang Raya No. 55, Jakarta Selatan',
      business_category: 'FREELANCER',
    },
  ];

  for (const cust of customers) {
    const { error } = await supabase.from('customer').upsert(cust, { onConflict: 'id' });
    if (error) console.error(`   ❌ ${cust.full_name}:`, error.message);
    else console.log(`   ✅ ${cust.full_name} (${cust.customer_type})`);
  }

  // ── 4. Customer-consultant assignments ──
  console.log('\n━━ 4. 고객-컨설턴트 배정 ━━');
  for (const cust of customers) {
    await supabase.from('customer_consultant').delete().eq('customer_id', cust.id);
    const { error } = await supabase.from('customer_consultant').insert({
      customer_id: cust.id,
      consultant_id: DEMO_CONSULTANT_ID,
      is_active: true,
    });
    if (error) console.error(`   ❌ ${cust.full_name}:`, error.message);
    else console.log(`   ✅ ${cust.full_name} → Sarah Kim`);
  }

  // ── 5. Demo subscription (Growth tier, active) ──
  console.log('\n━━ 5. Growth 플랜 구독 (데모용 직접 활성화) ━━');
  // Delete existing demo subscriptions first
  await supabase.from('tax_partner_subscription')
    .delete()
    .eq('tax_partner_id', DEMO_PARTNER_ID);

  const { error: subErr } = await supabase.from('tax_partner_subscription').insert({
    tax_partner_id: DEMO_PARTNER_ID,
    tier_id: 'GROWTH',
    tier_name: 'Growth (Demo)',
    price_idr: 0, // free trial
    billing_cycle: 'MONTHLY',
    max_clients: 50,
    status: 'ACTIVE',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    created_by_user_id: consultantUserId,
    paid_at: new Date().toISOString(),
  });
  if (subErr) console.error('   ❌ subscription:', subErr.message);
  else console.log('   ✅ Growth 플랜 ACTIVE (90일 무료 체험)');

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log('✨ 데모 데이터 시드 완료\n');
  console.log('📋 데모 계정:');
  console.log(`   이메일: demo.consultant@mitrapajak.com`);
  console.log(`   비밀번호: ${PASSWORD}`);
  console.log(`   사무소: PT Mitra Pajak Demo (EXTERNAL)`);
  console.log(`   플랜: Growth (90일 무료 체험, ACTIVE)`);
  console.log('\n📋 데모 고객:');
  console.log('   1. PT Maju Jaya (법인, 매출 85억, 직원 15명, PKP)');
  console.log('   2. CV Berkah Sentosa (법인, 매출 28억, 직원 8명, PKP)');
  console.log('   3. Budi Santoso (개인, 프리랜서)');
  console.log('\n🔗 로그인: https://ai-pajak.vercel.app/ko/login');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
