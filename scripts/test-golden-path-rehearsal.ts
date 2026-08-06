/**
 * 골든패스 브라우저 리허설 (Playwright, prod):
 *   고객 PPh23 입력 → 자동 큐+배정 → 상담원 워크큐 검토완료(PENDING→review→request-approval)
 *   → 수퍼바이저 승인 → 발행 보드 작성본→발행→납부확인(NTPN) → issuance PAID + 큐 COMPLETED.
 *
 * smoke 러너 미포함 (브라우저 필요, ~3분) — 배포 전 수동 실행용:
 *   npx tsx scripts/test-golden-path-rehearsal.ts
 * sentinel: company.test PPh23 2026-09 + [REHEARSAL] prefix. pre/post cleanup 멱등.
 * 2026-08-04 최초 실행에서 결함 3건 적발 (PENDING 데드엔드 / 고아 발행대상 / amount 미스탬프).
 */
import { chromium, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
config({ path: '.env.production.local' });

const BASE = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
// 스크린샷 저장 위치 — CI 에선 REHEARSAL_SHOTS_DIR 로 지정해 artifact 업로드.
const SHOTS = process.env.REHEARSAL_SHOTS_DIR || join(tmpdir(), 'golden-path-rehearsal');
mkdirSync(SHOTS, { recursive: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CID = '00000000-0000-4000-8000-000000000011';
const PERIOD = '2026-09';
const NTPN = 'REHRSL1234567890';
const friction: string[] = [];

async function cleanup() {
  const { data: q } = await admin.from('djp_submission_queue').select('id').eq('customer_id', CID).eq('tax_type', 'PPh23').eq('tax_period_month', 9).eq('tax_period_year', 2026);
  for (const row of q ?? []) {
    await admin.from('id_billing_issuance').delete().eq('queue_item_id', row.id);
    await admin.from('id_billing_workbook_log').delete().eq('queue_item_id', row.id);
  }
  await admin.from('djp_submission_queue').delete().eq('customer_id', CID).eq('tax_type', 'PPh23').eq('tax_period_month', 9).eq('tax_period_year', 2026);
  await admin.from('pph23_transaction').delete().eq('customer_id', CID).eq('tax_period', PERIOD).like('description', '[REHEARSAL]%');
}

async function login(page: Page, email: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    const inputs = page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') });
    await inputs.first().fill(email);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(/\/(operator|dashboard)/, { timeout: 20000 });
      return;
    } catch {
      console.log(`   (login retry ${attempt} for ${email})`);
      await page.waitForTimeout(3000);
    }
  }
  throw new Error(`login failed after retries: ${email}`);
}

async function main() {
  await cleanup();
  console.log('STEP 0: pre-cleanup done');

  // ── 1. 고객 데이터 입력 (API — 폼은 기존 e2e 커버) ──
  const { data: auth } = await anon.auth.signInWithPassword({ email: 'company.test@example.com', password: 'TestPassword123!' });
  const custToken = auth!.session!.access_token;
  const r1 = await fetch(`${BASE}/api/tax/pph23-transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      customerId: CID, taxPeriod: PERIOD, transactionDate: '2026-09-05',
      serviceType: 'JASA_KONSULTAN', grossAmount: 25000000,
      counterpartyName: '[REHEARSAL] PT Vendor Sept', counterpartyNpwp: '012345678901234',
      description: '[REHEARSAL] jasa konsultan september',
    }),
  });
  const j1 = await r1.json().catch(() => ({}));
  console.log('STEP 1: customer PPh23 entry →', r1.status, j1?.error ?? 'OK');
  const { data: qrow } = await admin.from('djp_submission_queue').select('id, status, operator_id').eq('customer_id', CID).eq('tax_type', 'PPh23').eq('tax_period_month', 9).eq('tax_period_year', 2026).maybeSingle();
  console.log('STEP 1b: auto queue row:', qrow ? `${qrow.status} op=${qrow.operator_id ? 'assigned' : 'null'}` : 'MISSING');
  if (!qrow) { friction.push('큐 자동생성 실패'); throw new Error('no queue row'); }

  const browser = await chromium.launch();

  // ── 2. 상담원: 워크큐에서 검토 → 고객 검토완료 ──
  const opPage = await (await browser.newContext()).newPage();
  await login(opPage, 'operator.test@aipajak.com');
  console.log('STEP 2: operator landed on', opPage.url().includes('workqueue') ? 'workqueue ✓' : `UNEXPECTED ${opPage.url()}`);
  await opPage.getByRole('tab', { name: /원천세/ }).click();
  await opPage.fill('input[type="month"]', '2026-09');
  await opPage.waitForTimeout(2500);
  await opPage.screenshot({ path: `${SHOTS}/1-operator-worklist.png` });
  const card = opPage.locator('[class*="cust"]').first();
  if (await opPage.locator('[class*="cust"]').count() === 0) { friction.push('상담원 워크리스트에 9월 항목 안 보임'); throw new Error('no card'); }
  await card.click();
  await opPage.waitForTimeout(2500);
  await opPage.screenshot({ path: `${SHOTS}/2-operator-panel.png` });
  // 승인요청 (request-approval) — 2026-08-05 리모델: 버튼 → 코멘트 모달 → 보내기
  const reqBtn = opPage.getByRole('button', { name: '승인요청', exact: true });
  if (!(await reqBtn.count())) { friction.push('PENDING 상태에서 승인요청 버튼 없음'); }
  await reqBtn.click();
  await opPage.waitForTimeout(600);
  await opPage.locator('textarea').last().fill('[REHEARSAL] 검토 완료 — 승인 부탁드립니다.');
  await opPage.getByRole('button', { name: '승인요청 보내기' }).click();
  await opPage.waitForTimeout(2500);
  const { data: afterReq } = await admin.from('djp_submission_queue').select('status, notes').eq('id', qrow.id).single();
  console.log('STEP 2b: after 승인요청 →', afterReq?.status);
  if (afterReq?.status !== 'PENDING_APPROVAL') friction.push(`승인요청 후 상태=${afterReq?.status} (PENDING_APPROVAL 기대)`);
  if (!afterReq?.notes?.includes('[REHEARSAL]')) friction.push('승인요청 코멘트가 queue.notes 에 저장되지 않음');
  await opPage.screenshot({ path: `${SHOTS}/3-operator-after-request.png` });

  // ── 3. 수퍼바이저: 승인 ──
  const svPage = await (await browser.newContext()).newPage();
  await login(svPage, 'supervisor.test@aipajak.com');
  await svPage.goto(`${BASE}/ko/operator/workqueue`, { waitUntil: 'domcontentloaded' });
  await svPage.getByRole('tab', { name: /원천세/ }).click();
  await svPage.fill('input[type="month"]', '2026-09');
  await svPage.waitForTimeout(2500);
  await svPage.locator('[class*="cust"]').first().click();
  await svPage.waitForTimeout(2500);
  await svPage.screenshot({ path: `${SHOTS}/4-supervisor-panel.png` });
  const approveBtn = svPage.getByRole('button', { name: '승인', exact: true });
  if (!(await approveBtn.count())) friction.push('수퍼바이저 승인 버튼 없음');
  await approveBtn.click();
  await svPage.waitForTimeout(2500);
  const { data: afterApprove } = await admin.from('djp_submission_queue').select('status').eq('id', qrow.id).single();
  console.log('STEP 3: after 승인 →', afterApprove?.status);
  await svPage.screenshot({ path: `${SHOTS}/5-supervisor-approved.png` });

  // ── 4. 발행 보드: 작성본 → 발행 → 전송 → 납부확인 ──
  await opPage.goto(`${BASE}/ko/operator/billing-issuance`, { waitUntil: 'domcontentloaded' });
  await opPage.waitForTimeout(3000);
  await opPage.screenshot({ path: `${SHOTS}/6-board-targets.png` });
  // 대상 카드에서 작성본 다운로드 (게이트 해제)
  // 우리 고객(PT Example Indonesia) 카드를 특정 — 보드에 다른 발행대상이 있을 수 있음
  const targetCard = opPage.locator('div.rounded-xl').filter({ hasText: 'PT Example Indonesia' }).first();
  try { await targetCard.waitFor({ state: 'visible', timeout: 30000 }); }
  catch { friction.push('발행 보드에 PT Example PPh23 카드 없음 (30s 대기 후)'); throw new Error('no target'); }
  const dlBtn = targetCard.getByRole('button', { name: '작성본 다운로드', exact: true });
  const dlPromise = opPage.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await dlBtn.evaluate(el => (el as HTMLButtonElement).click());
  const dl = await dlPromise;
  console.log('STEP 4a: workbook download →', dl ? 'OK' : 'no download event');
  // 발행 게이트(작성본 이력) 폴링 — UI 클릭이 실제 로그를 남겼는지 DB 로 확인
  let gateOk = false;
  for (let i = 0; i < 10; i++) {
    const { data: wl } = await admin.from('id_billing_workbook_log').select('id').eq('queue_item_id', qrow.id).limit(1);
    if (wl && wl.length > 0) { gateOk = true; break; }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log('STEP 4a-2: workbook gate log →', gateOk ? 'OK' : 'MISSING');
  if (!gateOk) friction.push('작성본 다운로드 클릭이 workbook_log 를 안 남김');
  await opPage.reload({ waitUntil: 'domcontentloaded' });
  await opPage.waitForTimeout(3000);
  const targetCard2 = opPage.locator('div.rounded-xl').filter({ hasText: 'PT Example Indonesia' }).first();
  await targetCard2.waitFor({ state: 'visible', timeout: 30000 });
  const issueBtn = targetCard2.getByRole('button', { name: '발행하기' });
  await issueBtn.evaluate(el => (el as HTMLButtonElement).click());
  await opPage.waitForTimeout(3000);
  await opPage.screenshot({ path: `${SHOTS}/7-board-issued.png` });
  const { data: iss } = await admin.from('id_billing_issuance').select('id, serial_no, status').eq('queue_item_id', qrow.id).maybeSingle();
  console.log('STEP 4b: issued →', iss ? `${iss.serial_no} ${iss.status}` : 'MISSING');
  if (!iss) { friction.push('발행 후 issuance row 없음'); throw new Error('no issuance'); }
  // 납부확인 (NTPN prompt)
  opPage.on('dialog', d => d.accept(NTPN));
  const paidBtn = opPage.getByRole('button', { name: '납부확인' }).first();
  if (!(await paidBtn.count())) friction.push('납부확인 버튼 없음');
  await paidBtn.click();
  await opPage.waitForTimeout(3000);
  await opPage.screenshot({ path: `${SHOTS}/8-board-paid.png` });

  // ── 5. 최종 상태 ──
  const { data: issAfter } = await admin.from('id_billing_issuance').select('status, ntpn').eq('id', iss.id).single();
  const { data: qAfter } = await admin.from('djp_submission_queue').select('status, ntpn').eq('id', qrow.id).single();
  console.log('STEP 5: issuance →', issAfter?.status, issAfter?.ntpn, '| queue →', qAfter?.status, qAfter?.ntpn);
  const done = issAfter?.status === 'PAID' && qAfter?.status === 'COMPLETED' && qAfter?.ntpn === NTPN;
  console.log(done ? '🏁 GOLDEN PATH COMPLETE' : '❌ INCOMPLETE');

  await browser.close();
  console.log('\nFRICTION NOTES:', friction.length ? friction : 'none');
  await cleanup();
  console.log('cleaned up');
  process.exit(done ? 0 : 1);
}
main().catch(async e => { console.error('FAILED:', e.message); console.log('FRICTION NOTES:', friction); await cleanup(); process.exit(1); });
