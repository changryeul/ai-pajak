#!/usr/bin/env node
// Verify the INDIVIDUAL /billing view renders the new plan cards.
// Login as customer.test@example.com on local dev.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2200 }, locale: 'ko-KR' });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`[console] ${m.text().slice(0, 200)}`); });

try {
  await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', 'customer.test@example.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/ko/billing`, { waitUntil: 'domcontentloaded' });
  // Wait until plan cards are actually rendered (catalog fetch + hydrate).
  await page.waitForSelector('text=/1770SS/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  const url = page.url();
  const body = (await page.textContent('body')) || '';
  console.log('URL:', url);
  console.log('has hero (건당 결제):', body.includes('건당 결제') || body.includes('Pay per filing'));
  console.log('has 1770SS:', body.includes('1770SS'));
  console.log('has 1770S:', body.includes('1770S'));
  console.log('has 1770:', body.includes('1770'));
  console.log('has 선택 · 결제 CTA:', body.includes('선택 · 결제') || body.includes('Pick & Pay'));
  console.log('has pending section:', body.includes('결제 대기') || body.includes('Pending'));
  console.log('has history section:', body.includes('결제 이력') || body.includes('Payment History'));

  await page.screenshot({ path: '/tmp/individual-billing.png', fullPage: true });
  console.log('\nsaved /tmp/individual-billing.png');

  if (errs.length) {
    console.log('\nruntime errors:');
    errs.slice(0, 10).forEach((e) => console.log('  ' + e));
  }
} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: '/tmp/individual-billing-fail.png', fullPage: true });
} finally {
  await b.close();
}
