#!/usr/bin/env node
// Cross-role login + dashboard render smoke. Covers the 4 main roles
// (INDIVIDUAL / COMPANY / CONSULTANT / TAX_OPERATOR) in Korean locale
// to catch regressions in role-specific dashboards after recent churn.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';

const accounts = [
  { role: 'CUSTOMER (INDIVIDUAL)', email: 'customer.test@example.com', pw: 'TestPassword123!',
    expectUrlPart: '/dashboard', expectBodyAny: ['결혼 상태', '최근 3년 신고'] },
  { role: 'CUSTOMER (COMPANY)',    email: 'company.test@example.com',  pw: 'TestPassword123!',
    expectUrlPart: '/dashboard', expectBodyAny: ['회사', '월 SPT', 'PPh 21', 'PPN', 'PT'] },
  { role: 'CONSULTANT',        email: 'consultant.test@jakartatax.co.id', pw: 'TestPassword123!',
    expectUrlPart: '/dashboard', expectBodyAny: ['고객', '세무', 'pendingFilings', 'Client', '월신고'] },
  { role: 'TAX_OPERATOR',          email: 'operator.test@aipajak.com', pw: 'TestPassword123!',
    expectUrlPart: '/operator', expectBodyAny: ['Queue', 'DJP', 'Review', '큐', '운영'] },
];

const b = await chromium.launch({ headless: true, executablePath: CHROME });
let passed = 0;
const results = [];

for (const acc of accounts) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  try {
    await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type=text]', acc.email);
    await page.fill('input[type=password]', acc.pw);
    await page.locator('button[type=submit]').click();
    await page.waitForURL((u) => u.pathname.includes(acc.expectUrlPart) || u.pathname.includes('/admin'), { timeout: 30000 });
    await page.waitForTimeout(4000);
    const body = (await page.textContent('body')) || '';
    const bodyHit = acc.expectBodyAny.some((s) => body.includes(s));
    const ok = bodyHit;
    results.push({ role: acc.role, url: page.url(), ok, hits: acc.expectBodyAny.filter(s => body.includes(s)), errs: errs.slice(0,2) });
    if (ok) passed++;
    await page.screenshot({ path: `/tmp/smoke-${acc.role.replace(/\W/g, '_')}.png` });
  } catch (e) {
    results.push({ role: acc.role, error: e.message.slice(0, 150), errs: errs.slice(0,2) });
  } finally {
    await ctx.close();
  }
}

await b.close();

console.log(`\n=== Cross-role smoke — ${passed}/${accounts.length} pass ===\n`);
for (const r of results) {
  if (r.ok) {
    console.log(`✓ ${r.role}  (${r.url})  hits: [${r.hits.join(', ')}]`);
  } else {
    console.log(`✗ ${r.role}  ${r.error || ''}  hits: [${(r.hits || []).join(', ')}]`);
  }
  if (r.errs?.length) console.log(`  errors: ${r.errs.join(' | ')}`);
}
process.exitCode = passed === accounts.length ? 0 : 1;
