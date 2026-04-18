import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';
const EMAIL = `probe.ind.${Date.now()}@example.com`;
const PW = 'TestPassword123!';
const NPWP = String(Date.now()).slice(-15).padStart(15, '9');

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1400 }, locale: 'id-ID' });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`[console] ${m.text().slice(0, 300)}`); });
page.on('response', async (r) => {
  if (r.url().includes('/api/auth/') || r.url().includes('/api/customer/')) {
    let body = '';
    try { body = (await r.text()).slice(0, 400); } catch {}
    console.log(`[${r.request().method()} ${r.status()}] ${r.url().replace(BASE, '')} → ${body}`);
  }
});

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try { await fn(); console.log('  ✓'); } catch (e) { console.log(`  ✗ ${e.message}`); throw e; }
}

try {
  await step('step1 fill basics', async () => {
    await page.goto(`${BASE}/id/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.fill('input[name="fullName"]', 'Probe Ind User');
    await page.fill('input[name="idNumber"]', NPWP);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="phone"]', '081234567890');
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
  });

  await step('step2 password', async () => {
    await page.fill('input[name="password"]', PW);
    await page.fill('input[name="confirmPassword"]', PW);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname.includes('/register/terms') || u.pathname.includes('/dashboard'), { timeout: 30000 });
  });

  await step('terms', async () => {
    if (page.url().includes('/register/terms')) {
      const box = page.locator('.h-64.overflow-auto').first();
      await box.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(300);
      await page.locator('input[type="checkbox"]').first().check();
      await page.locator('button').filter({ hasText: /Lanjut/ }).first().click();
      await page.waitForURL((u) => u.pathname.includes('/register/mandate'), { timeout: 30000 });
    }
  });

  await step('mandate signature', async () => {
    if (page.url().includes('/register/mandate')) {
      const canvas = page.locator('canvas').first();
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + 20, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      await page.locator('input[type="checkbox"]').first().check();
      await page.locator('button').filter({ hasText: /Mulai/ }).first().click();
      await page.waitForURL((u) => u.pathname.includes('/dashboard'), { timeout: 30000 });
    }
  });

  console.log(`\n✅ Full flow passed (email: ${EMAIL})`);
} catch (e) {
  console.log(`\n❌ FAILED: ${e.message}`);
  await page.screenshot({ path: '.gstack/qa-reports/screenshots/probe-ind-signup-fail.png', fullPage: true });
  if (errs.length) {
    console.log('errors:');
    errs.slice(0, 10).forEach(e => console.log('  ' + e));
  }
  process.exitCode = 1;
} finally {
  await b.close();
}
