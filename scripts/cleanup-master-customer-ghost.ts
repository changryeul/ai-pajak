/**
 * Clean up the ghost CUSTOMER role + customer record that was auto-created
 * for non-customer users (master, operators) by the dashboard's
 * setup-account fallback before the guard was added.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/cleanup-master-customer-ghost.ts
 *
 * Targets non-customer test accounts:
 *   - master.test@aipajak.com
 *   - supervisor.test@aipajak.com
 *   - operator.test@aipajak.com
 *
 * For each one, removes any user_roles row with role='CUSTOMER' and any
 * customer table row that matches user_id, ONLY when the user also has a
 * non-customer role (so we never accidentally delete a real customer).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const NON_CUSTOMER_ROLES = new Set([
  'CONSULTANT_JTC',
  'TAX_ADVISOR_JTC',
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
  'PLATFORM_ADMIN',
  'SYSTEM',
]);

const TARGETS = [
  'master.test@aipajak.com',
  'supervisor.test@aipajak.com',
  'operator.test@aipajak.com',
];

const PASSWORD = 'TestPassword123!';

async function findUserId(email: string): Promise<string | null> {
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) {
    console.error(`   ❌ login failed for ${email}: ${error?.message}`);
    return null;
  }
  await anon.auth.signOut();
  return data.user.id;
}

async function cleanupOne(email: string) {
  console.log(`\n━━ ${email}`);
  const userId = await findUserId(email);
  if (!userId) return;
  console.log(`   user_id: ${userId}`);

  const { data: roles } = await admin
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', userId);
  console.log(`   roles: ${roles?.map((r) => r.role).join(', ') ?? 'none'}`);

  const hasNonCustomerRole = roles?.some(
    (r) => r.is_active && NON_CUSTOMER_ROLES.has(r.role),
  );
  if (!hasNonCustomerRole) {
    console.log('   ⏭️  skipping — no non-customer role found, treating as a real customer');
    return;
  }

  const customerRoleRows = (roles ?? []).filter((r) => r.role === 'CUSTOMER');
  if (customerRoleRows.length === 0) {
    console.log('   ✅ no ghost CUSTOMER role to remove');
  } else {
    const { error: delRoleErr } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'CUSTOMER');
    if (delRoleErr) {
      console.error(`   ❌ failed to delete CUSTOMER role: ${delRoleErr.message}`);
    } else {
      console.log(`   🧹 removed ${customerRoleRows.length} CUSTOMER user_roles row(s)`);
    }
  }

  const { data: customerRow } = await admin
    .from('customer')
    .select('id, customer_type, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (!customerRow) {
    console.log('   ✅ no ghost customer record to remove');
  } else {
    console.log(`   found customer row: ${customerRow.id} (${customerRow.customer_type} - ${customerRow.full_name})`);
    // Detach assignments first to avoid FK issues
    await admin.from('customer_consultant').delete().eq('customer_id', customerRow.id);
    const { error: delCustErr } = await admin
      .from('customer')
      .delete()
      .eq('id', customerRow.id);
    if (delCustErr) {
      console.error(`   ❌ failed to delete customer: ${delCustErr.message}`);
    } else {
      console.log(`   🧹 deleted customer row + consultant assignments`);
    }
  }
}

async function main() {
  console.log('🧹 Master/operator ghost customer cleanup\n');
  for (const email of TARGETS) {
    await cleanupOne(email);
  }
  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
