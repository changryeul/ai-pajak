/**
 * Verify RLS Isolation between JTC and EXTERNAL tax_partner consultants.
 *
 * Run with:
 *   SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts
 *
 * For each consultant test account, log in with anon key (RLS active),
 * fetch customer rows, and assert that:
 *   - JTC consultants see ONLY JTC-assigned customers
 *   - EXTERNAL consultant sees ONLY PT Mitra customers
 *   - Neither sees customers across the boundary
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const PASSWORD = 'TestPassword123!';

interface TestCase {
  email: string;
  expectedPartner: string;
  description: string;
}

const CASES: TestCase[] = [
  {
    email: 'consultant.test@jakartatax.co.id',
    expectedPartner: 'JTC',
    description: 'JTC 일반 컨설턴트 — JTC 고객만 보여야 함',
  },
  {
    email: 'advisor.test@jakartatax.co.id',
    expectedPartner: 'JTC',
    description: 'JTC 선임 세무사 — JTC 고객만 보여야 함',
  },
  {
    email: 'external.consultant@mitrapajak.com',
    expectedPartner: 'EXTERNAL',
    description: '외부 사무소 컨설턴트 — PT Mitra 고객만 보여야 함',
  },
];

async function runCase(tc: TestCase) {
  console.log(`\n━━ ${tc.email}`);
  console.log(`   ${tc.description}`);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signIn, error: signErr } = await client.auth.signInWithPassword({
    email: tc.email,
    password: PASSWORD,
  });

  if (signErr || !signIn.session) {
    console.error(`   ❌ login failed: ${signErr?.message || 'no session'}`);
    return;
  }
  console.log(`   ✅ logged in (uid=${signIn.user.id.slice(0, 8)}…)`);

  // Fetch customers visible to this consultant under RLS
  const { data: customers, error: custErr } = await client
    .from('customer')
    .select('id, full_name, customer_type');

  if (custErr) {
    console.error(`   ❌ customer query error: ${custErr.message}`);
    await client.auth.signOut();
    return;
  }

  console.log(`   📊 visible customers: ${customers?.length ?? 0}`);
  customers?.forEach((c) => {
    console.log(`      - ${c.full_name} (${c.customer_type})`);
  });

  // Boundary check: JTC consultant should NOT see PT Klien Eksternal,
  // EXTERNAL consultant should NOT see PT Example Indonesia or John Doe Test.
  const sawJTCNames = customers?.some((c) =>
    ['John Doe Test', 'PT Example Indonesia'].includes(c.full_name),
  );
  const sawExternalName = customers?.some((c) => c.full_name === 'PT Klien Eksternal');

  if (tc.expectedPartner === 'JTC') {
    if (sawExternalName) {
      console.error('   🚨 LEAK: JTC consultant saw PT Klien Eksternal — RLS isolation broken!');
    } else if (!sawJTCNames) {
      console.warn('   ⚠️  JTC consultant has no JTC customers visible (assignments may be missing).');
    } else {
      console.log('   ✅ Isolation OK: JTC scope respected.');
    }
  }
  if (tc.expectedPartner === 'EXTERNAL') {
    if (sawJTCNames) {
      console.error('   🚨 LEAK: EXTERNAL consultant saw JTC customers — RLS isolation broken!');
    } else if (!customers?.some((c) => c.full_name === 'PT Klien Eksternal')) {
      console.warn('   ⚠️  EXTERNAL consultant cannot see PT Klien Eksternal (assignment missing?).');
    } else {
      console.log('   ✅ Isolation OK: EXTERNAL scope respected.');
    }
  }

  await client.auth.signOut();
}

async function main() {
  console.log('🔒 RLS isolation verification\n');
  for (const tc of CASES) {
    await runCase(tc);
  }
  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
