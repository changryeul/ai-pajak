#!/usr/bin/env node
// Production smoke against https://ai-pajak.vercel.app.
// Signs up a fresh INDIVIDUAL, walks the 3-step onboarding, verifies the
// PR1/PR2/PR3 widgets render on the dashboard.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'https://ai-pajak.vercel.app';
const EMAIL = `prod.smoke.${Date.now()}@example.com`;
const PW = 'ProdSmoke123!';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1400 }, locale: 'id-ID' });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try { await fn(); console.log('  ✓'); }
  catch (e) {
    console.log(`  ✗ ${e.message}`);
    await page.screenshot({ path: `.gstack/qa-reports/screenshots/prod-fail-${name.replace(/\W/g, '-')}.png`, fullPage: true });
    throw e;
  }
}

try {
  await step('landing page loads in Indonesian', async () => {
    await page.goto(`${BASE}/id`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const title = await page.title();
    if (!title.includes('AI PAJAK')) throw new Error(`unexpected title: ${title}`);
  });

  await step('login page has Indonesian labels (no Korean)', async () => {
    await page.goto(`${BASE}/id/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/prod-login.png' });
    const body = (await page.textContent('body')) || '';
    const koreanMatches = body.match(/[\uac00-\ud7af]/);
    if (koreanMatches) throw new Error(`Korean found on id/login: ${koreanMatches[0]}`);
    const expectedLabel = body.includes('Email atau NPWP');
    if (!expectedLabel) throw new Error('Indonesian label "Email atau NPWP" not found');
  });

  await step('register INDIVIDUAL + full onboarding', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // Click 개인 납세자 (Individual) card
    const individualCard = await page.locator('text=개인 납세자').first();
    await individualCard.click();
    await page.waitForTimeout(500);
    await page.fill('input[name="fullName"]', 'Prod Smoke User');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.fill('input[name="password"]', PW);
    await page.fill('input[name="confirmPassword"]', PW);
    await page.locator('button[type="submit"]').click();
    // Wait for redirect to /register/terms (or /dashboard if already logged in)
    await page.waitForURL((u) => u.pathname.includes('/register/terms') || u.pathname.includes('/dashboard'), { timeout: 30000 });
    if (page.url().includes('/register/terms')) {
      const tb = await page.locator('.h-64.overflow-auto').first();
      await tb.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(300);
      await page.locator('input[type="checkbox"]').first().check();
      await page.locator('button').filter({ hasText: /Lanjut/ }).first().click();
      await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 60000 });
      const canvas = await page.locator('canvas').first();
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 20, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      await page.locator('input[type="checkbox"]').first().check();
      await page.locator('button').filter({ hasText: /Mulai/ }).first().click();
      await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 60000 });
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/prod-dashboard.png', fullPage: true });
  });

  await step('dashboard has PR1+PR2+PR3 widgets', async () => {
    const body = (await page.textContent('body')) || '';
    // PR2 Batch 1: Spouse & Dependents card
    if (!body.includes('Status Pernikahan')) throw new Error('SpouseAndDependentsCard missing');
    // PR3 Batch 2: Growth anomaly card
    if (!body.includes('Deteksi Anomali')) throw new Error('GrowthAnomalyCard missing');
    // PR3 Batch 3: Foreign asset reporting card
    if (!body.includes('Pelaporan Aset Luar Negeri')) throw new Error('ForeignAssetReportingCard missing');
  });

  await step('/settings/profile renders the OCR uploader', async () => {
    await page.goto(`${BASE}/id/settings/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('text=/Otomasi profil|AI|Profil Saya/', { timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/prod-profile.png', fullPage: true });
    const body = (await page.textContent('body')) || '';
    if (!body.includes('Otomasi profil')) throw new Error('DocumentToProfileUploader missing');
  });

  console.log(`\n✅ Production smoke passed (email: ${EMAIL})`);
  if (errors.length) {
    console.log(`\n⚠ ${errors.length} runtime errors:`);
    errors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  }
} catch (e) {
  console.log(`\n❌ FAILED: ${e.message}`);
  if (errors.length) {
    console.log('\n--- errors tail ---');
    errors.slice(-10).forEach((e) => console.log(`  ${e}`));
  }
  process.exitCode = 1;
} finally {
  await b.close();
}
