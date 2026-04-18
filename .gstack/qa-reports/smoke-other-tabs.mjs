import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = 'http://localhost:3000';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1100 }, locale: 'id-ID' });
const page = await ctx.newPage();

const pageerrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageerrors.push(e.message));
page.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text().slice(0, 200)); });

// Login
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'company.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(1500);

const tabs = [
  { path: '/tax/pph21', label: 'PPh21', name: 'pph21' },
  { path: '/tax/ppn', label: 'PPN', name: 'ppn' },
  { path: '/tax/umkm', label: 'UMKM', name: 'umkm' },
  { path: '/tax/pph26', label: 'PPh26', name: 'pph26' },
];

const results = [];

for (const tab of tabs) {
  console.log(`\n=== ${tab.label} (${BASE}/id${tab.path}) ===`);
  pageerrors.length = 0;
  consoleErrors.length = 0;
  try {
    const resp = await page.goto(`${BASE}/id${tab.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `.gstack/qa-reports/screenshots/smoke-${tab.name}.png`, fullPage: false });
    const status = resp?.status();
    const title = await page.title();
    const finalUrl = page.url();
    const bodyText = (await page.textContent('body'))?.slice(0, 5000) || '';
    // Detect broken template literal leftovers in rendered text
    const brokenConcat = /'\s*\+\s*t\('/g.test(bodyText);
    // Detect Korean text
    const hasKorean = /[\uac00-\ud7af]/.test(bodyText);
    const koSamples = bodyText.match(/[\uac00-\ud7af][\uac00-\ud7af\s]{3,30}/g)?.slice(0, 3) || [];
    // Count nav-menu links for complexity signal
    const navCount = await page.locator('aside a, nav a').count();
    // Find submit buttons and see if disabled
    const submits = await page.locator('button[type="submit"]').all();
    const submitStates = [];
    for (const s of submits) {
      submitStates.push({ text: (await s.textContent())?.trim().slice(0, 40), disabled: await s.isDisabled() });
    }
    results.push({
      tab: tab.label, status, finalUrl, title, brokenConcat, hasKorean, koSamples,
      navCount, submitStates,
      pageerrors: [...pageerrors], consoleErrors: [...consoleErrors],
    });
    console.log(`  status=${status} title="${title}"`);
    console.log(`  brokenConcat=${brokenConcat} hasKorean=${hasKorean} koSamples=${JSON.stringify(koSamples)}`);
    console.log(`  navCount=${navCount}`);
    console.log(`  submits=${JSON.stringify(submitStates)}`);
    if (pageerrors.length) console.log(`  pageerrors: ${pageerrors.join(' | ')}`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    results.push({ tab: tab.label, error: e.message });
  }
}

import fs from 'node:fs';
fs.writeFileSync('.gstack/qa-reports/smoke-other-tabs.json', JSON.stringify(results, null, 2));

await b.close();
console.log('\nwrote smoke-other-tabs.json');
