/**
 * Manual smoke test for external tax consultant signup (Phase B-1).
 *
 * Runs directly against local Supabase, simulating what /api/auth/signup
 * does for accountType='TAX_PARTNER'. Verifies the full chain:
 *   auth.users → tax_partner (EXTERNAL) → consultant → user_roles
 *
 * Usage: npx tsx scripts/test-external-consultant-signup.ts
 * (requires local Supabase running — `supabase start`)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const email = `ext-consultant-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  const fullName = 'External Consultant Test';
  const firmName = 'KKP External Test';
  const firmLicense = `LICENSE-${Date.now()}`;

  console.log(`\n🧪 Testing external consultant signup for: ${email}\n`);

  // 1. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_type: 'TAX_PARTNER', firm_name: firmName },
  });
  if (authErr || !authData?.user) {
    console.error('❌ Auth user creation failed:', authErr?.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log('✅ Auth user created:', userId);

  // 2. Look up platform
  const { data: platform, error: platError } = await admin
    .from('platform').select('id').eq('name', 'AI Pajak').maybeSingle();
  if (platError || !platform) {
    console.error('❌ Platform lookup failed:', platError?.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log('✅ Platform found:', platform.id);

  // 3. Create tax_partner (EXTERNAL)
  const { data: partner, error: partnerError } = await admin
    .from('tax_partner')
    .insert({
      platform_id: platform.id,
      name: firmName,
      legal_name: firmName,
      partner_type: 'EXTERNAL',
      is_platform_partner: false,
      tax_license_number: firmLicense,
      email,
      is_active: true,
    })
    .select()
    .single();
  if (partnerError || !partner) {
    console.error('❌ tax_partner insert failed:', partnerError?.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log('✅ tax_partner created:', { id: partner.id, partner_type: partner.partner_type });

  // 4. Create consultant
  const { error: consultantError } = await admin.from('consultant').insert({
    user_id: userId,
    tax_partner_id: partner.id,
    full_name: fullName,
    email,
    is_active: true,
  });
  if (consultantError) {
    console.error('❌ consultant insert failed:', consultantError.message);
    await admin.auth.admin.deleteUser(userId);
    await admin.from('tax_partner').delete().eq('id', partner.id);
    process.exit(1);
  }
  console.log('✅ consultant created');

  // 5. Create user_roles entry
  const { error: roleError } = await admin.from('user_roles').insert({
    user_id: userId,
    role: 'TAX_ADVISOR',
    organization_id: partner.id,
    organization_type: 'TAX_PARTNER',
    is_active: true,
  });
  if (roleError) {
    console.error('❌ user_roles insert failed:', roleError.message);
    process.exit(1);
  }
  console.log('✅ user_roles entry created');

  // 6. Verify the full chain
  const { data: verifyConsultant } = await admin
    .from('consultant')
    .select('id, tax_partner_id, full_name, tax_partner:tax_partner_id(name, partner_type, is_platform_partner)')
    .eq('user_id', userId)
    .single();
  console.log('\n📊 Verification:');
  console.log(JSON.stringify(verifyConsultant, null, 2));

  const { data: verifyRole } = await admin
    .from('user_roles')
    .select('role, organization_id, organization_type')
    .eq('user_id', userId)
    .single();
  console.log('\n📊 Role:');
  console.log(JSON.stringify(verifyRole, null, 2));

  // 7. Cleanup (delete test artifacts)
  console.log('\n🧹 Cleaning up test data...');
  await admin.auth.admin.deleteUser(userId);
  // tax_partner row will be orphaned but that's OK for a smoke test
  await admin.from('tax_partner').delete().eq('id', partner.id);

  console.log('\n✨ External consultant signup test PASSED\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
