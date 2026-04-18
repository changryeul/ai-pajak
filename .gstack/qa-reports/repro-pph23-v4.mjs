import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

const allRequests = [];
const allResponses = [];
page.on('request', req => {
  if (req.url().includes('/api/')) allRequests.push({ t: Date.now(), method: req.method(), url: req.url().replace(BASE, '') });
});
page.on('response', async r => {
  if (r.url().includes('/api/')) {
    let body = '';
    if (r.url().includes('pph23-transactions') || r.url().includes('tax/resolve')) {
      try { body = (await r.text()).slice(0, 400); } catch {}
    }
    allResponses.push({ t: Date.now(), status: r.status(), url: r.url().replace(BASE, ''), body });
  }
});
page.on('console', m => { if (m.type()==='error') console.log('[console.error]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));

// Login + nav
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/id/tax/pph23`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Open form
for (const btn of await page.locator('button').all()) {
  const html = await btn.innerHTML();
  const disabled = await btn.isDisabled();
  if (!disabled && html.includes('lucide-plus')) {
    const text = (await btn.textContent())?.trim();
    if (text && text.includes('Manual')) { await btn.click(); break; }
  }
}
await page.waitForTimeout(800);

// Select counterparty (combo index 1)
const combos = await page.locator('[role="combobox"]').all();
await combos[1].click();
await page.waitForTimeout(400);
await (await page.locator('[role="option"]').all())[0].click();
await page.waitForTimeout(400);

// Fill amount
await page.locator('input[type="number"]').first().fill('1000000');
await page.waitForTimeout(1500); // wait for resolve debounce + call

console.log('=== State before submit ===');
const preState = await page.evaluate(() => {
  const btn = document.querySelector('button[type="submit"]');
  return { disabled: btn?.disabled, text: btn?.textContent?.trim() };
});
console.log(preState);

const clickTime = Date.now();
console.log(`Clicking submit at t=${clickTime}`);
await page.locator('button[type="submit"]').first().click();

// Wait much longer (15s) to catch a slow POST
await page.waitForTimeout(15000);

console.log(`\n=== API traffic ordered (click was at ${clickTime}) ===`);
for (const req of allRequests) {
  const relT = req.t - clickTime;
  const respMatches = allResponses.filter(r => r.url === req.url && r.t >= req.t).slice(0, 1);
  const respInfo = respMatches.length ? ` → ${respMatches[0].status} @ ${respMatches[0].t - req.t}ms` : ' (no response yet)';
  console.log(`[${relT >= 0 ? '+' : ''}${relT}ms] ${req.method} ${req.url}${respInfo}`);
}

// Specific: check pph23-transactions POST
console.log('\n=== POST pph23-transactions responses ===');
for (const r of allResponses.filter(r => r.url.includes('pph23-transactions'))) {
  console.log(`status=${r.status} body=${r.body}`);
}

// Screenshot after
await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-08-15s-later.png', fullPage: false });
console.log('final screenshot saved');

// Check for toast text
const toastText = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-sonner-toast], [role="alert"], [role="status"]')]
    .map(e => (e.textContent || '').trim()).filter(Boolean);
});
console.log('toasts:', toastText);

await b.close();
