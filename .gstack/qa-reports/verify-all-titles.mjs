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
const pages = [
  ['/dashboard', 'Dasbor'],
  ['/filings', 'Pelaporan Pajak'],
  ['/customers', 'Pelanggan'],
  ['/settings', 'Pengaturan'],
  ['/documents', 'Dokumen'],
  ['/reports', 'Laporan'],
  ['/billing', 'Tagihan'],
  ['/tax/pph21', 'PPh 21'],
  ['/tax/pph23', 'PPh 23'],
  ['/tax/ppn', 'PPN'],
  ['/tax/umkm', 'UMKM'],
  ['/tax/pph26', 'PPh 26'],
];
for (const [path, expect] of pages) {
  await page.goto(`http://localhost:3000/id${path}`, { waitUntil: 'networkidle' });
  let title = '';
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(200); title = await page.title(); if (title.includes(expect)) break; }
  console.log(`${title.includes(expect) ? '✓' : '✗'} ${path} → "${title}"`);
}
await b.close();
