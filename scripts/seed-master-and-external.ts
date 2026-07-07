/**
 * Seed Master + External Consultant Test Accounts
 *
 * Run with: npx tsx scripts/seed-master-and-external.ts
 *
 * Creates:
 * - master.test@aipajak.com           — TAX_OPERATOR_MASTER + PLATFORM_MASTER 겸직 (P6.1)
 * - operator.test@aipajak.com         — TAX_OPERATOR
 * - supervisor.test@aipajak.com       — TAX_OPERATOR_SUPERVISOR
 * - PT Mitra Pajak Sentosa            — EXTERNAL tax_partner (Phase B-1)
 * - external.consultant@mitrapajak.com — consultant of PT Mitra Pajak Sentosa
 * - firmadmin.test@mitrapajak.com     — FIRM_ADMIN of PT Mitra Pajak Sentosa (P6.5)
 * - external.customer@mitrapajak.com  — sample COMPANY customer scoped to PT Mitra
 *
 * Idempotent: re-running upserts existing rows.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// SEED_TARGET=prod  → .env.production.local (Vercel/Supabase production)
// otherwise        → .env.local              (local Supabase via Docker)
const envFile = process.env.SEED_TARGET === 'prod'
  ? '.env.production.local'
  : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 Loaded env from ${envFile}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'TestPassword123!';

interface TestUser {
  email: string;
  fullName: string;
  roles: string[]; // 첫 번째가 primary (user_metadata.role)
}

const OPERATOR_USERS: TestUser[] = [
  { email: 'operator.test@aipajak.com',   fullName: 'Olivia Operator',   roles: ['TAX_OPERATOR'] },
  { email: 'supervisor.test@aipajak.com', fullName: 'Sam Supervisor',    roles: ['TAX_OPERATOR_SUPERVISOR'] },
  // P6.1 (2026-07-07): master.test 는 JTC 신고운영 마스터 + MonoFlip 마스터 겸직
  { email: 'master.test@aipajak.com',     fullName: 'Mia Master',        roles: ['TAX_OPERATOR_MASTER', 'PLATFORM_MASTER'] },
];

const EXT_CONSULTANT_EMAIL  = 'external.consultant@mitrapajak.com';
const EXT_CONSULTANT_NAME   = 'Eddy External Consultant';
const FIRM_ADMIN_EMAIL      = 'firmadmin.test@mitrapajak.com';
const FIRM_ADMIN_NAME       = 'Fira Firm Admin';
const EXT_CUSTOMER_EMAIL    = 'external.customer@mitrapajak.com';
const EXT_CUSTOMER_NAME     = 'PT Klien Eksternal';

// Fixed UUIDs so re-runs upsert deterministically
const EXTERNAL_PARTNER_ID    = '00000000-0000-0000-0000-000000000040';
const EXTERNAL_CONSULTANT_ID = '00000000-0000-0000-0000-000000000041';
const EXTERNAL_CUSTOMER_ID   = '00000000-0000-0000-0000-000000000042';
const FIRM_ADMIN_CONSULTANT_ID = '00000000-0000-0000-0000-000000000043';

// JTC platform_id from seed-test-users.ts
const PLATFORM_ID = '00000000-0000-0000-0000-000000000002';

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Resolve a user id by signing in with the test password.
 *
 * Prod Supabase's `auth.admin.listUsers` returns 500
 * ("Database error finding users") on this database, so we cannot page through
 * the user table. Instead we try to sign in with the well-known test password
 * — this returns the user id when the account exists.
 */
async function findUserIdBySignIn(email: string): Promise<string | null> {
  if (!supabaseAnonKey) return null;
  const c = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user?.id) return null;
  return data.user.id;
}

async function findOrCreateUser(email: string, fullName: string, roles: string[]) {
  let userId: string | null = null;

  // Try create first — if email already exists, fall back to sign-in lookup.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: roles[0] },
  });
  if (error) {
    if ((error as { code?: string }).code === 'email_exists') {
      userId = await findUserIdBySignIn(email);
      if (!userId) {
        console.error(`❌ ${email} exists but sign-in failed — password may have been changed.`);
        throw error;
      }
      console.log(`⏭️  ${email} already exists`);
    } else {
      console.error(`❌ Failed to create ${email}:`, error.message);
      throw error;
    }
  } else {
    userId = data.user.id;
    console.log(`✅ Created auth user: ${email}`);
  }

  // Upsert user_roles (겸직 지원 — master.test 는 2 role)
  await supabase.from('user_roles').delete().eq('user_id', userId);
  const { error: roleErr } = await supabase.from('user_roles').insert(
    roles.map((role) => ({
      user_id: userId,
      role,
      is_active: true,
      organization_id: null,
      organization_type: null,
    })),
  );
  if (roleErr) {
    console.error(`   ⚠️  user_roles error:`, roleErr.message);
  } else {
    console.log(`   ✅ roles=${roles.join(', ')}`);
  }

  return userId;
}

async function seedOperatorTeam() {
  console.log('\n🌱 Operator team (Operator / Supervisor / Master)...');
  for (const u of OPERATOR_USERS) {
    await findOrCreateUser(u.email, u.fullName, u.roles);
  }
}

async function seedExternalPartner() {
  console.log('\n🌱 External tax_partner: PT Mitra Pajak Sentosa...');

  const { error: tpErr } = await supabase.from('tax_partner').upsert(
    {
      id: EXTERNAL_PARTNER_ID,
      platform_id: PLATFORM_ID,
      name: 'PT Mitra Pajak Sentosa',
      legal_name: 'PT Mitra Pajak Sentosa',
      partner_type: 'EXTERNAL',
      is_default_filing_partner: false,
      is_active: true,
    },
    { onConflict: 'id' },
  );
  if (tpErr) {
    console.error('❌ tax_partner upsert error:', tpErr.message);
    return;
  }
  console.log('✅ tax_partner upserted (EXTERNAL)');

  // Auth user for the consultant
  const consultantUserId = await findOrCreateUser(
    EXT_CONSULTANT_EMAIL,
    EXT_CONSULTANT_NAME,
    ['CONSULTANT'], // role name preserved for backward compat per Phase B-1 doc
  );

  const { error: cErr } = await supabase.from('consultant').upsert(
    {
      id: EXTERNAL_CONSULTANT_ID,
      tax_partner_id: EXTERNAL_PARTNER_ID,
      user_id: consultantUserId,
      full_name: EXT_CONSULTANT_NAME,
      email: EXT_CONSULTANT_EMAIL,
      is_active: true,
    },
    { onConflict: 'id' },
  );
  if (cErr) {
    console.error('❌ consultant upsert error:', cErr.message);
    return;
  }
  console.log('✅ consultant upserted (linked to PT Mitra)');

  // P6.5 (2026-07-07): FIRM_ADMIN — 세무컨설팅 법인 관리자.
  // requireFirmAdmin 게이트 요건: FIRM_ADMIN role + active consultant row
  // + EXTERNAL tax_partner 연결. consultant row 로 tenant 소속을 표현한다.
  const firmAdminUserId = await findOrCreateUser(
    FIRM_ADMIN_EMAIL,
    FIRM_ADMIN_NAME,
    ['FIRM_ADMIN'],
  );

  const { error: faErr } = await supabase.from('consultant').upsert(
    {
      id: FIRM_ADMIN_CONSULTANT_ID,
      tax_partner_id: EXTERNAL_PARTNER_ID,
      user_id: firmAdminUserId,
      full_name: FIRM_ADMIN_NAME,
      email: FIRM_ADMIN_EMAIL,
      is_active: true,
    },
    { onConflict: 'id' },
  );
  if (faErr) {
    console.error('❌ firm admin consultant upsert error:', faErr.message);
    return;
  }
  console.log('✅ firm admin upserted (FIRM_ADMIN of PT Mitra)');

  // Sample COMPANY customer under this external partner — no auth user needed
  // (Phase B-2 made customer.user_id nullable)
  const { error: custErr } = await supabase.from('customer').upsert(
    {
      id: EXTERNAL_CUSTOMER_ID,
      user_id: null,
      customer_type: 'COMPANY',
      full_name: EXT_CUSTOMER_NAME,
      company_name: EXT_CUSTOMER_NAME,
      email: EXT_CUSTOMER_EMAIL,
      npwp: '0987654321098000',
      address: 'Jl. Thamrin No. 99, Jakarta Pusat',
      business_category: 'TRADING',
      legal_form: 'PT',
      established_year: 2022,
      is_pkp: true,
      is_umkm: false,
    },
    { onConflict: 'id' },
  );
  if (custErr) {
    console.error('❌ external customer upsert error:', custErr.message);
    return;
  }
  console.log('✅ sample customer upserted (PT Klien Eksternal)');

  // Customer-consultant assignment (scoped to external partner)
  await supabase
    .from('customer_consultant')
    .delete()
    .eq('customer_id', EXTERNAL_CUSTOMER_ID);

  const { error: ccErr } = await supabase.from('customer_consultant').insert({
    customer_id: EXTERNAL_CUSTOMER_ID,
    consultant_id: EXTERNAL_CONSULTANT_ID,
    is_active: true,
  });
  if (ccErr) {
    console.error('❌ customer_consultant assignment error:', ccErr.message);
  } else {
    console.log('✅ customer_consultant assignment created');
  }
}

async function main() {
  console.log('🌱 Seeding Master + External test accounts...\n');
  await seedOperatorTeam();
  await seedExternalPartner();

  console.log('\n✨ Done.\n');
  console.log('Operator team accounts:');
  for (const u of OPERATOR_USERS) {
    console.log(`  - ${u.email} / ${PASSWORD} (${u.roles.join(' + ')})`);
  }
  console.log('\nExternal sub-tenant:');
  console.log(`  - ${EXT_CONSULTANT_EMAIL} / ${PASSWORD} (CONSULTANT of PT Mitra Pajak Sentosa)`);
  console.log(`  - ${FIRM_ADMIN_EMAIL} / ${PASSWORD} (FIRM_ADMIN of PT Mitra Pajak Sentosa)`);
  console.log(`  - sample customer: ${EXT_CUSTOMER_NAME} (no auth user)`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
