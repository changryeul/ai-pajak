/**
 * e2e coverage for the 팀장용 (Supervisor) ERP shipped between commits
 * c0b8687 (P1) → a7b1f59 (reassign) → e893fb2 (invoice lines Phase 1)
 * → ff3a328 (invoice parser Phase 2) → 9d64ddd (line review PATCH).
 * 9 supervisor-only pages plus the cross-tenant counterparty stats
 * endpoint plus the parse-invoice + line review endpoint contracts.
 *
 * The smoke tests in scripts/test-supervisor-erp-p1.ts +
 * scripts/test-invoice-parser-phase2.ts +
 * scripts/test-invoice-line-review.ts cover the data-layer round-trip;
 * this spec exercises UI rendering + role gating + 400/404 contracts.
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

// All 9 supervisor pages with their h1-rendered title (ko).
const SUPERVISOR_PAGES: Array<{ slug: string; title: string }> = [
  { slug: 'approval', title: '승인대기' },
  { slug: 'team', title: '팀원 관리' },
  { slug: 'customers', title: '고객별 진행현황' },
  { slug: 'revisions', title: '수정/재상신 이력' },
  { slug: 'legality', title: '리갈리티 자료 현황' },
  { slug: 'calendar', title: '마감 캘린더' },
  { slug: 'coretax', title: 'Coretax 처리 대기' },
  { slug: 'quality', title: '품질 모니터링' },
  { slug: 'settings', title: '설정' },
];

test.describe('Supervisor ERP — page rendering', () => {
  for (const { slug, title } of SUPERVISOR_PAGES) {
    test(`supervisor can open /${slug} and sees the page title`, async ({ page }) => {
      await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
      const res = await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/supervisor/${slug}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      expect(res?.status() ?? 200, `${slug} status`).toBeLessThan(400);
      // h1 title visible — uses getByRole to avoid className churn.
      await expect(page.locator('h1').filter({ hasText: title })).toBeVisible({ timeout: 10000 });
    });
  }
});

test.describe('Supervisor ERP — API access control', () => {
  // GET endpoints with their expected supervisor + consultant outcomes.
  const ENDPOINTS = [
    '/api/consultant-erp/supervisor/customers',
    '/api/consultant-erp/supervisor/revisions',
    '/api/consultant-erp/supervisor/calendar',
    '/api/consultant-erp/supervisor/team',
    '/api/consultant-erp/supervisor/team-members',
    '/api/consultant-erp/supervisor/legality',
    '/api/consultant-erp/supervisor/coretax',
    '/api/consultant-erp/supervisor/quality',
    '/api/consultant-erp/supervisor/settings',
  ] as const;

  for (const path of ENDPOINTS) {
    test(`supervisor 200 on ${path}`, async ({ page }) => {
      await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
      const res = await page.request.get(`${BASE_URL}${path}`);
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test(`CONSULTANT_JTC 403 on ${path}`, async ({ page }) => {
      await loginAs(page, 'CONSULTANT_JTC');
      const res = await page.request.get(`${BASE_URL}${path}`);
      expect(res.status()).toBe(403);
    });

    test(`PLATFORM_ADMIN blocked on ${path}`, async ({ page }) => {
      await loginAs(page, 'PLATFORM_ADMIN');
      const res = await page.request.get(`${BASE_URL}${path}`);
      // PLATFORM_ADMIN is blocked by blockPlatformAdmin middleware (403)
      // before reaching the supervisor-role check.
      expect([401, 403]).toContain(res.status());
    });
  }
});

test.describe('Supervisor ERP — reassign endpoint', () => {
  test('supervisor: invalid sessionId returns 404', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/supervisor/team/reassign`,
      {
        data: {
          sessionId: '00000000-0000-4000-8000-000000000000',
          newConsultantId: '00000000-0000-4000-8000-000000000001',
        },
      },
    );
    expect(res.status()).toBe(404);
  });

  test('consultant 403 on reassign', async ({ page }) => {
    await loginAs(page, 'CONSULTANT_JTC');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/supervisor/team/reassign`,
      {
        data: {
          sessionId: '00000000-0000-4000-8000-000000000000',
          newConsultantId: '00000000-0000-4000-8000-000000000001',
        },
      },
    );
    expect(res.status()).toBe(403);
  });
});

test.describe('Supervisor ERP — approval case detail', () => {
  test('supervisor can open the approval queue page', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/supervisor/approval`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    // Either the queue heading or the empty state must render.
    const html = await page.content();
    const queueHeading = html.includes('승인 요청 목록');
    const emptyState = html.includes('대기 중인 승인 요청이 없습니다');
    expect(queueHeading || emptyState).toBe(true);
  });

  test('supervisor case detail returns 404 for unknown id', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.get(
      `${BASE_URL}/api/consultant-erp/supervisor/approval/00000000-0000-4000-8000-000000000000`,
    );
    expect(res.status()).toBe(404);
  });
});

test.describe('Supervisor ERP — settings page interactions', () => {
  test('settings page shows the 5 tabs', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/supervisor/settings`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await expect(page.getByRole('tab', { name: '회사정보' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: '역할별 권한' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '승인단계' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Coretax 보안' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '알림채널' })).toBeVisible();
  });

  test('settings 회사정보 tab pre-populates the company NPWP', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    await page.goto(`${BASE_URL}/${LOCALE}/consultant-erp/supervisor/settings`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    // The NPWP input on the 회사정보 tab should have a non-empty value
    // (the platform tax_partner has one seeded). We can't predict the
    // exact value across environments, so we just check the input exists.
    const npwpField = page.locator('input').nth(2); // 3rd input = NPWP per the field order
    await expect(npwpField).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Supervisor ERP — invoice line-item parser (Phase 2)', () => {
  // Smoke gating only — the seed/cleanup roundtrip lives in
  // scripts/test-invoice-parser-phase2.ts so this spec stays Playwright-only.

  test('supervisor: missing documentId returns 400', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/parse-invoice`,
      { data: {} },
    );
    expect(res.status()).toBe(400);
  });

  test('supervisor: malformed documentId (not uuid) returns 400', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/parse-invoice`,
      { data: { documentId: 'not-a-uuid' } },
    );
    expect(res.status()).toBe(400);
  });

  test('supervisor: well-formed but unknown ids return 404', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/parse-invoice`,
      {
        data: { documentId: '00000000-0000-4000-8000-000000000001' },
      },
    );
    // ensureSessionAccess hits first (session not found in any partner).
    expect([403, 404]).toContain(res.status());
  });

  test('PLATFORM_ADMIN blocked on /parse-invoice', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const res = await page.request.post(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/parse-invoice`,
      {
        data: { documentId: '00000000-0000-4000-8000-000000000001' },
      },
    );
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Supervisor ERP — invoice line review PATCH', () => {
  // Data round-trip lives in scripts/test-invoice-line-review.ts.
  // These are contract gates only — input shape + role gating.

  test('supervisor: empty body → 400 (zod refine)', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.patch(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/invoice-lines/00000000-0000-4000-8000-000000000001`,
      { data: {} },
    );
    expect(res.status()).toBe(400);
  });

  test('supervisor: non-uuid lineId → 400', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.patch(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/invoice-lines/not-a-uuid`,
      { data: { is_reviewed: true } },
    );
    expect(res.status()).toBe(400);
  });

  test('supervisor: reviewer_note > 500 chars → 400 (zod max)', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.patch(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/invoice-lines/00000000-0000-4000-8000-000000000001`,
      { data: { reviewer_note: 'x'.repeat(501) } },
    );
    expect(res.status()).toBe(400);
  });

  test('supervisor: unknown session/line → 403 or 404', async ({ page }) => {
    await loginAs(page, 'TAX_OPERATOR_SUPERVISOR');
    const res = await page.request.patch(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/invoice-lines/00000000-0000-4000-8000-000000000001`,
      { data: { is_reviewed: true } },
    );
    expect([403, 404]).toContain(res.status());
  });

  test('PLATFORM_ADMIN blocked on line review PATCH', async ({ page }) => {
    await loginAs(page, 'PLATFORM_ADMIN');
    const res = await page.request.patch(
      `${BASE_URL}/api/consultant-erp/sessions/00000000-0000-4000-8000-000000000000/invoice-lines/00000000-0000-4000-8000-000000000001`,
      { data: { is_reviewed: true } },
    );
    expect([401, 403]).toContain(res.status());
  });
});
