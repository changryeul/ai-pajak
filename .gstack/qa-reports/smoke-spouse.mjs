#!/usr/bin/env node
// Smoke test: spouse + dependents widget on the INDIVIDUAL dashboard.
// Assumes an already-onboarded INDIVIDUAL customer exists.
// Uses the test account created by smoke-onboarding.mjs (re-runs signup if needed).

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = `smoke.spouse.${Date.now()}@example.com`;
const PASSWORD = 'SmokeTest123!';
const NPWP = String(Date.now()).slice(-15).padStart(15, '9');

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text().slice(0, 200)}`); });
page.on('request', (r) => {
  const url = r.url();
  if (url.includes('/api/customer/profile') && r.method() === 'PATCH') {
    logs.push(`[req] PATCH ${url.replace(BASE, '')} body=${(r.postData() || '').slice(0, 200)}`);
  }
});
page.on('response', async (r) => {
  const url = r.url();
  if (url.includes('/api/customer/profile')) {
    let body = '';
    try { body = (await r.text()); } catch {}
    // Extract ptkp_status or full payload
    const extract = body.match(/"ptkp_status":"[^"]*"/)?.[0] || body.slice(0, 200);
    logs.push(`[api] ${r.request().method()} ${r.status()} ${extract}`);
  }
});

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
    console.log(`  ✓ ok`);
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    await page.screenshot({ path: `.gstack/qa-reports/screenshots/smoke-spouse-fail-${name.replace(/\W/g, '-')}.png`, fullPage: true });
    throw e;
  }
}

try {
  // Fresh signup (fastest path to a working INDIVIDUAL session)
  // 2-step form (2026-04-18 redesign): step1 basics → step2 password
  await step('signup + onboarding', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // Step 1: basics
    await page.fill('input[name="fullName"]', 'Smoke Spouse User');
    await page.fill('input[name="idNumber"]', NPWP);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.locator('button[type="submit"]').click();
    // Step 2: password
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirmPassword"]', PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname.includes('/register/terms'), { timeout: 30000 });

    // Terms
    const scrollBox = await page.locator('.h-64.overflow-auto').first();
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200);
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button').filter({ hasText: /Lanjut|Next/ }).first().click();
    await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 30000 });

    // Mandate
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button').filter({ hasText: /Mulai|Start/ }).first().click();
    await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  await step('dashboard shows spouse card (default: single, TK/0)', async () => {
    // The card's title is localised ("Status Pernikahan & Tanggungan" on /id).
    const card = await page.locator('text=Status Pernikahan & Tanggungan').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/smoke-spouse-initial.png', fullPage: true });
    const ptkpText = await page.locator('text=/TK\\/\\d|K\\/\\d|K\\/I\\/\\d/').first().textContent();
    if (!ptkpText?.includes('TK/0')) throw new Error(`expected TK/0, got ${ptkpText}`);
  });

  // Helper: wait for autosave to complete (observes any PATCH response)
  async function waitForSave() {
    const r = await page.waitForResponse(
      (resp) => resp.url().includes('/api/customer/profile') && resp.request().method() === 'PATCH',
      { timeout: 10000 },
    );
    console.log(`    [waitForSave] ${r.status()}`);
  }

  await step('choose married → K/0 shown', async () => {
    const p = waitForSave();
    await page.locator('input[type="radio"][value="married"]').check();
    await p;
    const ptkpText = await page.locator('text=/TK\\/\\d|K\\/\\d|K\\/I\\/\\d/').first().textContent();
    if (!ptkpText?.includes('K/0')) throw new Error(`expected K/0, got ${ptkpText}`);
  });

  await step('choose joint filing → spouse inputs appear (K/I requires income)', async () => {
    const p = waitForSave();
    await page.locator('input[type="radio"][value="joint"]').check();
    await p;
    const spouseIncomeInput = await page.locator('input[type="number"]').count();
    if (spouseIncomeInput < 2) throw new Error(`expected spouse income inputs, counted ${spouseIncomeInput}`);
  });

  await step('enter spouse income → K/I/0 activated', async () => {
    const incomes = await page.locator('input[type="number"]').all();
    const p = waitForSave();
    await incomes[0].fill('50000000');
    await p;
    const ptkpText = await page.locator('text=/K\\/I\\/\\d/').first().textContent();
    if (!ptkpText?.includes('K/I/0')) throw new Error(`expected K/I/0, got ${ptkpText}`);
  });

  await step('set dependents=2 → K/I/2', async () => {
    const btns = await page.locator('button').filter({ hasText: /^[0-3]$/ }).all();
    if (btns.length < 4) throw new Error(`expected 4 dependent buttons, got ${btns.length}`);
    const p = waitForSave();
    await btns[2].click();
    await p;
    const ptkpText = await page.locator('text=/K\\/I\\/\\d/').first().textContent();
    if (!ptkpText?.includes('K/I/2')) throw new Error(`expected K/I/2, got ${ptkpText}`);
  });

  await step('autosave → server persists ptkp_status=K/I/2', async () => {
    // All 4 PATCHes awaited inline via waitForSave(); skip extra wait.
    await page.waitForTimeout(500);
    // Reload and verify the server persisted
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Status Pernikahan', { timeout: 30000 });
    await page.locator('text=Status Pernikahan').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const ptkpText = await page.locator('text=/K\\/I\\/\\d/').first().textContent();
    if (!ptkpText?.includes('K/I/2')) {
      throw new Error(`expected persisted K/I/2 after reload, got ${ptkpText}`);
    }
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/smoke-spouse-persisted.png', fullPage: true });
  });

  console.log('\n✅ All spouse card steps passed');
  console.log(`email used: ${EMAIL}`);
} catch (e) {
  console.log(`\n❌ FAILED: ${e.message}`);
  console.log('\n--- last 15 logs ---');
  logs.slice(-15).forEach((l) => console.log(l));
  process.exitCode = 1;
} finally {
  await browser.close();
}
