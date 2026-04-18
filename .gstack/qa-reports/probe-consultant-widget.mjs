#!/usr/bin/env node
// Verify ConsultantTierWidget renders on the dashboard for an EXTERNAL consultant.
import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2000 }, locale: 'id-ID' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`[console] ${m.text().slice(0, 200)}`); });

try {
  await page.goto(`${BASE}/id/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[type="text"]', 'external.consultant@mitrapajak.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '.gstack/qa-reports/screenshots/consultant-widget.png', fullPage: true });

  // Now also visit /billing and verify ConsultantBillingView
  await page.goto(`${BASE}/id/billing`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.gstack/qa-reports/screenshots/consultant-billing.png', fullPage: true });

  const body = (await page.textContent('body')) || '';
  const hits = {
    dashHeader: body.includes('Langganan Firma Pajak Diperlukan') || body.includes('Tier firma pajak'),
    billingHeader: body.includes('Langganan Firma Pajak'),
    availableTiers: body.includes('Tier Tersedia'),
    clientCapacity: body.includes('Kapasitas Klien') || body.includes('klien dikelola'),
  };
  console.log(JSON.stringify(hits, null, 2));
  if (errs.length) console.log('errors:', errs.slice(0, 5));
} catch (e) {
  console.log('FAIL:', e.message);
} finally {
  await b.close();
}
