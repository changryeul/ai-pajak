import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

let cpResponse = null;
page.on('response', async r => {
  if (r.url().includes('/api/counterparties?') && r.request().method() === 'GET') {
    try { cpResponse = await r.text(); } catch {}
  }
});

// Login + nav
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/id/tax/pph23`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Full-page screenshot to see entire form
await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-03-full.png', fullPage: true });
console.log('full screenshot saved');

// Log API response for counterparties
console.log('\n--- counterparties API response (cached from network tap) ---');
console.log(cpResponse?.slice(0, 1500) || '(not captured)');

// Click the counterparty Select (radix Select is a button with role=combobox)
const combos = await page.locator('[role="combobox"]').all();
console.log(`\nfound ${combos.length} comboboxes`);
for (let i = 0; i < combos.length; i++) {
  const text = (await combos[i].textContent())?.trim().slice(0, 60);
  const id = await combos[i].getAttribute('id');
  console.log(`  combo[${i}] id=${id} text="${text}"`);
}

// Try clicking the first combobox to see if options appear
if (combos.length > 0) {
  await combos[0].click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-04-cp-open.png' });
  // Look for listbox items
  const items = await page.locator('[role="option"]').all();
  console.log(`\ncombobox[0] clicked — found ${items.length} option items`);
  for (let i = 0; i < Math.min(items.length, 10); i++) {
    console.log(`  opt[${i}]: "${(await items[i].textContent())?.trim().slice(0, 60)}"`);
  }
}

await b.close();
