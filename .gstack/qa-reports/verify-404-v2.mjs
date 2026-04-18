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
for (const url of ['/id/tax', '/id/totallyfake', '/id/zzz']) {
  await page.goto(`http://localhost:3000${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const body = (await page.textContent('body')) || '';
  const hasBrand = body.includes('Halaman tidak') || body.includes('Kembali ke Dasbor');
  const hasBare = body.includes('This page could not be found');
  console.log(`${url}: hasBrand=${hasBrand} hasBare=${hasBare}`);
}
await b.close();
