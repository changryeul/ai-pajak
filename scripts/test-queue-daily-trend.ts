/**
 * Smoke test for GET /api/operator/queue-daily-trend.
 *
 *  1. log in as TAX_OPERATOR_SUPERVISOR
 *  2. seed two djp_submission_queue rows with updated_at = today and yesterday
 *  3. call /api/operator/queue-daily-trend?days=7
 *  4. assert shape + that both days appear with the expected status counts
 *  5. assert default days=14 also works
 *  6. PLATFORM_ADMIN is blocked
 *  7. cleanup seeded rows
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

async function login(email: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email,
    password: 'TestPassword123!',
  });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
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

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function run() {
  console.log('🧪 queue-daily-trend smoke test\n');
  let pass = 0;
  let fail = 0;

  const supTok = await login('supervisor.test@aipajak.com');
  if (!supTok) process.exit(1);
  console.log('✅ supervisor logged in');

  const admin = createClient(url, serviceKey);

  // Pick a real customer id (foreign key on djp_submission_queue.customer_id).
  const { data: cust } = await admin
    .from('customer')
    .select('id')
    .eq('email', 'company.test@example.com')
    .single();
  if (!cust) {
    console.error('company customer not found');
    process.exit(1);
  }
  const customerId = cust.id;

  // Cleanup any prior smoke rows that might collide on the
  // UNIQUE(customer_id, tax_type, month, year) constraint.
  await admin
    .from('djp_submission_queue')
    .delete()
    .eq('customer_id', customerId)
    .like('notes', 'smoke-test:queue-daily-trend%');

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  console.log('\n━━ 1. seed 2 queue rows (today=COMPLETED, yesterday=FAILED) ━━');
  // Use a tax_period unique enough not to collide with real data — far-future
  // tax_period_year and odd month.
  const seedYear = 2050;
  const seedRows = [
    {
      customer_id: customerId,
      tax_type: 'PPh21',
      tax_period_month: 1,
      tax_period_year: seedYear,
      amount: 1,
      status: 'COMPLETED',
      notes: 'smoke-test:queue-daily-trend today',
      updated_at: today.toISOString(),
    },
    {
      customer_id: customerId,
      tax_type: 'PPh21',
      tax_period_month: 2,
      tax_period_year: seedYear,
      amount: 1,
      status: 'FAILED',
      notes: 'smoke-test:queue-daily-trend yesterday',
      updated_at: yesterday.toISOString(),
    },
  ];
  const seed = await admin.from('djp_submission_queue').insert(seedRows).select('id');
  if (seed.error || !seed.data || seed.data.length !== 2) {
    console.error('   ✗ seed failed', seed.error);
    process.exit(1);
  }
  console.log('   ✅ seeded 2 rows');

  console.log('\n━━ 2. GET ?days=7 ━━');
  const r1 = await api('/api/operator/queue-daily-trend?days=7', supTok);
  if (r1.status !== 200 || !r1.body.success) {
    console.error('   ✗ failed', r1);
    fail++;
  } else if (!Array.isArray(r1.body.data?.days) || r1.body.data.days.length !== 7) {
    console.error('   ✗ days length wrong', r1.body.data?.days?.length);
    fail++;
  } else {
    type DayRow = { date: string; byStatus: Record<string, number>; total: number };
    const td = (r1.body.data.days as DayRow[]).find((d) => d.date === dayKey(today));
    const yd = (r1.body.data.days as DayRow[]).find((d) => d.date === dayKey(yesterday));
    if (!td || (td.byStatus.COMPLETED ?? 0) < 1) {
      console.error('   ✗ today COMPLETED missing', td);
      fail++;
    } else if (!yd || (yd.byStatus.FAILED ?? 0) < 1) {
      console.error('   ✗ yesterday FAILED missing', yd);
      fail++;
    } else {
      console.log(
        `   ✅ today.COMPLETED=${td.byStatus.COMPLETED}, yesterday.FAILED=${yd.byStatus.FAILED}, statuses=${(r1.body.data.statuses as string[]).join(',')}`,
      );
      pass++;
    }
  }

  console.log('\n━━ 3. default ?days=14 returns 14 buckets ━━');
  const r2 = await api('/api/operator/queue-daily-trend', supTok);
  if (r2.status !== 200 || r2.body.data?.days?.length !== 14) {
    console.error('   ✗ default days wrong', r2.body.data?.days?.length);
    fail++;
  } else {
    console.log('   ✅ default returns 14 day buckets');
    pass++;
  }

  console.log('\n━━ 4. PLATFORM_ADMIN blocked ━━');
  const adminTok = await login('admin.test@aipajak.com');
  if (!adminTok) {
    console.log('   ⏭️  no PLATFORM_ADMIN account — skipping');
  } else {
    const r3 = await api('/api/operator/queue-daily-trend', adminTok);
    if (![401, 403].includes(r3.status)) {
      console.error('   ✗ expected 401/403, got', r3.status, r3.body);
      fail++;
    } else {
      console.log(`   ✅ admin blocked (${r3.status})`);
      pass++;
    }
  }

  console.log('\n🧹 cleanup');
  await admin
    .from('djp_submission_queue')
    .delete()
    .eq('customer_id', customerId)
    .like('notes', 'smoke-test:queue-daily-trend%');
  console.log('   ✓ removed seeded rows');

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
