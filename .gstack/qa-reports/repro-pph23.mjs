#!/usr/bin/env node
// Reproduce: "원천세 새거래가 입력되지 않음" — click no reaction
import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'id-ID' });
const page = await ctx.newPage();

const consoleMsgs = [];
const networkLog = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${e.message}`));
page.on('request', req => {
  if (req.url().includes('/api/')) networkLog.push({ method: req.method(), url: req.url() });
});
page.on('response', async res => {
  const url = res.url();
  if (url.includes('/api/tax/pph23-transactions') || url.includes('/api/tax/counterparties')) {
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch {}
    networkLog.push({ status: res.status(), url, body });
  }
});

// Login
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
console.log(`logged in → ${page.url()}`);

// Navigate to PPh23
await page.goto(`${BASE}/id/tax/pph23`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-01-initial.png', fullPage: false });
console.log('pph23 page loaded at', page.url());

const collectInspect = async () => {
  return page.evaluate(() => {
    const sel = (s) => [...document.querySelectorAll(s)];
    const dumpButtons = sel('button').slice(0, 25).map(b => ({
      text: (b.textContent || '').trim().slice(0, 50),
      disabled: b.disabled,
      type: b.type,
    }));
    const dumpInputs = sel('input').slice(0, 20).map(i => ({
      type: i.type,
      value: i.value,
      placeholder: i.placeholder,
      disabled: i.disabled,
    }));
    const dumpCombos = sel('[role="combobox"], [role="listbox"], select').slice(0, 10).map(s => ({
      tag: s.tagName,
      role: s.getAttribute('role'),
      text: (s.textContent || '').trim().slice(0, 40),
      value: s.value,
      ariaLabel: s.getAttribute('aria-label'),
    }));
    const submits = sel('button[type="submit"]').map(s => ({
      text: (s.textContent || '').trim().slice(0, 50),
      disabled: s.disabled,
    }));
    return { buttons: dumpButtons, inputs: dumpInputs, combos: dumpCombos, submits };
  });
};

const initial = await collectInspect();
console.log('=== Initial state ===');
console.log('buttons:', JSON.stringify(initial.buttons, null, 2));
console.log('submits:', JSON.stringify(initial.submits, null, 2));
console.log('combos:', JSON.stringify(initial.combos, null, 2));

// Try clicking the "new transaction" button
const newTxnBtn = await page.locator('button:has-text("Transaksi"), button:has-text("Tambah"), button:has-text("새 거래"), button:has-text("새거래")').first();
if (await newTxnBtn.count() > 0) {
  const disabled = await newTxnBtn.isDisabled();
  const text = (await newTxnBtn.textContent())?.trim();
  console.log(`found new-txn button: "${text}" disabled=${disabled}`);
  if (!disabled) {
    await newTxnBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-02-form-opened.png' });
  }
} else {
  console.log('no new-transaction button found directly');
}

const afterOpen = await collectInspect();
console.log('=== After clicking new transaction ===');
console.log('inputs:', JSON.stringify(afterOpen.inputs, null, 2));
console.log('combos:', JSON.stringify(afterOpen.combos, null, 2));
console.log('submits:', JSON.stringify(afterOpen.submits, null, 2));

// If form is open, try filling gross amount only (without counterparty)
// to see if button stays disabled
const numInput = await page.locator('input[type="number"]').first();
if (await numInput.count() > 0) {
  await numInput.fill('1000000');
  await page.waitForTimeout(500);
  const afterAmt = await collectInspect();
  console.log('=== After filling gross amount only ===');
  console.log('submits:', JSON.stringify(afterAmt.submits, null, 2));
}

console.log('\n--- network log ---');
console.log(JSON.stringify(networkLog, null, 2));
console.log('\n--- console messages ---');
console.log(consoleMsgs.slice(0, 20).join('\n'));

await b.close();
