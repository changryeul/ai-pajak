/**
 * Smoke test for GET /api/customer/advisory (AI Tax Advisory 4 signals).
 *
 * Run:
 *   npx tsx scripts/test-advisory-flow.ts                # local Supabase
 *   SEED_TARGET=prod npx tsx scripts/test-advisory-flow.ts
 *
 * What it covers:
 *   1. INDIVIDUAL (customer.test) — endpoint reachable + JSON shape +
 *      isCompany=false + status fields present
 *   2. COMPANY (company.test) — endpoint reachable + JSON shape +
 *      isCompany=true + regime field populated (or NOT_DETERMINED if
 *      company.test lacks established_year / legal_form in the seed)
 *
 * Anti-regression: confirms the route is wired through
 * composeMiddleware(requireAuth, requireRole(CUSTOMER)) and the response
 * shape matches what TaxAdvisoryPanel consumes.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');

console.log(`🌐 base URL: ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';

async function login(email: string): Promise<string | null> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`   ✗ login failed for ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

type AdvisoryResponse = {
  success: boolean;
  data?: {
    isCompany: boolean;
    pkp: {
      status: 'NOT_APPLICABLE' | 'OK' | 'APPROACHING' | 'EXCEEDED' | 'REGISTERED';
      annualRevenueIdr: number;
      thresholdIdr: number;
      pctOfThreshold: number;
      isPkp: boolean;
    };
    umkmTransition: {
      regime: 'PPH_FINAL' | 'PPH25' | 'NOT_DETERMINED';
      title: string;
      reason: string;
      yearsOperating: number;
      umkmYearsRemaining: number | null;
      warnings: string[];
      transitionUrgent: boolean;
    };
    taxTreaty: {
      status: 'NOT_APPLICABLE' | 'OK' | 'REVIEW_NEEDED';
      pph26TransactionCount: number;
      missingTreatyCount: number;
    };
  };
  error?: string;
};

async function fetchAdvisory(token: string): Promise<{ status: number; body: AdvisoryResponse }> {
  const res = await fetch(`${baseUrl}/api/customer/advisory`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = (await res.json()) as AdvisoryResponse;
  return { status: res.status, body };
}

function assertShape(body: AdvisoryResponse): string[] {
  const errors: string[] = [];
  if (!body.success) errors.push(`success=false (error=${body.error})`);
  const d = body.data;
  if (!d) {
    errors.push('data missing');
    return errors;
  }
  if (typeof d.isCompany !== 'boolean') errors.push('isCompany not boolean');
  if (!d.pkp || typeof d.pkp.status !== 'string') errors.push('pkp.status missing');
  if (typeof d.pkp?.annualRevenueIdr !== 'number') errors.push('pkp.annualRevenueIdr not number');
  if (typeof d.pkp?.thresholdIdr !== 'number') errors.push('pkp.thresholdIdr not number');
  if (!d.umkmTransition || typeof d.umkmTransition.regime !== 'string')
    errors.push('umkmTransition.regime missing');
  if (!Array.isArray(d.umkmTransition?.warnings)) errors.push('umkmTransition.warnings not array');
  if (!d.taxTreaty || typeof d.taxTreaty.status !== 'string') errors.push('taxTreaty.status missing');
  if (typeof d.taxTreaty?.pph26TransactionCount !== 'number')
    errors.push('taxTreaty.pph26TransactionCount not number');
  return errors;
}

function describe(body: AdvisoryResponse): void {
  const d = body.data!;
  console.log(`   isCompany: ${d.isCompany}`);
  console.log(
    `   pkp: ${d.pkp.status} (revenue=${d.pkp.annualRevenueIdr.toLocaleString('id-ID')}, ` +
      `${d.pkp.pctOfThreshold}% of threshold, isPkp=${d.pkp.isPkp})`,
  );
  console.log(
    `   umkmTransition: ${d.umkmTransition.regime}` +
      (d.umkmTransition.umkmYearsRemaining !== null
        ? ` (UMKM 잔여 ${d.umkmTransition.umkmYearsRemaining}년)`
        : '') +
      (d.umkmTransition.transitionUrgent ? ' ⚠ urgent' : '') +
      (d.umkmTransition.warnings.length ? ` · warnings=${d.umkmTransition.warnings.length}` : ''),
  );
  console.log(
    `   taxTreaty: ${d.taxTreaty.status} (pph26=${d.taxTreaty.pph26TransactionCount}, ` +
      `missingDgt=${d.taxTreaty.missingTreatyCount})`,
  );
}

async function run() {
  console.log('🩺 AI Tax Advisory smoke test\n');
  let pass = 0;
  let fail = 0;

  // ─── INDIVIDUAL ───
  console.log('━━━━ 1. INDIVIDUAL (customer.test@example.com) ━━━━');
  const indTok = await login('customer.test@example.com');
  if (!indTok) {
    fail++;
  } else {
    const { status, body } = await fetchAdvisory(indTok);
    console.log(`   📡 GET /api/customer/advisory → ${status}`);
    const errs = assertShape(body);
    if (status !== 200 || errs.length) {
      console.error(`   ✗ FAIL${errs.length ? ` — ${errs.join(', ')}` : ''}`);
      fail++;
    } else {
      describe(body);
      if (body.data!.isCompany !== false) {
        console.error('   ✗ expected isCompany=false for INDIVIDUAL');
        fail++;
      } else {
        console.log('   ✅ PASS');
        pass++;
      }
    }
  }

  // ─── COMPANY ───
  console.log('\n━━━━ 2. COMPANY (company.test@example.com) ━━━━');
  const coTok = await login('company.test@example.com');
  if (!coTok) {
    fail++;
  } else {
    const { status, body } = await fetchAdvisory(coTok);
    console.log(`   📡 GET /api/customer/advisory → ${status}`);
    const errs = assertShape(body);
    if (status !== 200 || errs.length) {
      console.error(`   ✗ FAIL${errs.length ? ` — ${errs.join(', ')}` : ''}`);
      fail++;
    } else {
      describe(body);
      if (body.data!.isCompany !== true) {
        console.error('   ✗ expected isCompany=true for COMPANY');
        fail++;
      } else {
        console.log('   ✅ PASS');
        pass++;
      }
    }
  }

  // ─── Unauthenticated must be rejected ───
  console.log('\n━━━━ 3. unauthenticated → 401 ━━━━');
  const anonRes = await fetch(`${baseUrl}/api/customer/advisory`);
  console.log(`   📡 GET (no token) → ${anonRes.status}`);
  if (anonRes.status === 401) {
    console.log('   ✅ PASS');
    pass++;
  } else {
    console.error(`   ✗ FAIL — expected 401, got ${anonRes.status}`);
    fail++;
  }

  console.log(`\n${fail === 0 ? '✨' : '⚠️'} Done. ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
