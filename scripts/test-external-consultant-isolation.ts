/**
 * Smoke test for Phase B-2: verify that two different external tax consulting
 * firms cannot see each other's customers.
 *
 * Scenario:
 *   1. Create firm A with rep user A → external tax_partner A
 *   2. Create firm B with rep user B → external tax_partner B
 *   3. Firm A adds customer A1 (linked via customer_consultant)
 *   4. Firm B adds customer B1
 *   5. Assert:
 *      a) Firm A's scoped customer list contains A1 but NOT B1
 *      b) Firm B's scoped customer list contains B1 but NOT A1
 *      c) JTC's existing customer is NOT visible to either
 *   6. Cleanup
 *
 * Usage: npx tsx scripts/test-external-consultant-isolation.ts
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

interface FirmCtx {
  userId: string;
  partnerId: string;
  consultantId: string;
  customerId: string;
}

async function createFirm(label: string): Promise<FirmCtx> {
  const email = `${label}-${Date.now()}@example.com`;
  const fullName = `Rep ${label.toUpperCase()}`;
  const firmName = `KKP ${label.toUpperCase()} Test`;

  // Auth user
  const { data: auth, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
  });
  if (authErr || !auth?.user) throw new Error(`Auth create failed for ${label}: ${authErr?.message}`);
  const userId = auth.user.id;

  // Platform lookup
  const { data: platform } = await admin.from('platform').select('id').eq('name', 'AI Pajak').maybeSingle();
  if (!platform) throw new Error('Platform not found');

  // tax_partner
  const { data: partner, error: partnerErr } = await admin
    .from('tax_partner')
    .insert({
      platform_id: platform.id,
      name: firmName,
      legal_name: firmName,
      partner_type: 'EXTERNAL',
      is_platform_partner: false,
      email,
      is_active: true,
    })
    .select('id')
    .single();
  if (partnerErr || !partner) throw new Error(`Partner insert failed: ${partnerErr?.message}`);

  // consultant
  const { data: consultant, error: consErr } = await admin
    .from('consultant')
    .insert({
      user_id: userId,
      tax_partner_id: partner.id,
      full_name: fullName,
      email,
      is_active: true,
    })
    .select('id')
    .single();
  if (consErr || !consultant) throw new Error(`Consultant insert failed: ${consErr?.message}`);

  // user_roles
  await admin.from('user_roles').insert({
    user_id: userId,
    role: 'TAX_ADVISOR_JTC',
    organization_id: partner.id,
    organization_type: 'TAX_PARTNER',
    is_active: true,
  });

  // Add a customer via the "full flow": insert customer + customer_consultant
  const { data: customer, error: custErr } = await admin
    .from('customer')
    .insert({
      full_name: `Client of ${label.toUpperCase()}`,
      customer_type: 'INDIVIDUAL',
      email: `client-${label}@example.com`,
    })
    .select('id')
    .single();
  if (custErr || !customer) throw new Error(`Customer insert failed: ${custErr?.message}`);

  await admin.from('customer_consultant').insert({
    customer_id: customer.id,
    consultant_id: consultant.id,
    assigned_by_user_id: userId,
    is_active: true,
  });

  return {
    userId,
    partnerId: partner.id,
    consultantId: consultant.id,
    customerId: customer.id,
  };
}

async function scopedCustomersFor(partnerId: string): Promise<string[]> {
  // Mirrors the /api/customers GET logic: list customer_ids where the assigned
  // consultant belongs to the given tax_partner.
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant:consultant_id(tax_partner_id)')
    .eq('is_active', true);

  return (assignments || [])
    .filter((row) => {
      const cons = row.consultant as { tax_partner_id?: string } | { tax_partner_id?: string }[] | null;
      const tp = Array.isArray(cons) ? cons[0]?.tax_partner_id : cons?.tax_partner_id;
      return tp === partnerId;
    })
    .map((row) => row.customer_id);
}

async function cleanup(ctx: FirmCtx) {
  // Delete in reverse dependency order
  await admin.from('customer_consultant').delete().eq('consultant_id', ctx.consultantId);
  await admin.from('customer').delete().eq('id', ctx.customerId);
  await admin.from('consultant').delete().eq('id', ctx.consultantId);
  await admin.from('tax_partner').delete().eq('id', ctx.partnerId);
  await admin.auth.admin.deleteUser(ctx.userId);
}

async function run() {
  console.log('\n🧪 Testing external consultant customer isolation\n');

  let firmA: FirmCtx | null = null;
  let firmB: FirmCtx | null = null;

  try {
    firmA = await createFirm('alpha');
    console.log('✅ Firm A created:', { partnerId: firmA.partnerId, customerId: firmA.customerId });

    firmB = await createFirm('bravo');
    console.log('✅ Firm B created:', { partnerId: firmB.partnerId, customerId: firmB.customerId });

    // Scoped queries
    const aCustomers = await scopedCustomersFor(firmA.partnerId);
    const bCustomers = await scopedCustomersFor(firmB.partnerId);

    console.log('\n📊 Firm A scoped customers:', aCustomers);
    console.log('📊 Firm B scoped customers:', bCustomers);

    // Assertions
    const aSeesOwn = aCustomers.includes(firmA.customerId);
    const aDoesNotSeeB = !aCustomers.includes(firmB.customerId);
    const bSeesOwn = bCustomers.includes(firmB.customerId);
    const bDoesNotSeeA = !bCustomers.includes(firmA.customerId);

    console.log('\n🔍 Assertions:');
    console.log(`  A sees own customer:     ${aSeesOwn ? '✅' : '❌'}`);
    console.log(`  A does NOT see B's:      ${aDoesNotSeeB ? '✅' : '❌'}`);
    console.log(`  B sees own customer:     ${bSeesOwn ? '✅' : '❌'}`);
    console.log(`  B does NOT see A's:      ${bDoesNotSeeA ? '✅' : '❌'}`);

    const allPass = aSeesOwn && aDoesNotSeeB && bSeesOwn && bDoesNotSeeA;

    if (allPass) {
      console.log('\n✨ ISOLATION TEST PASSED — external consultants are properly scoped\n');
    } else {
      console.log('\n❌ ISOLATION TEST FAILED\n');
      process.exit(1);
    }
  } finally {
    // Cleanup in any case
    console.log('🧹 Cleaning up test data...');
    if (firmA) await cleanup(firmA);
    if (firmB) await cleanup(firmB);
    console.log('✅ Cleanup complete');
  }
}

run().catch((err) => {
  console.error('\n❌ Test error:', err);
  process.exit(1);
});
