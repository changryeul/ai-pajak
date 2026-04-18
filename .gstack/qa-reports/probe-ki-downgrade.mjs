#!/usr/bin/env node
// Verify the K/I auto-downgrade: select married + joint + 0 spouse income
// → card should show K/0 (not K/I/0) AND display the warning banner.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2000 }, locale: 'ko-KR' });
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', 'customer.test@example.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(3000);

  // Scroll to spouse card
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find((n) =>
      n.textContent === '결혼 상태 및 부양가족',
    );
    el?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1000);

  // Click married, joint, 0 dependents, leave spouse income blank
  await page.locator('input[type="radio"][value="married"]').check();
  await page.waitForTimeout(300);
  await page.locator('input[type="radio"][value="joint"]').check();
  await page.waitForTimeout(500);

  // Verify spouse income field is empty (default state)
  const incInput = page.locator('input[inputmode="numeric"]').first();
  const incValue = await incInput.inputValue();
  console.log('spouse income input value:', JSON.stringify(incValue));

  const body = (await page.textContent('body')) || '';
  // K/0 is K slash zero — should be present.
  // K/I/0 should NOT be present.
  const hasKOnly = /\bK\/0\b/.test(body);
  const hasKI = body.includes('K/I/0');
  const hasWarning = body.includes('합산신고 → 단일신고') || body.includes('자동 전환');
  const hasNewDependentsCopy = body.includes('배우자는 여기서 카운트되지 않습니다');
  const hasNewPtkpCopy = body.includes('기본 소득공제액');

  console.log('\nRESULTS:');
  console.log('  PTKP shows K/0 (downgraded):', hasKOnly);
  console.log('  PTKP shows K/I/0 (should be false):', hasKI);
  console.log('  Downgrade warning visible:', hasWarning);
  console.log('  New dependents hint copy:', hasNewDependentsCopy);
  console.log('  New ptkpExplain copy:', hasNewPtkpCopy);

  await page.screenshot({ path: '/tmp/ki-downgrade.png', fullPage: true });
  console.log('\nsaved /tmp/ki-downgrade.png');

  // Now enter spouse income > 0 → should upgrade back to K/I/0
  console.log('\n--- entering spouse income 50000000 ---');
  await incInput.fill('50000000');
  await page.waitForTimeout(800);
  const body2 = (await page.textContent('body')) || '';
  console.log('  K/I/0 shown after entering income:', body2.includes('K/I/0'));
  console.log('  Warning hidden:', !body2.includes('합산신고 → 단일신고'));

} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: '/tmp/ki-downgrade-fail.png', fullPage: true });
} finally {
  await b.close();
}
