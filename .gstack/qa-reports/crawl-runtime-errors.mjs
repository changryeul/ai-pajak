#!/usr/bin/env node
// Crawl 4 roles × representative pages and collect every:
//   - pageerror   (uncaught JS exception)
//   - console.error (component-level warnings)
//   - 4xx/5xx HTTP response for API calls
// Reports grouped by page + role so we can spot regressions from the
// last 10+ deploys.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';

const roles = [
  { role: 'INDIVIDUAL', email: 'customer.test@example.com', pw: 'TestPassword123!', pages: [
    '/ko/dashboard', '/ko/my-profile', '/ko/settings', '/ko/billing', '/ko/assets',
    '/ko/tax/spt-tahunan', '/ko/tax/spt-tahunan/1770ss', '/ko/tax/spt-tahunan/1770s', '/ko/tax/spt-tahunan/1770',
    '/ko/documents/upload', '/ko/reports', '/ko/settings/profile',
  ]},
  { role: 'COMPANY', email: 'company.test@example.com', pw: 'TestPassword123!', pages: [
    '/ko/dashboard', '/ko/tax/monthly-dashboard', '/ko/tax/spt-masa',
    '/ko/tax/pph21', '/ko/tax/pph23', '/ko/tax/ppn', '/ko/tax/billing',
    '/ko/tax/annual', '/ko/tax/ebupot', '/ko/filings', '/ko/reports', '/ko/counterparties',
  ]},
  { role: 'CONSULTANT', email: 'consultant.test@jakartatax.co.id', pw: 'TestPassword123!', pages: [
    '/ko/dashboard', '/ko/customers', '/ko/filings', '/ko/tax/monthly-dashboard',
    '/ko/tax/anomaly', '/ko/tax/transfer-pricing',
  ]},
  { role: 'TAX_OPERATOR', email: 'operator.test@aipajak.com', pw: 'TestPassword123!', pages: [
    '/ko/operator/dashboard',
  ]},
];

// Ignore the known set — these are pre-existing / known-benign:
const IGNORE = [
  /MISSING_MESSAGE/,                      // next-intl, caught separately
  /Failed to fetch filings/,              // dashboard gracefully falls back
  /Failed to load resource.*status of 4(0[0-9]|[1-9][0-9])/, // 404 probes by Playwright
];

function shouldIgnore(msg) {
  return IGNORE.some((re) => re.test(msg));
}

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const report = []; // { role, path, kind, msg }
const apiFailures = []; // { role, path, status, url }

for (const r of roles) {
  const ctx = await b.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  let currentPath = '/ko/login';
  page.on('pageerror', (e) => {
    const msg = e.message;
    if (!shouldIgnore(msg)) report.push({ role: r.role, path: currentPath, kind: 'pageerror', msg: msg.slice(0, 180) });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const txt = m.text();
      if (!shouldIgnore(txt)) report.push({ role: r.role, path: currentPath, kind: 'console', msg: txt.slice(0, 180) });
    }
  });
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if ((status >= 500 || (status >= 400 && status !== 401 && status !== 403 && status !== 404)) && url.includes('/api/')) {
      apiFailures.push({ role: r.role, path: currentPath, status, url: url.slice(0, 120) });
    }
  });

  try {
    await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.fill('input[type=text]', r.email);
    await page.fill('input[type=password]', r.pw);
    await page.locator('button[type=submit]').click();
    await page.waitForURL((u) => u.pathname.includes('/dashboard') || u.pathname.includes('/operator'), { timeout: 30000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.log(`✗ ${r.role} login failed: ${e.message.slice(0, 100)}`);
    await ctx.close();
    continue;
  }

  for (const path of r.pages) {
    currentPath = path;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
    } catch { /* skip */ }
  }
  console.log(`✓ ${r.role}: ${r.pages.length} pages`);
  await ctx.close();
}

await b.close();

// Dedupe errors: same msg+path+role only once
const seen = new Set();
const uniq = report.filter((r) => {
  const k = `${r.role}|${r.path}|${r.msg}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`\n=== Runtime report: ${uniq.length} unique errors, ${apiFailures.length} API failures ===\n`);

if (uniq.length > 0) {
  console.log('--- JS / console errors ---');
  for (const e of uniq) {
    console.log(`  [${e.role}] ${e.path}`);
    console.log(`    (${e.kind}) ${e.msg}`);
  }
}

if (apiFailures.length > 0) {
  console.log('\n--- API 4xx/5xx ---');
  const seenApi = new Set();
  for (const a of apiFailures) {
    const k = `${a.status}|${a.url}`;
    if (seenApi.has(k)) continue;
    seenApi.add(k);
    console.log(`  [${a.role}] ${a.path}  →  ${a.status}  ${a.url}`);
  }
}

if (uniq.length === 0 && apiFailures.length === 0) {
  console.log('✅ No runtime errors or API failures across 30+ pages.');
}

process.exitCode = uniq.length > 0 ? 1 : 0;
