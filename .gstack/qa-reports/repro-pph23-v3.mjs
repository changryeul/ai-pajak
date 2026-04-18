import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

const consoleMsgs = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${e.message}`));

const apiCalls = [];
page.on('response', async r => {
  const url = r.url();
  if (url.includes('/api/tax/pph23-transactions') && r.request().method() === 'POST') {
    let body = '';
    try { body = await r.text(); } catch {}
    apiCalls.push({ method: 'POST', status: r.status(), url, body: body.slice(0, 500) });
  }
});

// Login + nav
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/id/tax/pph23`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Click "New Transaction" button (shows "Plus" icon)
const addBtns = await page.locator('button').all();
let opened = false;
for (const btn of addBtns) {
  const html = await btn.innerHTML();
  const disabled = await btn.isDisabled();
  // The add button has a Plus icon + translated text. Simplest: click the first enabled button that contains "플러스" svg or is labeled "+"
  if (!disabled && html.includes('lucide-plus') && !(await btn.textContent())?.toLowerCase().includes('quick')) {
    const text = (await btn.textContent())?.trim();
    if (text && !text.includes('Upload') && !text.includes('CSV')) {
      console.log(`clicking: "${text}"`);
      await btn.click();
      await page.waitForTimeout(1200);
      opened = true;
      break;
    }
  }
}
console.log('form opened?', opened);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-05-form.png', fullPage: true });

// Now form should show: counterparty select, service type, gross amount
// Count comboboxes
const combos = await page.locator('[role="combobox"]').all();
console.log(`comboboxes: ${combos.length}`);

// Click the counterparty select (first combo after the period selector)
// Try clicking whichever has a placeholder-ish text
for (let i = 0; i < combos.length; i++) {
  const txt = (await combos[i].textContent())?.trim().slice(0, 50);
  console.log(`  combo[${i}]: "${txt}"`);
}

// Try to select counterparty: click and pick first option
if (combos.length >= 2) {
  // combos[0] is probably period (top), combos[1] likely counterparty
  await combos[1].click();
  await page.waitForTimeout(600);
  const opts = await page.locator('[role="option"]').all();
  console.log(`counterparty options: ${opts.length}`);
  for (let i = 0; i < Math.min(opts.length, 5); i++) {
    console.log(`  opt[${i}]: ${(await opts[i].textContent())?.trim().slice(0, 80)}`);
  }
  if (opts.length > 0) {
    await opts[0].click();
    await page.waitForTimeout(500);
    console.log('counterparty selected');
  }
}

// Fill gross amount
const numInput = await page.locator('input[type="number"]').first();
await numInput.fill('1000000');
await page.waitForTimeout(400);

// Check submit button state
const submit = await page.locator('button[type="submit"]').first();
const submitDisabled = await submit.isDisabled();
const submitText = (await submit.textContent())?.trim();
console.log(`submit: "${submitText}" disabled=${submitDisabled}`);

if (!submitDisabled) {
  await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-06-before-submit.png' });
  await submit.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-07-after-submit.png', fullPage: true });
  console.log('submitted');
}

console.log('\n--- POST /api/tax/pph23-transactions ---');
console.log(JSON.stringify(apiCalls, null, 2));

console.log('\n--- console errors only ---');
for (const m of consoleMsgs) {
  if (m.startsWith('[error]') || m.startsWith('[pageerror]') || m.startsWith('[warning]')) console.log(m);
}

// Also check if a toast/alert is showing on the page
const alerts = await page.locator('[role="alert"], [role="status"], .toast, [data-sonner-toast]').all();
console.log(`\ntoasts/alerts on page: ${alerts.length}`);
for (const a of alerts) {
  console.log(` alert text: "${(await a.textContent())?.trim().slice(0, 200)}"`);
}

await b.close();
