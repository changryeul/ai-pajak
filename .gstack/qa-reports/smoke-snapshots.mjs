#!/usr/bin/env node
// Smoke test: asset / liability snapshot API end-to-end.
import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const EMAIL = `smoke.snap.${Date.now()}@example.com`;
const PW = 'Pw123456!';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
const page = await ctx.newPage();

const logs = [];
page.on('response', async (r) => {
  const u = r.url();
  if (u.includes('/api/customer/snapshots')) {
    let body = '';
    try { body = (await r.text()).slice(0, 300); } catch {}
    logs.push(`[api] ${r.request().method()} ${r.status()} ${body}`);
  }
});

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try { await fn(); console.log('  ✓'); } catch (e) {
    console.log(`  ✗ ${e.message}`);
    throw e;
  }
}

try {
  // Fast onboarding to get an authenticated INDIVIDUAL
  await step('signup + full onboarding', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'networkidle' });
    await page.locator('text=개인 납세자').first().click();
    await page.waitForTimeout(300);
    await page.fill('input[name="fullName"]', 'Snap User');
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

  // Exercise the API directly via fetch from the authenticated page.
  await step('GET /snapshots (empty) returns success: true with empty arrays', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', { credentials: 'include' });
      return { status: r.status, body: await r.json() };
    });
    if (result.status !== 200 || !result.body.success) throw new Error(JSON.stringify(result));
    if (result.body.data.assets.length !== 0) throw new Error('assets not empty');
    if (result.body.data.liabilities.length !== 0) throw new Error('liabilities not empty');
  });

  let createdAssetId;
  await step('POST asset snapshot (cash bank, 2025, 50M IDR)', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'asset', snapshot_year: 2025, category: 'CASH_BANK',
          amount_idr: 50_000_000, label: 'Mandiri savings',
        }),
      });
      return { status: r.status, body: await r.json() };
    });
    if (result.status !== 200) throw new Error(`${result.status} ${JSON.stringify(result.body)}`);
    createdAssetId = result.body.data.id;
    if (!createdAssetId) throw new Error('no id returned');
  });

  await step('POST foreign asset (2025, USD 10k → 150M IDR)', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'asset', snapshot_year: 2025, category: 'INVESTMENT',
          amount_idr: 150_000_000,
          currency: 'USD', amount_original: 10_000, exchange_rate: 15_000,
          is_foreign: true, label: 'US brokerage',
        }),
      });
      return { status: r.status, body: await r.json() };
    });
    if (result.status !== 200) throw new Error(JSON.stringify(result));
  });

  await step('POST liability (2025, 200M bank loan)', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'liability', snapshot_year: 2025, category: 'BANK_LOAN',
          amount_idr: 200_000_000, creditor_name: 'BCA',
        }),
      });
      return { status: r.status, body: await r.json() };
    });
    if (result.status !== 200) throw new Error(JSON.stringify(result));
  });

  await step('GET /snapshots returns 3 rows + summary totals', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', { credentials: 'include' });
      return r.json();
    });
    if (result.data.assets.length !== 2) throw new Error(`assets expected 2, got ${result.data.assets.length}`);
    if (result.data.liabilities.length !== 1) throw new Error(`liab expected 1, got ${result.data.liabilities.length}`);
    const a2025 = result.data.summary.assetByYear.find((y) => y.year === 2025);
    if (a2025?.total !== 200_000_000) throw new Error(`expected 200M, got ${a2025?.total}`);
    const f2025 = result.data.summary.foreignAssetByYear.find((y) => y.year === 2025);
    if (f2025?.total !== 150_000_000) throw new Error(`expected 150M foreign, got ${f2025?.total}`);
  });

  await step('POST invalid body → 400', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: 'asset', snapshot_year: 'not a number' }),
      });
      return { status: r.status, body: await r.json() };
    });
    if (result.status !== 400) throw new Error(`expected 400, got ${result.status}`);
  });

  await step('DELETE the first asset', async () => {
    const result = await page.evaluate(async (id) => {
      const r = await fetch('/api/customer/snapshots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: 'asset', id }),
      });
      return { status: r.status, body: await r.json() };
    }, createdAssetId);
    if (result.status !== 200) throw new Error(JSON.stringify(result));
  });

  await step('GET /snapshots shows 1 asset remaining', async () => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/customer/snapshots', { credentials: 'include' });
      return r.json();
    });
    if (result.data.assets.length !== 1) throw new Error(`expected 1 asset, got ${result.data.assets.length}`);
  });

  console.log(`\n✅ All snapshot API steps passed (email: ${EMAIL})`);
} catch (e) {
  console.log(`\n❌ ${e.message}`);
  console.log('\n--- api log tail ---');
  logs.slice(-10).forEach((l) => console.log(l));
  process.exitCode = 1;
} finally {
  await b.close();
}
