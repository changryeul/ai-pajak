import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'id-ID' });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/id/login', { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
for (const path of ['/tax/pph21', '/tax/pph23', '/tax/ppn', '/tax/umkm', '/tax/pph26']) {
  await page.goto(`http://localhost:3000/id${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  const spans = await page.$$eval('[data-pagetitle]', els => els.map(e => e.getAttribute('data-pagetitle')));
  const title = await page.title();
  console.log(`${path}: spans=${JSON.stringify(spans)} title="${title}"`);
}
await b.close();
