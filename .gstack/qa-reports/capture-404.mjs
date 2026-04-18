import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/id/tax', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/404-branded-final.png' });
await b.close();
