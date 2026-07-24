/**
 * PPN Coretax 대조 smoke (v19 §9 — 트랙 6).
 *
 *   1. sentinel 고객 + 고객 제출 faktur 3건 (KELUARAN×2 + MASUKAN×1)
 *   2. POST reconcile with Coretax faktur:
 *      - FP001 동일 → MATCH
 *      - FP002 DPP 다름 → DIFF
 *      - FP003(MASUKAN) 고객엔 있으나 Coretax 없음 → MISSING_CORETAX
 *      - FP999(Coretax 전용) → MISSING_CUSTOMER 신규행
 *   3. GET → summary match=1/diff=1/missingCoretax=1/missingCustomer=1
 *   4. 재실행 idempotent — CORETAX 전용행 중복 안 생김
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-ppn-coretax-recon.ts
 * sentinel: [PPNRECON-E2E]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const SENTINEL = '[PPNRECON-E2E]';
const PERIOD = '2026-99'; // sentinel period, never real
let pass = 0;
function ok(m: string) { pass++; console.log(`  ✓ ${m}`); }
function fail(m: string): never { console.error(`  ✗ ${m}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session) fail(`login failed: ${email}`);
  return data.session.access_token;
}
async function api(token: string, method: string, p: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${p}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 PPN Coretax reconcile smoke on ${baseUrl}\n`);
  const cleanup: { customerId?: string } = {};

  try {
    const { data: customer } = await admin.from('customer').insert({
      customer_type: 'COMPANY', full_name: `${SENTINEL} PT PPN`, company_name: `${SENTINEL} PT PPN`,
      npwp: `55${Date.now().toString().slice(-13)}`.slice(0, 15), email: `ppnrecon-${Date.now()}@example.com`, is_pkp: true,
    }).select('id').single();
    if (!customer) fail('customer insert failed');
    cleanup.customerId = customer.id;

    // 고객 제출 faktur 3건.
    await admin.from('ppn_faktur_monthly').insert([
      { customer_id: customer.id, tax_period: PERIOD, faktur_type: 'KELUARAN', faktur_number: 'FP001', dpp: 1_000_000, ppn: 110_000, status: 'APPROVED', recon_source: 'CUSTOMER' },
      { customer_id: customer.id, tax_period: PERIOD, faktur_type: 'KELUARAN', faktur_number: 'FP002', dpp: 2_000_000, ppn: 220_000, status: 'APPROVED', recon_source: 'CUSTOMER' },
      { customer_id: customer.id, tax_period: PERIOD, faktur_type: 'MASUKAN', faktur_number: 'FP003', dpp: 500_000, ppn: 55_000, status: 'APPROVED', recon_source: 'CUSTOMER' },
    ]);
    ok('sentinel customer + 3 submitted faktur ready');

    const supervisorToken = await login('supervisor.test@aipajak.com');

    // ── 2. 대조 실행 ──
    const coretaxFaktur = [
      { fakturType: 'KELUARAN', fakturNumber: 'FP001', dpp: 1_000_000, ppn: 110_000 },  // MATCH
      { fakturType: 'KELUARAN', fakturNumber: 'FP002', dpp: 2_500_000, ppn: 275_000 },  // DIFF
      { fakturType: 'KELUARAN', fakturNumber: 'FP999', dpp: 300_000, ppn: 33_000 },     // MISSING_CUSTOMER
    ];
    const p1 = await api(supervisorToken, 'POST', '/api/tax/ppn-reconcile', { customerId: customer.id, taxPeriod: PERIOD, coretaxFaktur });
    if (p1.status !== 200) fail(`reconcile POST expected 200, got ${p1.status}: ${JSON.stringify(p1.json).slice(0, 200)}`);
    const s1 = (p1.json?.data as Record<string, unknown>)?.summary as Record<string, number>;
    if (s1.match !== 1 || s1.diff !== 1 || s1.missingCoretax !== 1 || s1.missingCustomer !== 1) {
      fail(`summary mismatch: ${JSON.stringify(s1)}`);
    }
    ok(`reconcile summary — match=1 diff=1 missingCoretax=1 missingCustomer=1`);

    // ── 3. GET 검증 ──
    const g = await api(supervisorToken, 'GET', `/api/tax/ppn-reconcile?customerId=${customer.id}&taxPeriod=${PERIOD}`);
    if (g.status !== 200) fail(`GET expected 200, got ${g.status}`);
    const rows = ((g.json?.data as Record<string, unknown>)?.rows ?? []) as Array<Record<string, unknown>>;
    const fp002 = rows.find(r => r.faktur_number === 'FP002');
    if (fp002?.recon_status !== 'DIFF' || Number(fp002.coretax_dpp) !== 2_500_000) fail(`FP002 not DIFF w/ coretax_dpp: ${JSON.stringify(fp002)}`);
    const fp999 = rows.find(r => r.faktur_number === 'FP999');
    if (fp999?.recon_status !== 'MISSING_CUSTOMER' || fp999.recon_source !== 'CORETAX') fail(`FP999 not MISSING_CUSTOMER/CORETAX: ${JSON.stringify(fp999)}`);
    ok('GET reflects DIFF (coretax_dpp) + Coretax-only row (MISSING_CUSTOMER)');

    // ── 4. 재실행 idempotent ──
    await api(supervisorToken, 'POST', '/api/tax/ppn-reconcile', { customerId: customer.id, taxPeriod: PERIOD, coretaxFaktur });
    const { count } = await admin.from('ppn_faktur_monthly')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id).eq('tax_period', PERIOD).eq('recon_source', 'CORETAX');
    if ((count ?? 0) !== 1) fail(`re-run created duplicate CORETAX rows: ${count}`);
    ok('idempotent — re-run keeps a single Coretax-only row');

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.customerId) {
      await admin.from('ppn_faktur_monthly').delete().eq('customer_id', cleanup.customerId);
      await admin.from('customer').delete().eq('id', cleanup.customerId);
    }
    console.log('   sentinel rows removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
