/**
 * e2e coverage for the closing trend panel on /tax/annual.
 *
 * Annual data → /api/tax/closing-filings (existed pre-786b436).
 * Quarter data → /api/tax/quarterly-trend (added in 786b436).
 *
 * The page itself is a COMPANY-customer surface so the UI tests log in as
 * the company test customer. API access control tests check the platform
 * admin block.
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const LOCALE = 'ko';

async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  if (!('email' in user)) return;

  await page.goto(`${BASE_URL}/${LOCALE}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input:not([type="password"])').first().fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|ko)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('Closing trend — API surface', () => {
  test('GET /api/tax/closing-filings returns success array for COMPANY customer', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/tax/closing-filings`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test('GET /api/tax/quarterly-trend returns the discriminated shape', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/tax/quarterly-trend`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Default: 2 years (current + prior).
    expect(Array.isArray(json.data?.years)).toBe(true);
    expect(json.data.years.length).toBeGreaterThanOrEqual(1);
    expect(json.data.years.length).toBeLessThanOrEqual(2);
    expect(Array.isArray(json.data?.quarters)).toBe(true);
    expect(Array.isArray(json.data?.taxTypes)).toBe(true);
    // yoy can be null (only-one-year) or an array of 4 entries.
    if (json.data.yoy !== null) {
      expect(Array.isArray(json.data.yoy)).toBe(true);
      expect(json.data.yoy.length).toBe(4);
    }
  });

  test('GET /api/tax/quarterly-trend honors ?years=YYYY (single year)', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    const year = new Date().getFullYear() - 1;
    const res = await page.request.get(
      `${BASE_URL}/api/tax/quarterly-trend?years=${year}`,
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data?.years).toEqual([year]);
    // yoy is null when only 1 year is requested.
    expect(json.data?.yoy).toBeNull();
  });

  test('PLATFORM_ADMIN is blocked from quarterly-trend (tax-data isolation)', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const res = await page.request.get(`${BASE_URL}/api/tax/quarterly-trend`);
    // blockPlatformAdmin middleware → 403 (could also be 401 in some auth states).
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Closing trend — UI panel', () => {
  test('COMPANY customer sees the trend panel on /tax/annual', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    await page.goto(`${BASE_URL}/${LOCALE}/tax/annual`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    // ko translation of closingTrend.title
    expect(html).toContain('최근 결산 트렌드');
  });

  test('trend panel renders both Annual + Quarterly tab triggers', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    await page.goto(`${BASE_URL}/${LOCALE}/tax/annual`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    // closingTrend.tabAnnual / tabQuarterly (ko: 연간 / 분기)
    await expect(page.getByRole('tab', { name: '연간' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: '분기' })).toBeVisible();
  });

  test('clicking Quarterly tab reveals the quarter view (year selector + chart title)', async ({ page }) => {
    await loginAs(page, 'COMPANY_CUSTOMER');
    await page.goto(`${BASE_URL}/${LOCALE}/tax/annual`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.getByRole('tab', { name: '분기' }).click();
    // wait for quarter fetch + render
    await page.waitForTimeout(1500);
    const html = await page.content();
    // closingTrend.yearSelector (ko: 비교 연도)
    expect(html).toContain('비교 연도');
    // either the chart title or empty-state hint is reachable
    const hasTitle = html.includes('분기별 세금 납부 추이');
    const hasEmpty = html.includes('월별 신고 데이터가 아직 없습니다');
    expect(hasTitle || hasEmpty).toBe(true);
  });
});
