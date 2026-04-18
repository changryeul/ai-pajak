#!/usr/bin/env node
// End-to-end smoke: anomaly detection card + funding-source survey.
// Seeds 2 years of asset + income snapshots that trigger the 1.5× rule,
// then exercises the survey save path.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const EMAIL = `smoke.anom.${Date.now()}@example.com`;
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
    await page.fill('input[name="fullName"]', 'Anom User');
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

  await step('seed snapshots: asset +50% / income +10% (anomaly trigger)', async () => {
    const posts = [
      { kind: 'asset', snapshot_year: 2024, category: 'CASH_BANK', amount_idr: 100_000_000 },
      { kind: 'asset', snapshot_year: 2025, category: 'CASH_BANK', amount_idr: 150_000_000 },
      { kind: 'income', snapshot_year: 2024, source: 'EMPLOYMENT', gross_income_idr: 200_000_000 },
      { kind: 'income', snapshot_year: 2025, source: 'EMPLOYMENT', gross_income_idr: 220_000_000 },
    ];
    for (const body of posts) {
      const r = await page.evaluate(async (b) => {
        const res = await fetch('/api/customer/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(b),
        });
        return { status: res.status, body: await res.json() };
      }, body);
      if (r.status !== 200) throw new Error(`seed fail: ${JSON.stringify(r)}`);
    }
  });

  await step('dashboard shows warning banner + survey', async () => {
    await page.goto(`${BASE}/id/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Deteksi Anomali Aset', { timeout: 15000 });
    await page.waitForTimeout(2000); // let the card load snapshots
    const warningVisible = await page.locator('text=tumbuh lebih cepat').count();
    if (warningVisible === 0) throw new Error('warning banner not found');
    // Funding prompt should be visible
    const promptVisible = await page.locator('text=sumber pertumbuhan').count();
    if (promptVisible === 0) throw new Error('funding prompt not visible');
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/anomaly-warning.png', fullPage: true });
  });

  await step('tick "Gaji" + "Investasi" → save', async () => {
    // Find the labels by text
    await page.locator('label', { hasText: 'Gaji' }).locator('input[type="checkbox"]').check();
    await page.locator('label', { hasText: 'Investasi' }).locator('input[type="checkbox"]').check();
    await page.locator('textarea').fill('Jual rumah dan investasi reksa dana.');
    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/api/customer/funding-source') && r.request().method() === 'POST',
      { timeout: 10000 },
    );
    await page.locator('button', { hasText: 'Simpan jawaban' }).click();
    const resp = await savePromise;
    if (resp.status() !== 200) throw new Error(`save returned ${resp.status()}`);
    await page.waitForSelector('text=/✓ Tersimpan|Tersimpan/', { timeout: 5000 });
  });

  await step('reload → survey persisted', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Deteksi Anomali Aset', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const gajiChecked = await page.locator('label', { hasText: 'Gaji' })
      .locator('input[type="checkbox"]').isChecked();
    if (!gajiChecked) throw new Error('Gaji not persisted');
    const noteValue = await page.locator('textarea').inputValue();
    if (!noteValue.includes('reksa dana')) throw new Error(`note not persisted: ${noteValue}`);
  });

  console.log(`\n✅ All anomaly/funding steps passed (email: ${EMAIL})`);
} catch (e) {
  console.log(`\n❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  await b.close();
}
