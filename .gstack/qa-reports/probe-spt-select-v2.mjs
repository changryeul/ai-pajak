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
await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
await page.goto(`${BASE}/ko/tax/spt-tahunan`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/spt-select-v2.png', fullPage: true });
const body = (await page.textContent('body')) || '';
console.log(JSON.stringify({
  ss: body.includes('SPT 1770 SS') && body.includes('매우 간단한 개인 신고'),
  s: body.includes('SPT 1770 S') && body.includes('일반 직장인'),
  full: body.includes('SPT 1770') && body.includes('사업자 / 복합소득'),
  aiCard: body.includes('AI 추천'),
  aiCheckboxes: body.includes('사업소득 있음') && body.includes('근로소득 2곳 이상') && body.includes('금융소득 있음'),
  aiApply: body.includes('AI 추천 적용하기'),
  select: body.includes('선택하기'),
}, null, 2));
await b.close();
