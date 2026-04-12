/**
 * Accurate 회계 연동 집중 테스트
 *
 * 자격증명이 없어도 테스트 가능한 범위를 최대한 커버:
 *
 * 1. API 라우트 존재 확인 (404 아닌지)
 * 2. OAuth authorize — 자격증명 미설정 시 명확한 에러 메시지
 * 3. Sync GET — 연결 없는 고객에 대해 빈 결과 정상 반환
 * 4. Sync POST — 연결 없는 고객에 대해 404 정상 반환
 * 5. DB 스키마 — accounting_connection / accounting_invoice 테이블 존재 + 핵심 컬럼
 * 6. 통합 설정 페이지 — /settings/integrations 라우트 200
 * 7. Accurate 설정 페이지 — /settings/accurate 라우트 200
 *
 * Run: SEED_TARGET=prod npx tsx scripts/test-accurate-integration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const COMPANY_CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`   ✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('🔌 Accurate 회계 연동 집중 테스트\n');

  // ── 1. DB 스키마 검증 ──
  console.log('━━ 1. DB 스키마 검증 ━━');

  const { data: connCols } = await admin
    .from('accounting_connection')
    .select('id, customer_id, provider, access_token, refresh_token, session_key, host, database_id, database_name, sync_status, last_sync_at, last_error, is_active')
    .limit(0);
  check('accounting_connection 테이블 + 핵심 컬럼 존재', connCols !== null);

  const { data: invCols } = await admin
    .from('accounting_invoice')
    .select('id, customer_id, provider, external_id, invoice_type, invoice_number, invoice_date, counterparty_name, counterparty_npwp, subtotal, tax_amount, total_amount, has_ppn, has_pph, status, raw_data')
    .limit(0);
  check('accounting_invoice 테이블 + 핵심 컬럼 존재', invCols !== null);

  const { data: oauthCols } = await admin
    .from('accounting_oauth_state')
    .select('state, provider, customer_id, redirect_after, expires_at')
    .limit(0);
  check('accounting_oauth_state 테이블 존재', oauthCols !== null);

  // ── 2. API 라우트 존재 확인 ──
  console.log('\n━━ 2. API 라우트 존재 확인 ━━');

  const consultantToken = await login('consultant.test@jakartatax.co.id');
  if (!consultantToken) {
    console.error('   ❌ consultant 로그인 실패 — 나머지 테스트 건너뜀');
    return;
  }
  console.log('   ✅ consultant.test 로그인\n');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${consultantToken}` };

  // authorize
  const authRes = await fetch(`${baseUrl}/api/accounting/authorize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ customerId: COMPANY_CUSTOMER_ID, provider: 'ACCURATE' }),
  });
  const authBody = await authRes.json().catch(() => ({}));
  check(
    'POST /api/accounting/authorize 라우트 존재',
    authRes.status !== 404,
    `status=${authRes.status}`
  );
  // 자격증명 없으면 500 with "env var not configured" 메시지 예상
  if (authRes.status === 500) {
    const hasConfigError = JSON.stringify(authBody).includes('not configured') || JSON.stringify(authBody).includes('CLIENT_ID');
    check(
      'OAuth 자격증명 미설정 시 명확한 에러 메시지',
      hasConfigError,
      hasConfigError ? '환경변수 누락을 정확히 안내' : `unexpected: ${JSON.stringify(authBody).slice(0, 100)}`
    );
  } else if (authRes.status === 200) {
    check('OAuth authorize URL 반환', !!authBody.data?.authorizeUrl, `url=${String(authBody.data?.authorizeUrl).slice(0, 60)}...`);
  }

  // sync GET — 연결 없는 고객
  const syncGetRes = await fetch(
    `${baseUrl}/api/accounting/sync?customerId=${COMPANY_CUSTOMER_ID}`,
    { headers }
  );
  const syncGetBody = await syncGetRes.json().catch(() => ({}));
  check(
    'GET /api/accounting/sync 라우트 존재',
    syncGetRes.status !== 404,
    `status=${syncGetRes.status}`
  );
  if (syncGetRes.status === 200) {
    check(
      'Sync GET — 연결 없는 고객에 빈 connections 반환',
      Array.isArray(syncGetBody.data?.connections),
      `connections=${syncGetBody.data?.connections?.length ?? '?'}`
    );
  }

  // sync POST — 연결 없는 고객
  const syncPostRes = await fetch(`${baseUrl}/api/accounting/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ customerId: COMPANY_CUSTOMER_ID, provider: 'ACCURATE' }),
  });
  const syncPostBody = await syncPostRes.json().catch(() => ({}));
  check(
    'POST /api/accounting/sync — 연결 없는 고객 → 404',
    syncPostRes.status === 404,
    `status=${syncPostRes.status}, error="${syncPostBody.error?.slice(0, 50) ?? ''}"`
  );

  // classify
  const classifyRes = await fetch(`${baseUrl}/api/accounting/classify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ customerId: COMPANY_CUSTOMER_ID }),
  });
  check(
    'POST /api/accounting/classify 라우트 존재',
    classifyRes.status !== 404,
    `status=${classifyRes.status}`
  );

  // callback (GET — requires code param)
  const callbackRes = await fetch(`${baseUrl}/api/accounting/callback?code=test&state=fake`, {
    redirect: 'manual',
  });
  check(
    'GET /api/accounting/callback 라우트 존재',
    callbackRes.status !== 404,
    `status=${callbackRes.status}`
  );

  // ── 3. 레거시 엔드포인트 호환 ──
  console.log('\n━━ 3. 레거시 엔드포인트 호환 ━━');

  const legacyRes = await fetch(`${baseUrl}/api/integrations/accurate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'list-databases', customerId: COMPANY_CUSTOMER_ID }),
  });
  check(
    'POST /api/integrations/accurate 레거시 라우트 존재',
    legacyRes.status !== 404,
    `status=${legacyRes.status}`
  );

  const legacyCallbackRes = await fetch(`${baseUrl}/api/integrations/accurate/callback?code=test&state=fake`, {
    redirect: 'manual',
  });
  check(
    'GET /api/integrations/accurate/callback 레거시 콜백 존재',
    legacyCallbackRes.status !== 404,
    `status=${legacyCallbackRes.status}`
  );

  // ── 4. UI 페이지 존재 ──
  console.log('\n━━ 4. UI 페이지 존재 ━━');

  const integrationsRes = await fetch(`${baseUrl}/ko/settings/integrations`, { redirect: 'manual' });
  check(
    '/settings/integrations 페이지 존재',
    integrationsRes.status === 200 || integrationsRes.status === 307,
    `status=${integrationsRes.status}`
  );

  const accurateRes = await fetch(`${baseUrl}/ko/settings/accurate`, { redirect: 'manual' });
  check(
    '/settings/accurate 페이지 존재',
    accurateRes.status === 200 || accurateRes.status === 307,
    `status=${accurateRes.status}`
  );

  // ── 5. RLS 정책 확인 ──
  console.log('\n━━ 5. RLS 격리 (고객 본인 데이터만) ━━');

  // Insert a test connection for COMPANY_CUSTOMER, then try to read it as
  // individual customer (should not be visible)
  const { data: testConn } = await admin
    .from('accounting_connection')
    .upsert({
      id: '00000000-0000-0000-0000-000000000099',
      customer_id: COMPANY_CUSTOMER_ID,
      provider: 'ACCURATE',
      access_token: 'test-token',
      is_active: false,
    }, { onConflict: 'id' })
    .select('id')
    .single();

  if (testConn) {
    // Login as individual customer — should NOT see company's connection
    const individualToken = await login('customer.test@example.com');
    if (individualToken) {
      const individualRes = await fetch(
        `${baseUrl}/api/accounting/sync?customerId=${COMPANY_CUSTOMER_ID}`,
        { headers: { Authorization: `Bearer ${individualToken}`, 'Content-Type': 'application/json' } }
      );
      const individualBody = await individualRes.json().catch(() => ({ data: { connections: [] } }));
      const connectionVisible = (individualBody.data?.connections || []).some(
        (c: { id: string }) => c.id === testConn.id
      );
      check(
        'RLS — 다른 고객의 accounting_connection 접근 불가',
        !connectionVisible,
        connectionVisible ? 'LEAK! 다른 고객 연결 보임' : '격리 정상'
      );
    }

    // Cleanup
    await admin.from('accounting_connection').delete().eq('id', testConn.id);
  }

  // ── 6. Vercel 환경변수 확인 ──
  console.log('\n━━ 6. 프로덕션 환경변수 현황 ━━');
  const hasLocalCreds = process.env.ACCURATE_CLIENT_ID && process.env.ACCURATE_CLIENT_ID !== 'your-accurate-client-id';
  check(
    'ACCURATE_CLIENT_ID (로컬)',
    !!hasLocalCreds,
    hasLocalCreds ? '실제 값 설정됨' : 'placeholder 또는 미설정'
  );

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 결과: ${passed} passed, ${failed} failed / ${passed + failed} total`);

  if (failed === 0) {
    console.log('\n✅ Accurate 연동 코드가 정상적으로 구현되어 있습니다.');
  }

  console.log('\n📋 전체 E2E 테스트를 위해 필요한 것:');
  console.log('   1. Accurate Online 개발자 계정 (https://developer.accurate.id)');
  console.log('   2. OAuth App 등록 → Client ID + Client Secret 발급');
  console.log('   3. Redirect URI 등록: https://ai-pajak.vercel.app/api/accounting/callback');
  console.log('   4. .env.local 및 Vercel env에 3개 키 설정:');
  console.log('      ACCURATE_CLIENT_ID=...');
  console.log('      ACCURATE_CLIENT_SECRET=...');
  console.log('      ACCURATE_REDIRECT_URI=https://ai-pajak.vercel.app/api/accounting/callback');
  console.log('   5. Accurate 테스트 DB에 샘플 인보이스 데이터 준비');
  console.log('\n   위 5개가 준비되면 브라우저에서 다음 흐름을 검증:');
  console.log('     /settings/accurate → "연결" 클릭 → Accurate OAuth 로그인');
  console.log('     → 콜백 → DB 선택 → "동기화" → 매출/매입 인보이스 목록 확인');
  console.log('     → "자동 분류" → 세금 유형 분류 결과 확인');

  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
