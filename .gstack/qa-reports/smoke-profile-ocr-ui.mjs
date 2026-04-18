import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const EMAIL = `smoke.ocrui.${Date.now()}@example.com`;

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 }, locale: 'id-ID' });
const page = await ctx.newPage();

// Signup + full onboarding
await page.goto(`${BASE}/id/register`, { waitUntil: 'networkidle' });
await page.locator('text=개인 납세자').first().click();
await page.waitForTimeout(300);
await page.fill('input[name="fullName"]', 'OCR UI');
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="phone"]', '081234567890');
await page.fill('input[name="password"]', 'Pw123456!');
await page.fill('input[name="confirmPassword"]', 'Pw123456!');
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname.includes('/register/terms'), { timeout: 15000 });
const tb = await page.locator('.h-64.overflow-auto').first();
await tb.evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.locator('input[type="checkbox"]').first().check();
await page.locator('button').filter({ hasText: /Lanjut/ }).first().click();
await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 30000 });
const canvas = await page.locator('canvas').first();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 20, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.locator('input[type="checkbox"]').first().check();
await page.locator('button').filter({ hasText: /Mulai/ }).first().click();
await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
await page.waitForTimeout(1000);

// Go to /settings/profile
await page.goto(`${BASE}/id/settings/profile`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=/Otomasi profil|AI/', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/profile-ocr-ui.png', fullPage: true });
console.log('title:', await page.title());
await b.close();
