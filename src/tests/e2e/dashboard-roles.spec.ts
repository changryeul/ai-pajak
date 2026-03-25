import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

async function loginAs(page: ReturnType<typeof test.step extends (...args: infer A) => infer R ? never : never>, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  if (!('email' in user)) return;

  await page.goto(`${BASE_URL}/id/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe('Landing Page', () => {
  test('should display landing page with pricing', async ({ page }) => {
    await page.goto(`${BASE_URL}/id`);
    // Hero section
    await expect(page.locator('h1')).toBeVisible();
    // Pricing section
    await expect(page.getByText('Rp 0')).toBeVisible();
    await expect(page.getByText('Rp 199K')).toBeVisible();
    await expect(page.getByText('Rp 499K')).toBeVisible();
  });

  test('should have login and register links', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });
});

test.describe('CUSTOMER Dashboard', () => {
  test('should show customer dashboard with quick actions', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    await expect(page.locator('h1')).toContainText('대시보드');
    // Quick actions should use friendly language
    await expect(page.getByText('연말정산 하기')).toBeVisible();
  });

  test('should show customer-specific sidebar items', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    // Should see filing/documents/POA
    await expect(page.getByText('위임장 작성')).toBeVisible();
    // Should NOT see admin items
    await expect(page.getByText('시스템 모니터링')).not.toBeVisible();
    // Should NOT see customer management
    await expect(page.getByText('고객 관리')).not.toBeVisible();
  });
});

test.describe('CONSULTANT Dashboard', () => {
  test('should show consultant dashboard with stats', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await expect(page.locator('h1')).toBeVisible();
    // Should have stats cards
    await expect(page.getByText('활성 고객')).toBeVisible();
    await expect(page.getByText('대기 중인 신고')).toBeVisible();
  });

  test('should show consultant sidebar items', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    await expect(page.getByText('고객 관리')).toBeVisible();
    await expect(page.getByText('신고 관리')).toBeVisible();
    // Should NOT see POA creation (customer only)
    await expect(page.getByText('위임장 작성')).not.toBeVisible();
  });
});

test.describe('PLATFORM_ADMIN Dashboard', () => {
  test('should show admin dashboard without tax data', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    await expect(page.locator('h1')).toContainText('플랫폼 관리');
    // Should NOT see tax-related items
    await expect(page.getByText('연말정산')).not.toBeVisible();
  });

  test('should show admin-specific sidebar', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    await expect(page.getByText('시스템 모니터링')).toBeVisible();
    // Should NOT see customer management (tax data)
    await expect(page.getByText('고객 관리')).not.toBeVisible();
  });
});

test.describe('Security - Hard Rule #1', () => {
  test('PLATFORM_ADMIN cannot access tax filings API', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const response = await page.request.get(`${BASE_URL}/api/tax/filings`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(403);
  });

  test('PLATFORM_ADMIN cannot access customers API', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const response = await page.request.get(`${BASE_URL}/api/customers`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe('Dark Mode', () => {
  test('should toggle dark mode', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    // Find theme toggle button
    const themeButton = page.locator('button').filter({ has: page.locator('svg.lucide-moon, svg.lucide-sun') });
    if (await themeButton.count() > 0) {
      await themeButton.first().click();
      // Check that dark class is applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });
});
