/**
 * 상담원 통합 업무함 (PPh21 골든 패턴) e2e — 페이지 렌더 + 접근 게이트.
 *
 * operator.test 는 전용 full-bleed workqueue 를 열어 사이드바를 본다.
 * customer.test 는 fullscreen 레이아웃 게이트에 의해 /dashboard 로 리다이렉트된다.
 *
 * Prerequisites: dev server + 시드 완료 + operator MFA 토글 OFF (CLAUDE.md 경고).
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const LOCALE = 'ko';

async function loginViaForm(page: Page, email: string, password: string) {
  // 로그인 폼은 flaky 할 수 있어 한 번 재시도한다.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${BASE_URL}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    const inputs = page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') });
    await inputs.first().fill(email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(/\/(dashboard|operator)\b/, { timeout: 20000 });
      return;
    } catch {
      if (attempt === 1) throw new Error(`login did not redirect for ${email}`);
    }
  }
}

test.describe('operator workqueue', () => {
  test('operator can open the workqueue and sees the sidebar', async ({ page }) => {
    await loginViaForm(page, 'operator.test@aipajak.com', 'TestPassword123!');
    await page.goto(`${BASE_URL}/${LOCALE}/operator/workqueue`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    await expect(page.getByText('상담원 업무함')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('개인소득세 (PPh 21)')).toBeVisible({ timeout: 15000 });
  });

  test('customer is redirected away from the workqueue', async ({ page }) => {
    await loginViaForm(page, 'customer.test@example.com', 'TestPassword123!');
    await page.goto(`${BASE_URL}/${LOCALE}/operator/workqueue`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
