/**
 * e2e coverage for the OperatorQueueDailyTrend chart shipped in 76f8e87.
 *
 * API surface — /api/operator/queue-daily-trend
 *   - SUPERVISOR can read; response shape { days, statuses }
 *   - Default ?days returns 14 buckets, ?days=7 returns 7
 *   - PLATFORM_ADMIN blocked (operator-only)
 *
 * UI surface — /operator/dashboard
 *   - Supervisor sees the daily trend section heading
 *   - Day-range pills [7일 / 14일 / 30일] all render
 *   - Clicking 30일 marks it active
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

test.describe('Queue daily trend — API surface', () => {
  test('SUPERVISOR gets { days[14], statuses } by default', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.get(`${BASE_URL}/api/operator/queue-daily-trend`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data?.days)).toBe(true);
    expect(json.data.days.length).toBe(14);
    expect(Array.isArray(json.data?.statuses)).toBe(true);
    // Every bucket has a date + byStatus + total shape.
    const first = json.data.days[0];
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof first.byStatus).toBe('object');
    expect(typeof first.total).toBe('number');
  });

  test('?days=7 returns exactly 7 buckets', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.get(
      `${BASE_URL}/api/operator/queue-daily-trend?days=7`,
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data?.days?.length).toBe(7);
  });

  test('?days=0 (invalid) falls back to 14', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.get(
      `${BASE_URL}/api/operator/queue-daily-trend?days=0`,
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data?.days?.length).toBe(14);
  });

  test('PLATFORM_ADMIN is blocked', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const res = await page.request.get(`${BASE_URL}/api/operator/queue-daily-trend`);
    expect([401, 403]).toContain(res.status());
  });

  test('CUSTOMER cannot access', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/operator/queue-daily-trend`);
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Queue daily trend — supervisor dashboard UI', () => {
  test('supervisor sees the daily trend section', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/operator/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const html = await page.content();
    // Section heading from OperatorQueueDailyTrend.
    expect(html).toContain('큐 일별 활동 추이');
  });

  test('day-range pills [7 / 14 / 30] are visible', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/operator/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await expect(page.getByRole('button', { name: '7일' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '14일' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30일' })).toBeVisible();
  });

  test('clicking 30일 marks it active (bg-slate-950 text-white)', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/operator/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    const pill30 = page.getByRole('button', { name: '30일' });
    await pill30.click();
    await page.waitForTimeout(800);
    // Active pill class includes 'bg-slate-950'
    await expect(pill30).toHaveClass(/bg-slate-950/);
    // 14일 should no longer be active.
    const pill14 = page.getByRole('button', { name: '14일' });
    await expect(pill14).not.toHaveClass(/bg-slate-950/);
  });
});
