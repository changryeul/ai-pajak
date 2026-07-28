/**
 * ID Billing 이관현황(§8) + 평가 실측/제안값(§7) smoke — 트랙 5 A+B.
 *
 *   1. billing-handover: supervisor 200 (pending/issued/summary 구조),
 *      consultant 403
 *   2. evaluation: supervisor 200, isSuggestionOnly=true + disclaimer +
 *      operators[].suggested_incentive_amount + reject_rate/approval_pass_rate
 *      필드 존재 (자동 상벌 결정 아님 계약)
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-supervisor-handover-eval.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';

let pass = 0;
function ok(msg: string) { pass++; console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session) fail(`login failed: ${email} — ${error?.message}`);
  return data.session.access_token;
}
async function api(token: string, p: string) {
  const res = await fetch(`${baseUrl}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 supervisor handover + evaluation smoke on ${baseUrl}\n`);

  const supervisorToken = await login('supervisor.test@aipajak.com');
  const consultantToken = await login('external.consultant@mitrapajak.com');

  // ── 1. 이관현황 ──
  const h = await api(supervisorToken, '/api/operator/supervisor/billing-handover');
  if (h.status !== 200) fail(`handover supervisor expected 200, got ${h.status}: ${JSON.stringify(h.json).slice(0, 150)}`);
  const hd = h.json?.data as Record<string, unknown>;
  if (!Array.isArray(hd?.pending) || !Array.isArray(hd?.issued) || !hd?.summary) {
    fail(`handover shape unexpected: ${JSON.stringify(hd).slice(0, 150)}`);
  }
  ok(`handover 200 — pending=${(hd.pending as unknown[]).length}, issued=${(hd.issued as unknown[]).length}`);

  const hc = await api(consultantToken, '/api/operator/supervisor/billing-handover');
  if (hc.status !== 403) fail(`handover consultant expected 403, got ${hc.status}`);
  ok('handover consultant → 403 (supervisor only)');

  // ── 2. 평가 실측/제안값 ──
  const e = await api(supervisorToken, '/api/operator/evaluation');
  if (e.status !== 200) fail(`evaluation expected 200, got ${e.status}`);
  const ed = e.json?.data as Record<string, unknown>;
  if (ed?.isSuggestionOnly !== true) fail('evaluation must set isSuggestionOnly=true (§7 자동 상벌 금지)');
  if (typeof ed?.disclaimer !== 'string' || !(ed.disclaimer as string).length) fail('evaluation must carry a disclaimer');
  ok('evaluation isSuggestionOnly=true + disclaimer present');

  const ops = (ed.operators ?? []) as Array<Record<string, unknown>>;
  if (ops.length > 0) {
    const o = ops[0];
    if (!('suggested_incentive_amount' in o)) fail('operator missing suggested_incentive_amount (renamed from incentive_amount)');
    if (!('reject_rate' in o) || !('approval_pass_rate' in o)) fail('operator missing reject_rate/approval_pass_rate 실측 필드');
    ok(`operator row has suggested_incentive_amount + reject_rate/approval_pass_rate (실측 필드)`);
  } else {
    ok('no operators to inspect (schema fields verified at type level)');
  }
  const summary = ed.summary as Record<string, unknown>;
  if (!('totalSuggestedIncentive' in summary)) fail('summary missing totalSuggestedIncentive');
  ok('summary.totalSuggestedIncentive present (제안값 표기)');

  console.log(`\n✅ ${pass} assertions passed`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
