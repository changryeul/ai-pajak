import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'id-ID' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('[pageerror] '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('[console.error] '+m.text().slice(0,300)); });
await page.goto('http://localhost:3000/id/login', { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);
// Go to pph21 and wait long
await page.goto('http://localhost:3000/id/tax/pph21', { waitUntil: 'networkidle' });
await page.waitForTimeout(8000);
console.log('title after 8s:', await page.title());
// Check for error overlay
const hasErrorOverlay = await page.locator('nextjs-portal').count();
console.log('error overlay present?', hasErrorOverlay);
// Dump errors
console.log('\nerrors:');
for (const e of errors) console.log(' ', e);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/title-debug.png', fullPage: false });
await b.close();
