/**
 * Smoke test for GET /api/tax/quarterly-trend.
 *
 * 1. log in as COMPANY customer
 * 2. seed two tax_monthly_payment rows (one current year Q1, one prev year Q1)
 * 3. call /api/tax/quarterly-trend (default years = curr + prev)
 * 4. assert shape: { years, taxTypes, quarters, yoy[Q1].deltaPct != null }
 * 5. cleanup seeded rows
 *
 * Run:
 *   SEED_TARGET=prod npx tsx scripts/test-quarterly-trend.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
console.log(`🌐 ${baseUrl}\n`);

const COMPANY_EMAIL = 'company.test@example.com';
const PASSWORD = 'TestPassword123!';

async function login(email: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`✗ login: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function api(p: string, token: string) {
  const r = await fetch(`${baseUrl}${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function run() {
  console.log('🧪 Quarterly trend smoke test\n');
  let pass = 0;
  let fail = 0;

  const tok = await login(COMPANY_EMAIL);
  if (!tok) process.exit(1);
  console.log('✅ logged in');

  const admin = createClient(url, serviceKey);
  const { data: customer } = await admin
    .from('customer')
    .select('id')
    .eq('email', COMPANY_EMAIL)
    .single();
  if (!customer) {
    console.error('customer not found');
    process.exit(1);
  }
  const customerId = customer.id;

  const now = new Date();
  const currYear = now.getFullYear();
  const prevYear = currYear - 1;

  // Clean any prior smoke rows
  await admin
    .from('tax_monthly_payment')
    .delete()
    .eq('customer_id', customerId)
    .in('tax_period', [`${currYear}-02`, `${prevYear}-02`])
    .eq('tax_type', 'PPh21');

  console.log(`\n━━ 1. seed monthly payments (Q1 curr=${currYear}, prev=${prevYear}) ━━`);
  const seed = await admin.from('tax_monthly_payment').insert([
    {
      customer_id: customerId,
      tax_type: 'PPh21',
      tax_period: `${currYear}-02`,
      tax_year: currYear,
      amount_due: 5_000_000,
      amount_paid: 5_000_000,
    },
    {
      customer_id: customerId,
      tax_type: 'PPh21',
      tax_period: `${prevYear}-02`,
      tax_year: prevYear,
      amount_due: 4_000_000,
      amount_paid: 4_000_000,
    },
  ]);
  if (seed.error) {
    console.error('   ✗ seed failed', seed.error);
    process.exit(1);
  }
  console.log('   ✅ seeded 2 payments');

  console.log('\n━━ 2. GET /api/tax/quarterly-trend ━━');
  const r1 = await api('/api/tax/quarterly-trend', tok);
  if (r1.status !== 200 || !r1.body.success) {
    console.error('   ✗ failed', r1);
    fail++;
  } else if (!Array.isArray(r1.body.data?.years) || r1.body.data.years.length < 2) {
    console.error('   ✗ years missing', r1.body.data);
    fail++;
  } else if (!Array.isArray(r1.body.data?.quarters)) {
    console.error('   ✗ quarters missing', r1.body.data);
    fail++;
  } else {
    type Q = { year: number; quarter: number; total: number; byType: Record<string, number> };
    const q1Curr = (r1.body.data.quarters as Q[]).find(
      (q) => q.year === currYear && q.quarter === 1,
    );
    const q1Prev = (r1.body.data.quarters as Q[]).find(
      (q) => q.year === prevYear && q.quarter === 1,
    );
    if (!q1Curr || q1Curr.total < 5_000_000) {
      console.error('   ✗ curr Q1 total wrong', q1Curr);
      fail++;
    } else if (!q1Prev || q1Prev.total < 4_000_000) {
      console.error('   ✗ prev Q1 total wrong', q1Prev);
      fail++;
    } else if (q1Curr.byType?.PPh21 !== 5_000_000) {
      console.error('   ✗ curr Q1 byType.PPh21 wrong', q1Curr.byType);
      fail++;
    } else {
      console.log(
        `   ✅ Q1 curr=${q1Curr.total} (PPh21=${q1Curr.byType.PPh21}), prev=${q1Prev.total}, taxTypes=${(r1.body.data.taxTypes as string[]).join(',')}`,
      );
      pass++;
    }
    const yoy = r1.body.data.yoy as Array<{ quarter: number; deltaPct: number | null }> | null;
    const yoyQ1 = yoy?.find((y) => y.quarter === 1);
    if (!yoyQ1 || yoyQ1.deltaPct == null) {
      console.error('   ✗ yoy Q1 deltaPct null', yoyQ1);
      fail++;
    } else {
      console.log(`   ✅ yoy Q1 deltaPct=${yoyQ1.deltaPct.toFixed(1)}%`);
      pass++;
    }
  }

  console.log('\n━━ 3. ?years filter respects param ━━');
  const r2 = await api(`/api/tax/quarterly-trend?years=${prevYear}`, tok);
  if (r2.status !== 200 || r2.body.data?.years?.length !== 1 || r2.body.data.years[0] !== prevYear) {
    console.error('   ✗ years filter ignored', r2.body.data?.years);
    fail++;
  } else {
    console.log(`   ✅ years filter respected (${prevYear} only)`);
    pass++;
  }

  console.log('\n🧹 cleanup');
  await admin
    .from('tax_monthly_payment')
    .delete()
    .eq('customer_id', customerId)
    .in('tax_period', [`${currYear}-02`, `${prevYear}-02`])
    .eq('tax_type', 'PPh21');
  console.log('   ✓ removed seeded rows');

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
