#!/usr/bin/env node
import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2400 }, locale: 'ko-KR' });
const page = await ctx.newPage();

await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="text"]', 'customer.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
await page.waitForTimeout(1500);
for (const form of ['1770ss', '1770s', '1770']) {
  await page.goto(`${BASE}/ko/tax/spt-tahunan/${form}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `.gstack/qa-reports/screenshots/${form}-intake-ko.png`, fullPage: true });
  const body = (await page.textContent('body')) || '';
  const hits = {
    header: body.includes(`${form.toUpperCase()} 신고 자료 입력`),
    kkCard: body.includes('기본 정보 (KK)'),
    incomeCard: form === '1770' ? body.includes('사업소득 자료') : body.includes('근로소득 (A1)'),
    taxCredit: form === '1770' ? true : body.includes('세액공제 / 기납부세액'),
    pph23: form === '1770s' ? body.includes('PPh 23 (선택)') : true,
    assetsTitle: body.includes('자산 (Harta)'),
    liabilitiesTitle: body.includes('부채 (Utang)'),
    submit: body.includes('신고 제출'),
  };
  console.log(form.toUpperCase(), JSON.stringify(hits));
}
await b.close();
