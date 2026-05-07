/**
 * 「상담원 백오피스」 페이지 렌더링 e2e — Phase F.2.
 *
 * EMP001 로그인 후 5단계 워크플로우 페이지가 실제로 렌더되고 핵심 UI 요소가
 * 보이는지 검증한다. API 레벨은 operator-staff-workflow.spec.ts가 다루고, 여기는
 * 사용자 시야의 회귀를 잡는다.
 *
 * Prerequisites: dev server + local Supabase + 시드 (Phase A) 완료된 상태.
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const LOCALE = 'ko';

async function loginAsEmp001(page: Page) {
  const user = TEST_USERS.TAX_OPERATOR_EMP001;
  await page.goto(`${BASE_URL}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // 로그인 input은 'text' 타입 (이메일 또는 NPWP 둘 다 받음). 첫 input + password input 사용.
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  const inputs = page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') });
  await inputs.first().fill(user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  // /dashboard 가 EMP001을 /operator/my-work 로 리다이렉트.
  await page.waitForURL(/\/operator\/(my-work|dashboard)/, { timeout: 20000 });
  // 첫 fetch 안정화.
  await page.waitForTimeout(1500);
}

test.describe('상담원 페이지 렌더링', () => {
  // 같은 describe 안에서 페이지 navigation을 이어가므로 serial.
  test.describe.configure({ mode: 'serial' });

  test('① 내 업무 — 헤더 + 시드 케이스 카드', async ({ page }) => {
    await loginAsEmp001(page);
    // /dashboard 자동 리다이렉트가 my-work로 보내야 한다.
    await page.waitForURL(/\/operator\/my-work/, { timeout: 15000 });

    await expect(page.getByRole('heading', { name: '상담원 업무 화면' })).toBeVisible({ timeout: 15000 });

    // 4 데모 케이스 카드 (Phase A 시드). first()로 strict mode 회피.
    await expect(page.getByText('PT Hijau Lumut').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('PT ABC').first()).toBeVisible();
    await expect(page.getByText('PT Sehat Sentosa').first()).toBeVisible();
    await expect(page.getByText('PT Maju Bersama').first()).toBeVisible();

    // 빠른 필터 + 사용 방법 사이드.
    await expect(page.getByRole('heading', { name: '빠른 필터' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '사용 방법' })).toBeVisible();
  });

  test('② 검토 — 카드 클릭 → review-case 진입 + Sticky 패널', async ({ page }) => {
    await loginAsEmp001(page);
    await page.waitForURL(/\/operator\/my-work/);
    // PT Sehat Sentosa 카드 클릭 (APPROVED 상태라 다음 작업 패널이 풍부함).
    await page.getByText('PT Sehat Sentosa').first().click();
    await page.waitForURL(/\/operator\/review-case\//, { timeout: 15000 });

    // 좌측 「내 고객」 + 중앙 헤더 + 우측 다음 작업.
    await expect(page.getByRole('heading', { name: '내 고객' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: '확인할 항목' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '다음 작업' })).toBeVisible();

    // OCR 추가 버튼 (Phase C).
    await expect(page.getByRole('button', { name: /Invoice OCR 추가/ })).toBeVisible();
  });

  test('③ 승인요청 — Final Review 테이블', async ({ page }) => {
    await loginAsEmp001(page);
    await page.goto(`${BASE_URL}/${LOCALE}/operator/approval-request`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // lastCase가 자동 점프시키거나 카드 그리드 둘 중 하나.
    await page.waitForURL(/\/operator\/approval-request/, { timeout: 15000 });

    // approval-request/[id] 또는 카드 리스트 둘 다 「Supervisor 승인요청」 헤더가 있어야 한다.
    await expect(page.getByRole('heading', { name: /Supervisor 승인요청|승인요청/ })).toBeVisible({ timeout: 10000 });
  });

  test('④ Coretax 처리 — 페이지 로드', async ({ page }) => {
    await loginAsEmp001(page);
    await page.goto(`${BASE_URL}/${LOCALE}/operator/coretax`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForURL(/\/operator\/coretax/, { timeout: 15000 });
    // landing 또는 detail 페이지 둘 다 「Coretax 처리」 헤더가 있다.
    await expect(page.getByRole('heading', { name: 'Coretax 처리' })).toBeVisible({ timeout: 15000 });
  });

  test('⑤ 이력 — 페이지 로드', async ({ page }) => {
    await loginAsEmp001(page);
    await page.goto(`${BASE_URL}/${LOCALE}/operator/history`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForURL(/\/operator\/history/, { timeout: 15000 });
    // landing 또는 detail 페이지 둘 다 헤더 매치.
    await expect(page.getByRole('heading').filter({ hasText: /이력/ }).first()).toBeVisible({ timeout: 15000 });
  });

  test('사이드바 — 5 평면 메뉴 (TAX_OPERATOR 분기)', async ({ page }) => {
    await loginAsEmp001(page);
    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByText('내 업무')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('검토')).toBeVisible();
    await expect(sidebar.getByText('승인요청')).toBeVisible();
    await expect(sidebar.getByText('Coretax 처리')).toBeVisible();
    await expect(sidebar.getByText('이력')).toBeVisible();
    // Supervisor 콘솔 메뉴는 보이면 안 된다.
    await expect(sidebar.getByText('워크로드 관리')).not.toBeVisible();
    await expect(sidebar.getByText('승인 규칙')).not.toBeVisible();
  });
});
