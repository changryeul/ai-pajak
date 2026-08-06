/**
 * e2e coverage for FIRM_ADMIN (세무컨설팅 법인 관리자, P6 follow-up).
 *
 * 3 pages (/consultant-erp/firm-admin/{staff,clients,billing}) +
 * 3 API endpoints (/api/firm-admin/*) + landing redirect + setup-account
 * ghost guard. The data-layer round-trip lives in
 * scripts/test-firm-admin-flow.ts (16 asserts); this spec exercises
 * UI rendering + page/API role gating + 400/404/409 contracts.
 *
 * Run against prod (accounts pre-seeded):
 *   E2E_SKIP_GLOBAL_SETUP=1 BASE_URL=https://ai-pajak.vercel.app \
 *     npx playwright test firm-admin.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
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

const FIRM_ADMIN_PAGES: Array<{ slug: string; title: string }> = [
  { slug: 'staff', title: '직원 관리' },
  { slug: 'clients', title: '클라이언트 관리' },
  { slug: 'billing', title: '청구·구독 관리' },
];

const ENDPOINTS = [
  '/api/firm-admin/staff',
  '/api/firm-admin/clients',
  '/api/firm-admin/billing',
] as const;

// ── 1. Page rendering (FIRM_ADMIN) ─────────────────────────────────

test.describe('Firm Admin — page rendering', () => {
  for (const { slug, title } of FIRM_ADMIN_PAGES) {
    test(`FIRM_ADMIN can open /${slug} and sees the page title`, async ({ page }) => {
      await loginAs(page, 'FIRM_ADMIN');
      const res = await page.goto(
        `${BASE_URL}/${LOCALE}/consultant-erp/firm-admin/${slug}`,
        { waitUntil: 'networkidle', timeout: 30000 },
      );
      expect(res?.status() ?? 200, `${slug} status`).toBeLessThan(400);
      await expect(page.locator('h1').filter({ hasText: title })).toBeVisible({ timeout: 10000 });
    });
  }

  test('FIRM_ADMIN landing on /dashboard redirects to firm-admin/staff', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    await page.goto(`${BASE_URL}/${LOCALE}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // client-side window.location.replace — give it a beat
    await page.waitForURL(/\/consultant-erp\/firm-admin\/staff/, { timeout: 20000 });
    expect(page.url()).toContain('/consultant-erp/firm-admin/staff');
  });
});

// ── 2. Page gating (non-FIRM_ADMIN roles bounced) ──────────────────

test.describe('Firm Admin — page gating', () => {
  test('CONSULTANT is bounced from firm-admin pages', async ({ page }) => {
    await loginAs(page, 'CONSULTANT');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/firm-admin/staff`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    // firm-admin/layout.tsx redirects non-FIRM_ADMIN to consultant-erp dashboard
    expect(page.url()).not.toContain('/firm-admin/');
  });

  test('CUSTOMER is bounced from firm-admin pages', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/firm-admin/staff`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/firm-admin/');
  });

  test('EXTERNAL_CONSULTANT is bounced from firm-admin pages', async ({ page }) => {
    await loginAs(page, 'EXTERNAL_CONSULTANT');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/firm-admin/clients`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/firm-admin/');
  });
});

// ── 3. API access control ──────────────────────────────────────────

test.describe('Firm Admin — API access control', () => {
  for (const path of ENDPOINTS) {
    test(`FIRM_ADMIN 200 on ${path}`, async ({ page }) => {
      await loginAs(page, 'FIRM_ADMIN');
      const res = await page.request.get(`${BASE_URL}${path}`);
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test(`CONSULTANT (JTC) 403 on ${path}`, async ({ page }) => {
      await loginAs(page, 'CONSULTANT');
      const res = await page.request.get(`${BASE_URL}${path}`);
      expect(res.status()).toBe(403);
    });

    test(`EXTERNAL_CONSULTANT 403 on ${path}`, async ({ page }) => {
      await loginAs(page, 'EXTERNAL_CONSULTANT');
      const res = await page.request.get(`${BASE_URL}${path}`);
      expect(res.status()).toBe(403);
    });

    test(`PLATFORM_ADMIN blocked on ${path}`, async ({ page }) => {
      await loginAs(page, 'PLATFORM_ADMIN');
      const res = await page.request.get(`${BASE_URL}${path}`);
      // blockPlatformAdmin (403) fires before requireFirmAdmin
      expect([401, 403]).toContain(res.status());
    });
  }

  test('CUSTOMER 403 on /api/firm-admin/staff', async ({ page }) => {
    await loginAs(page, 'CUSTOMER');
    const res = await page.request.get(`${BASE_URL}/api/firm-admin/staff`);
    expect(res.status()).toBe(403);
  });
});

// ── 4. Write contracts (mutation-free) ─────────────────────────────

test.describe('Firm Admin — write contracts', () => {
  test('PATCH self deactivate → 400', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const list = await page.request.get(`${BASE_URL}/api/firm-admin/staff`);
    expect(list.status()).toBe(200);
    const { data } = await list.json();
    const self = (data.staff as Array<{ consultantId: string; isSelf: boolean }>).find(
      (s) => s.isSelf,
    );
    expect(self, 'self row must exist').toBeTruthy();
    const res = await page.request.patch(`${BASE_URL}/api/firm-admin/staff`, {
      data: { consultantId: self!.consultantId, isActive: false },
    });
    expect(res.status()).toBe(400);
  });

  test('PATCH unknown consultant → 404', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.patch(`${BASE_URL}/api/firm-admin/staff`, {
      data: { consultantId: '00000000-0000-0000-0000-00000000dead', isActive: false },
    });
    expect(res.status()).toBe(404);
  });

  test('PATCH without isActive/role → 400', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.patch(`${BASE_URL}/api/firm-admin/staff`, {
      data: { consultantId: '00000000-0000-0000-0000-000000000041' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST invite with existing consultant email → 409', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.post(`${BASE_URL}/api/firm-admin/staff`, {
      data: { email: TEST_USERS.EXTERNAL_CONSULTANT.email, role: 'CONSULTANT' },
    });
    expect(res.status()).toBe(409);
  });

  test('DELETE with malformed invitationId → 400', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.delete(
      `${BASE_URL}/api/firm-admin/staff?invitationId=not-a-uuid`,
    );
    expect(res.status()).toBe(400);
  });

  test('POST clients reassign to non-firm consultant → 404', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.post(`${BASE_URL}/api/firm-admin/clients`, {
      data: {
        customerId: '00000000-0000-4000-8000-000000000042',
        consultantId: '00000000-0000-0000-0000-00000000dead',
      },
    });
    expect(res.status()).toBe(404);
  });
});

// ── 5. setup-account ghost guard ───────────────────────────────────

test.describe('Firm Admin — setup-account ghost guard', () => {
  test('FIRM_ADMIN hitting setup-account is skipped (no ghost CUSTOMER)', async ({ page }) => {
    await loginAs(page, 'FIRM_ADMIN');
    const res = await page.request.post(`${BASE_URL}/api/auth/setup-account`, { data: {} });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
  });
});
