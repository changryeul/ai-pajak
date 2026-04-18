import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'id-ID' });
const page = await ctx.newPage();

await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);

for (const [path, expect] of [
  ['/tax/pph21', 'PPh 21'],
  ['/tax/pph23', 'PPh 23'],
  ['/tax/ppn', 'PPN'],
  ['/tax/umkm', 'UMKM'],
  ['/tax/pph26', 'PPh 26'],
]) {
  await page.goto(`${BASE}/id${path}`, { waitUntil: 'networkidle' });
  let title = '';
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(200);
    title = await page.title();
    if (title.includes(expect)) break;
  }
  const ok = title.includes(expect);
  console.log(`${ok ? '✓' : '✗'} ${path} → "${title}"`);
}
await b.close();
