import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/id/tax/pph23`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

for (const btn of await page.locator('button').all()) {
  const html = await btn.innerHTML();
  if (!await btn.isDisabled() && html.includes('lucide-plus') && (await btn.textContent())?.includes('Manual')) {
    await btn.click(); break;
  }
}
await page.waitForTimeout(800);
const combos = await page.locator('[role="combobox"]').all();
await combos[1].click();
await page.waitForTimeout(400);
await (await page.locator('[role="option"]').all())[0].click();
await page.waitForTimeout(400);
await page.locator('input[type="number"]').first().fill('1000000');
await page.waitForTimeout(1500);
await page.locator('button[type="submit"]').first().click();

// Poll toast between 0.5s and 10s to catch success message
let toastText = '';
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500);
  const toasts = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-sonner-toast] [data-title], [role="status"] div')]
      .map(e => (e.textContent || '').trim()).filter(t => t.length > 5);
  });
  if (toasts.length > 0) { toastText = toasts.join(' | '); break; }
}
console.log('Toast captured:', toastText);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/pph23-09-fixed-toast.png' });
await b.close();
