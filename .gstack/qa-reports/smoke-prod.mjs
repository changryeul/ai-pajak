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
    // Only check visible user-facing text. body.textContent also returns
    // <script> contents, which can include i18n RSC payload from sibling
    // pages (e.g., sptIntake is bilingual Korean↔Indonesian on purpose).
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest('script, style, noscript, template')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const chunks = [];
      let n;
      while ((n = walker.nextNode())) chunks.push(n.textContent || '');
      return chunks.join(' ');
    });
    const koreanMatches = visibleText.match(/[\uac00-\ud7af]/);
    if (koreanMatches) throw new Error(`Korean found on id/login: ${koreanMatches[0]}`);
    if (!visibleText.includes('Email atau NPWP'))
      throw new Error('Indonesian label "Email atau NPWP" not found');
  });

  await step('register INDIVIDUAL + full onboarding', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // New 2-step signup flow (2026-04-18):
    //   Step 1: fullName + NPWP/NIK dropdown + ID number + email + phone
    //   Step 2: password + confirmPassword
    await page.fill('input[name="fullName"]', 'Prod Smoke User');
    // Default dropdown is NPWP (15 digits). Use a synthetic 15-digit NPWP.
    await page.fill('input[name="idNumber"]', '123456789012345');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.locator('button[type="submit"]').click();
    // Wait for step 2 (password)
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
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

  await step('dashboard has PersonalDashboardV3 sections', async () => {
    const body = (await page.textContent('body')) || '';
    // V3 = PersonalDashboardV3 (2026-04-19 redesign)
    // Section 2: 3 years filings
    if (!body.match(/Riwayat Pelaporan 3 Tahun|3년 신고 이력|Last 3 Years/i))
      throw new Error('3-year filings section missing');
    // Section 4: assets + liabilities summary
    if (!body.includes('Aset (Assets)') && !body.includes('Assets'))
      throw new Error('Assets card missing');
    if (!body.includes('Liabilitas (Liabilities)') && !body.includes('Liabilities'))
      throw new Error('Liabilities card missing');
    // Section 10: CTA buttons
    if (!body.match(/Mulai Pelaporan|Start Filing|신고 시작하기/))
      throw new Error('Start Filing CTA missing');
  });

  await step('/my-profile renders profile editor', async () => {
    await page.goto(`${BASE}/id/my-profile`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/prod-my-profile.png', fullPage: true });
    const body = (await page.textContent('body')) || '';
    if (!body.includes('Info Saya') && !body.includes('My Profile'))
      throw new Error('my-profile header missing');
    if (!body.match(/Informasi Dasar|Basic Info/))
      throw new Error('basic info section missing');
    if (!body.match(/Info Akun Pajak|Tax Account/))
      throw new Error('tax account section missing');
  });

  await step('/tax/spt-tahunan renders 2x2 selection grid', async () => {
    await page.goto(`${BASE}/id/tax/spt-tahunan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/prod-spt-selection.png', fullPage: true });
    const body = (await page.textContent('body')) || '';
    if (!body.includes('SPT 1770 SS')) throw new Error('1770SS card missing');
    if (!body.includes('SPT 1770 S')) throw new Error('1770S card missing');
    if (!body.match(/Rekomendasi AI|AI Recommendation|AI 추천/))
      throw new Error('AI recommendation card missing');
  });

  await step('/tax/spt-tahunan/1770ss loads intake', async () => {
    await page.goto(`${BASE}/id/tax/spt-tahunan/1770ss`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const body = (await page.textContent('body')) || '';
    if (!body.match(/1770SS|Input Data|신고 자료/))
      throw new Error('1770SS intake header missing');
    if (!body.match(/Aset \(Harta\)|Assets \(Harta\)|자산 \(Harta\)/))
      throw new Error('assets section missing');
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
