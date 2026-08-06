/**
 * Ensure company.test@example.com is registered as a COMPANY customer.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts
 *
 * Independent of seed-test-users.ts because that script's listUsers() call
 * is paginated (default 50) and misses existing users on a populated DB.
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

const COMPANY_USER_EMAIL  = 'company.test@example.com';
const COMPANY_CUSTOMER_ID = '00000000-0000-4000-8000-000000000011';
const PASSWORD = 'TestPassword123!';

async function findUserByEmail(email: string): Promise<string | null> {
  // Try createUser first; if it returns "already registered", recover the
  // existing user by signing in with the known password. This avoids the
  // Supabase admin listUsers 500 issue on populated production databases.
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'PT Example Indonesia', role: 'CUSTOMER', customer_type: 'COMPANY' },
  });
  if (createData?.user?.id) return createData.user.id;

  if (createErr && /already been registered|already exists/i.test(createErr.message)) {
    // Sign in with anon key + password to retrieve the user id
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: signIn, error: signErr } = await anonClient.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signIn?.user?.id) return signIn.user.id;
    if (signErr) {
      console.error(`   ⚠️  signInWithPassword failed: ${signErr.message}`);
    }
    return null;
  }
  if (createErr) throw createErr;
  return null;
}

async function ensureCustomerRecord() {
  let userId = await findUserByEmail(COMPANY_USER_EMAIL);

  if (!userId) {
    console.log(`Creating auth user ${COMPANY_USER_EMAIL}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: COMPANY_USER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'PT Example Indonesia', role: 'CUSTOMER', customer_type: 'COMPANY' },
    });
    if (error) throw error;
    userId = data.user.id;
  }
  console.log(`👤 user_id = ${userId}`);

  // user_roles
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('user_roles').insert({
    user_id: userId,
    role: 'CUSTOMER',
    is_active: true,
    organization_id: null,
    organization_type: null,
  });
  console.log('✅ user_roles set: CUSTOMER');

  // customer record
  const { error: cErr } = await supabase.from('customer').upsert(
    {
      id: COMPANY_CUSTOMER_ID,
      user_id: userId,
      customer_type: 'COMPANY',
      full_name: 'PT Example Indonesia',
      company_name: 'PT Example Indonesia',
      email: COMPANY_USER_EMAIL,
      npwp: '0123456789012000',
      address: 'Jl. Sudirman No. 1, Jakarta Pusat',
      business_category: 'SERVICE',
      legal_form: 'PT',
      established_year: 2020,
      annual_revenue: 5_000_000_000,
      revenue_year: 2025,
      has_employees: true,
      employee_count: 10,
      is_pkp: true,
      is_umkm: false,
      pays_service_fees: true,
    },
    { onConflict: 'id' },
  );
  if (cErr) {
    console.error('❌ customer upsert error:', cErr.message);
    throw cErr;
  }
  console.log('✅ customer (COMPANY) upserted');

  // Assign to JTC consultant if available, so the customer has someone visible
  const { data: jtcConsultant } = await supabase
    .from('consultant')
    .select('id, tax_partner_id, tax_partner!inner(partner_type)')
    .eq('email', 'consultant.test@jakartatax.co.id')
    .maybeSingle();

  if (jtcConsultant?.id) {
    await supabase
      .from('customer_consultant')
      .delete()
      .eq('customer_id', COMPANY_CUSTOMER_ID);
    await supabase.from('customer_consultant').insert({
      customer_id: COMPANY_CUSTOMER_ID,
      consultant_id: jtcConsultant.id,
      is_active: true,
    });
    console.log('✅ customer_consultant assignment to JTC consultant');
  } else {
    console.log('⏭️  JTC consultant not found, skipping assignment');
  }

  console.log('\n✨ Done.');
  console.log(`   Login: ${COMPANY_USER_EMAIL} / ${PASSWORD}`);
}

ensureCustomerRecord().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
