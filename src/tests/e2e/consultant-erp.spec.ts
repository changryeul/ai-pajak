import { test, expect, type Page } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const LOCALE = 'ko';

async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  if (!('email' in user)) return;

  await page.goto(`${BASE_URL}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input:not([type="password"])').first().fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|ko)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const ERP_PAGES = ['dashboard', 'work', 'legality', 'counterparty'] as const;

test.describe('Consultant ERP — P0 skeleton', () => {
  test('CONSULTANT_JTC can open all 4 ERP pages', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    for (const slug of ERP_PAGES) {
      const res = await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/${slug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      expect(res?.status(), `${slug} status`).toBeLessThan(400);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('TAX_ADVISOR_JTC can open all 4 ERP pages', async ({ page }) => {
    await loginAs(page, 'TAX_ADVISOR_JTC');
    for (const slug of ERP_PAGES) {
      const res = await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/${slug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      expect(res?.status(), `${slug} status`).toBeLessThan(400);
    }
  });
});

test.describe('Consultant ERP — page content checks', () => {
  test('dashboard page renders board section', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    expect(html).toContain('고객별 업무 현황판');
  });

  test('work page renders 5-step navigator hint', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/work`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    expect(html).toContain('5단계 신고 워크플로우');
  });

  test('counterparty page renders search panel', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/counterparty`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    expect(html).toContain('Counterparty Master');
  });

  test('legality page renders vault sections', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/legality`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    expect(html).toContain('고객 법인 기본자료 보관함');
  });
});

test.describe('Consultant ERP — API access control', () => {
  test('CUSTOMER cannot access /api/consultant-erp/sessions/board', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/consultant-erp/sessions/board`);
    expect([401, 403]).toContain(res.status());
  });

  test('CUSTOMER cannot search counterparty master', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/consultant-erp/counterparty`);
    expect([401, 403]).toContain(res.status());
  });

  test('PLATFORM_ADMIN is blocked from ERP endpoints', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const res = await page.request.get(`${BASE_URL}/api/consultant-erp/sessions/board`);
    expect([401, 403]).toContain(res.status());
  });
});
