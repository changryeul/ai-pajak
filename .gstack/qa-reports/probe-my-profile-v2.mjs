import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1200 }, locale: 'ko-KR' });
const page = await ctx.newPage();
await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.fill('input[type="text"]', 'customer.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname.includes('/dashboard') || u.pathname.includes('/register/'), { timeout: 30000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/ko/my-profile`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/my-profile-v2.png', fullPage: true });
const body = (await page.textContent('body')) || '';
console.log(JSON.stringify({
  title: body.includes('내정보'),
  completeness: body.includes('정보 완성도'),
  basicInfo: body.includes('기본정보'),
  contactInfo: body.includes('연락 / 계정정보'),
  taxAccount: body.includes('세무 계정 정보'),
  coretax: body.includes('Coretax ID'),
  passphrase: body.includes('Passphrase'),
  efin: body.includes('EFIN'),
  save: body.includes('저장'),
}, null, 2));
await b.close();
