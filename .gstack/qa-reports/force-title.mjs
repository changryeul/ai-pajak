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
await page.goto('http://localhost:3000/id/tax/pph21', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
// Check title and force-set
console.log('title before:', await page.title());
// Force via evaluate
await page.evaluate(() => { document.title = 'TEST 123'; });
console.log('title after manual set:', await page.title());
// Wait and check if something else resets it
await page.waitForTimeout(3000);
console.log('title after 3s wait:', await page.title());
await b.close();
