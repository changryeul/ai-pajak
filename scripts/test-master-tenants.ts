/**
 * Smoke: Master ERP 테넌트 관리 (P6 follow-up)
 *   GET/PATCH /api/admin/master/tenants
 *
 * Asserts (8):
 *   1. master (TAX_OPERATOR_MASTER+PLATFORM_MASTER 겸직) GET 200 + shape
 *   2. PT Mitra Pajak Sentosa 가 목록에 있고 hasFirmAdmin=true
 *   3. consultant → 403
 *   4. supervisor → 403
 *   5. PATCH sentinel 테넌트 중지 → is_active=false 반영
 *   6. PATCH 재개 → is_active=true 복원
 *   7. PATCH 존재하지 않는 id → 404
 *   8. PATCH 잘못된 body → 400
 *
 * Sentinel: 'PT Smoke Tenant Toggle' 을 service role 로 생성 후 삭제
 * (실 테넌트는 건드리지 않음).
 *
 * Run: SEED_TARGET=prod npx tsx scripts/test-master-tenants.ts
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

const SENTINEL_NAME = 'PT Smoke Tenant Toggle';
const PASSWORD = 'TestPassword123!';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  if (ok) {
    console.log(`   ✅ ${label}`);
    pass++;
  } else {
    console.error(`   ✗ ${label}`, detail ?? '');
    fail++;
  }
}

async function login(email: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function api(p: string, token: string, init?: { method?: string; body?: unknown }) {
  const r = await fetch(`${baseUrl}${p}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function run() {
  console.log('🧪 Master tenants smoke\n');

  // pre-cleanup + sentinel 생성
  await admin.from('tax_partner').delete().eq('name', SENTINEL_NAME);
  const { data: platform } = await admin
    .from('platform')
    .select('id')
    .eq('name', 'AI Pajak')
    .maybeSingle();
  const { data: sentinel, error: sErr } = await admin
    .from('tax_partner')
    .insert({
      platform_id: platform!.id,
      name: SENTINEL_NAME,
      legal_name: SENTINEL_NAME,
      partner_type: 'EXTERNAL',
      is_default_filing_partner: false,
      is_active: true,
    })
    .select('id')
    .single();
  if (sErr || !sentinel) {
    console.error('❌ sentinel 생성 실패:', sErr?.message);
    process.exit(1);
  }

  const masterTok = await login('master.test@aipajak.com');
  const consTok = await login('consultant.test@jakartatax.co.id');
  const supTok = await login('supervisor.test@aipajak.com');
  if (!masterTok) process.exit(1);

  // 1-2. GET shape
  const list = await api('/api/admin/master/tenants', masterTok);
  const tenants: { id: string; name: string; hasFirmAdmin: boolean; isActive: boolean }[] =
    list.body?.data?.tenants ?? [];
  check(
    list.status === 200 && Array.isArray(tenants) && typeof list.body?.data?.summary?.total === 'number',
    '1. master GET 200 + shape',
    list,
  );
  const mitra = tenants.find((t) => t.name === 'PT Mitra Pajak Sentosa');
  check(Boolean(mitra?.hasFirmAdmin), '2. PT Mitra hasFirmAdmin=true', mitra);

  // 3-4. RBAC
  if (consTok) {
    const r = await api('/api/admin/master/tenants', consTok);
    check(r.status === 403, '3. consultant → 403', r.status);
  } else check(false, '3. consultant login failed');
  if (supTok) {
    const r = await api('/api/admin/master/tenants', supTok);
    check(r.status === 403, '4. supervisor → 403', r.status);
  } else check(false, '4. supervisor login failed');

  // 5-6. toggle round-trip on sentinel
  const off = await api('/api/admin/master/tenants', masterTok, {
    method: 'PATCH',
    body: { taxPartnerId: sentinel.id, isActive: false },
  });
  const { data: afterOff } = await admin
    .from('tax_partner')
    .select('is_active')
    .eq('id', sentinel.id)
    .single();
  check(off.status === 200 && afterOff?.is_active === false, '5. 중지 → is_active=false', {
    off: off.status,
    afterOff,
  });

  const on = await api('/api/admin/master/tenants', masterTok, {
    method: 'PATCH',
    body: { taxPartnerId: sentinel.id, isActive: true },
  });
  const { data: afterOn } = await admin
    .from('tax_partner')
    .select('is_active')
    .eq('id', sentinel.id)
    .single();
  check(on.status === 200 && afterOn?.is_active === true, '6. 재개 → is_active=true', {
    on: on.status,
    afterOn,
  });

  // 7-8. contracts
  const notFound = await api('/api/admin/master/tenants', masterTok, {
    method: 'PATCH',
    body: { taxPartnerId: '00000000-0000-0000-0000-00000000dead', isActive: false },
  });
  check(notFound.status === 404, '7. unknown id → 404', notFound.status);

  const bad = await api('/api/admin/master/tenants', masterTok, {
    method: 'PATCH',
    body: { taxPartnerId: sentinel.id },
  });
  check(bad.status === 400, '8. isActive 누락 → 400', bad.status);

  // cleanup
  await admin.from('tax_partner').delete().eq('id', sentinel.id);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) process.exit(1);
  console.log('✨ master tenants smoke PASS');
}

run().catch(async (e) => {
  console.error('❌ Fatal:', e);
  await admin.from('tax_partner').delete().eq('name', SENTINEL_NAME);
  process.exit(1);
});
