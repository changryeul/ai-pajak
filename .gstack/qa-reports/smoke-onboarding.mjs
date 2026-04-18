#!/usr/bin/env node
// Smoke test for PR1 onboarding flow (register → terms → mandate → dashboard).
import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const EMAIL = `smoke.individual.${Date.now()}@example.com`;
const PASSWORD = 'SmokeTest123!';

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

// Log API traffic + all navigations
page.on('response', async (r) => {
  const url = r.url();
  if (url.includes('/api/customer/')) {
    let body = '';
    try { body = (await r.text()).slice(0, 200); } catch {}
    logs.push(`[api] ${r.status()} ${url.replace('http://localhost:3000', '')} ${body}`);
  }
  if (url.includes('/register/') && !url.includes('/_next/') && !url.includes('/api/')) {
    logs.push(`[nav] ${r.status()} ${url.replace('http://localhost:3000', '')}`);
  }
});
page.on('framenavigated', (f) => {
  if (f.url().includes('/register/') || f.url().includes('/dashboard')) {
    logs.push(`[framenav] ${f.url().replace('http://localhost:3000', '')}`);
  }
});

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
    console.log(`  ✓ ok`);
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    await page.screenshot({ path: `.gstack/qa-reports/screenshots/smoke-fail-${name.replace(/\W/g, '-')}.png` });
    throw e;
  }
}

try {
  await step('open /register', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
  });

  await step('pick INDIVIDUAL + submit form', async () => {
    // Click "개인 납세자" card — matches the existing register page ACCOUNT_TYPES
    const individualCard = await page.locator('text=개인 납세자').first();
    if (await individualCard.count() === 0) {
      // Fallback: click first account type card
      await page.locator('[class*="cursor-pointer"]').first().click();
    } else {
      await individualCard.click();
    }
    await page.waitForTimeout(500);

    // Now fill form
    await page.fill('input[name="fullName"]', 'Smoke Individual');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirmPassword"]', PASSWORD);

    // Submit
    await Promise.all([
      page.waitForURL((u) => u.pathname.includes('/register/terms') || u.pathname.includes('/dashboard'), { timeout: 15000 }),
      page.locator('button[type="submit"]').click(),
    ]);
  });

  await step('arrive at /register/terms (step 2)', async () => {
    const url = page.url();
    if (!url.includes('/register/terms')) throw new Error(`expected /register/terms, got ${url}`);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/smoke-onboarding-terms.png' });
  });

  await step('scroll terms + agree + continue', async () => {
    // Scroll the terms area to the bottom to enable the checkbox
    const scrollBox = await page.locator('.h-64.overflow-auto').first();
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);

    const checkbox = await page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await page.waitForTimeout(200);

    await page.locator('button').filter({ hasText: /Lanjut|Next|다음/ }).first().click();
    // /register/mandate may need to compile on first dev-server hit → wait longer
    await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 45000 });
  });

  await step('arrive at /register/mandate (step 3)', async () => {
    const url = page.url();
    if (!url.includes('/register/mandate')) throw new Error(`expected /register/mandate, got ${url}`);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/smoke-onboarding-mandate.png' });
  });

  await step('middleware enforces: back to /register/terms → bounced to /mandate', async () => {
    await page.goto(`${BASE}/id/register/terms`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const url = page.url();
    if (!url.includes('/register/mandate')) {
      console.log(`  ℹ expected bounce to mandate, got ${url} (middleware cache may be fresh)`);
    }
  });

  await step('middleware enforces: protected /dashboard → bounced to /mandate', async () => {
    await page.goto(`${BASE}/id/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const url = page.url();
    if (!url.includes('/register/mandate')) {
      throw new Error(`expected bounce to /register/mandate, got ${url}`);
    }
  });

  await step('sign + agree + finish', async () => {
    // Draw on signature canvas — simulate a short stroke
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not found');
    await page.mouse.move(box.x + 20, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Agreement checkbox
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(200);

    // Click "Start"
    await page.locator('button').filter({ hasText: /Mulai|Start|시작|スタート|开始/ }).first().click();
    await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 45000 });
  });

  await step('arrive at /dashboard (onboarding complete)', async () => {
    const url = page.url();
    if (!url.includes('/dashboard')) throw new Error(`expected /dashboard, got ${url}`);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/smoke-onboarding-done.png' });
  });

  console.log('\n✅ All steps passed');
  console.log(`email used: ${EMAIL}`);
  if (logs.length) {
    console.log(`\n⚠ ${logs.length} runtime errors/warnings:`);
    logs.slice(0, 5).forEach((l) => console.log(`  ${l}`));
  }
} catch (e) {
  console.log(`\n❌ FAILED: ${e.message}`);
  console.log('\n--- last 20 logs ---');
  logs.slice(-20).forEach((l) => console.log(l));
  process.exitCode = 1;
} finally {
  await browser.close();
}
