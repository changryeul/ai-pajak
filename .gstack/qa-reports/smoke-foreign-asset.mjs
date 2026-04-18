#!/usr/bin/env node
// End-to-end smoke: foreign asset reporting card.
// Signs up → seeds foreign asset crossing KR threshold → verifies warning.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const EMAIL = `smoke.xb.${Date.now()}@example.com`;
const PW = 'Pw123456!';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1200 }, locale: 'id-ID' });
const page = await ctx.newPage();

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try { await fn(); console.log('  ✓'); } catch (e) { console.log(`  ✗ ${e.message}`); throw e; }
}

try {
  await step('signup + onboarding', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'networkidle' });
    await page.locator('text=개인 납세자').first().click();
    await page.waitForTimeout(300);
    await page.fill('input[name="fullName"]', 'XB User');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.fill('input[name="password"]', PW);
    await page.fill('input[name="confirmPassword"]', PW);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname.includes('/register/terms'), { timeout: 15000 });
    const tb = await page.locator('.h-64.overflow-auto').first();
    await tb.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button').filter({ hasText: /Lanjut/ }).first().click();
    await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 30000 });
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button').filter({ hasText: /Mulai/ }).first().click();
    await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
  });

  await step('seed foreign asset 6B IDR (≈ 520M KRW, above 500M threshold)', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'asset', snapshot_year: 2025, category: 'INVESTMENT',
          amount_idr: 6_000_000_000,
          currency: 'KRW', amount_original: 520_000_000, exchange_rate: 11.5,
          is_foreign: true, label: 'Seoul brokerage',
        }),
      });
      return { status: res.status, body: await res.json() };
    });
    if (r.status !== 200) throw new Error(JSON.stringify(r));
  });

  await step('pick nationality=KR via PATCH (simulate UI)', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationality: 'KR', tax_residence_country: 'ID' }),
      });
      return { status: res.status, body: await res.json() };
    });
    if (r.status !== 200) throw new Error(JSON.stringify(r));
  });

  await step('dashboard shows required-report warning for Korea', async () => {
    await page.goto(`${BASE}/id/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Kewajiban Pelaporan Aset Luar Negeri', { timeout: 15000 });
    await page.waitForTimeout(3000);
    const needsReport = await page.locator('text=Kemungkinan perlu lapor').count();
    if (needsReport === 0) throw new Error('expected "perlu lapor" warning');
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/foreign-asset-warning.png', fullPage: true });
  });

  await step('switch to nationality=ID → warning clears', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationality: 'ID' }),
      });
      return res.status;
    });
    if (r !== 200) throw new Error(`patch failed: ${r}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Kewajiban Pelaporan Aset Luar Negeri', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const warnCount = await page.locator('text=Kemungkinan perlu lapor').count();
    if (warnCount !== 0) throw new Error('warning did not clear for ID');
    const noRuleText = await page.locator('text=Tidak ada kewajiban').count();
    if (noRuleText === 0) throw new Error('expected "no extra rule" message');
  });

  console.log(`\n✅ All foreign-asset steps passed (email: ${EMAIL})`);
} catch (e) {
  console.log(`\n❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  await b.close();
}
