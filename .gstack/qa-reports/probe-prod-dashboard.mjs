#!/usr/bin/env node
// Log in as customer.test@example.com and capture the full dashboard
// to verify whether the new INDIVIDUAL cards render.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'https://ai-pajak.vercel.app';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2400 }, locale: 'ko-KR' });
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
  await page.waitForTimeout(5000);

  const url = page.url();
  const body = (await page.textContent('body')) || '';
  console.log('URL:', url);
  console.log('customer_type hint:');
  console.log('  has 세금 신고 (filing summary):', body.includes('세금 신고'));
  console.log('  has Status Pernikahan (SpouseCard id):', body.includes('Status Pernikahan') || body.includes('결혼 상태') || body.includes('배우자'));
  console.log('  has 성장 이상 / Deteksi Anomali:', body.includes('Deteksi Anomali') || body.includes('성장 이상') || body.includes('이상 탐지'));
  console.log('  has 해외 자산 / Pelaporan Aset Luar Negeri:', body.includes('Pelaporan Aset Luar Negeri') || body.includes('해외자산') || body.includes('해외 자산'));
  console.log('  has 은행 계좌:', body.includes('은행 계좌') || body.includes('Rekening Bank') || body.includes('Bank Accounts'));

  await page.screenshot({ path: '/tmp/prod-dashboard-full.png', fullPage: true });
  console.log('\nsaved /tmp/prod-dashboard-full.png');
  if (errs.length) {
    console.log('\nruntime errors:');
    errs.slice(0, 10).forEach((e) => console.log('  ' + e));
  }
} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: '/tmp/prod-dashboard-fail.png', fullPage: true });
} finally {
  await b.close();
}
