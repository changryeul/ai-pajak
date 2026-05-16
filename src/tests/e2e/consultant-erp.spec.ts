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
