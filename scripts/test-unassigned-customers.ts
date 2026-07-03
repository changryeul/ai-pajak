/**
 * P1 회귀: `/api/operator/unassigned-customers` + `/api/customers/[id]/assign`
 * (SUPERVISOR 허용) contract 검증.
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-unassigned-customers.ts
 *
 * 시나리오
 *  1. SUPERVISOR 세션 → GET unassigned-customers → 200 + shape
 *  2. CONSULTANT 세션 → GET unassigned-customers → 403
 *  3. Unauth → 401
 *
 * 이 스크립트는 실행 중인 dev/prod 서버가 필요 (기본 http://localhost:3000).
 * ENV: E2E_BASE_URL, SEED_TARGET (prod → .env.production.local, else .env.local)
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const seedTarget = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
loadEnv({ path: seedTarget });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SUPERVISOR = { email: 'supervisor.test@aipajak.com', password: 'TestPassword123!' };
const CONSULTANT = { email: 'consultant.test@jakartatax.co.id', password: 'TestPassword123!' };

async function signIn(email: string, password: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function apiGet(path: string, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`);
}

async function main() {
  console.log(`[unassigned-customers] target=${BASE_URL}\n`);

  // (1) Unauth → 401
  {
    const r = await apiGet('/api/operator/unassigned-customers');
    record('unauth returns 401', r.status === 401, `status=${r.status}`);
  }

  // (2) CONSULTANT → 403 (supervisor only)
  {
    const token = await signIn(CONSULTANT.email, CONSULTANT.password);
    const r = await apiGet('/api/operator/unassigned-customers', token);
    record('consultant blocked', r.status === 403, `status=${r.status}`);
  }

  // (3) SUPERVISOR → 200 + shape
  {
    const token = await signIn(SUPERVISOR.email, SUPERVISOR.password);
    const r = await apiGet('/api/operator/unassigned-customers', token);
    const shapeOk =
      r.status === 200
      && r.body?.success === true
      && Array.isArray(r.body?.data?.customers)
      && typeof r.body?.data?.count === 'number';
    record(
      'supervisor 200 + shape',
      shapeOk,
      `status=${r.status} count=${r.body?.data?.count} keys=${Object.keys(r.body?.data?.customers?.[0] || {}).slice(0, 6).join(',')}`,
    );
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✅ ALL PASS' : `❌ ${failed.length} FAILED`} (${results.length} tests)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('❌ runner crashed:', err);
  process.exit(1);
});
