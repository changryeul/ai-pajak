#!/usr/bin/env node
// Visit representative pages per role, collect MISSING_MESSAGE warnings
// from the next-intl runtime, and report the unique keys so we can add
// them all in one pass.

import { chromium } from 'playwright';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';

const roles = [
  {
    role: 'INDIVIDUAL',
    email: 'customer.test@example.com',
    pw: 'TestPassword123!',
    pages: [
      '/ko/dashboard',
      '/ko/my-profile',
      '/ko/settings',
      '/ko/billing',
      '/ko/assets',
      '/ko/tax/spt-tahunan',
      '/ko/tax/spt-tahunan/1770ss',
      '/ko/tax/spt-tahunan/1770s',
      '/ko/tax/spt-tahunan/1770',
      '/ko/documents/upload',
      '/ko/reports',
      '/ko/settings/profile',
    ],
  },
  {
    role: 'COMPANY',
    email: 'company.test@example.com',
    pw: 'TestPassword123!',
    pages: [
      '/ko/dashboard',
      '/ko/tax/monthly-dashboard',
      '/ko/tax/spt-masa',
      '/ko/tax/pph21',
      '/ko/tax/pph23',
      '/ko/tax/umkm',
      '/ko/tax/ppn',
      '/ko/tax/billing',
      '/ko/tax/annual',
      '/ko/tax/ebupot',
      '/ko/filings',
      '/ko/reports',
      '/ko/counterparties',
      '/ko/tax/calendar',
      '/ko/tax/tools',
    ],
  },
  {
    role: 'CONSULTANT',
    email: 'consultant.test@jakartatax.co.id',
    pw: 'TestPassword123!',
    pages: [
      '/ko/dashboard',
      '/ko/customers',
      '/ko/filings',
      '/ko/tax/monthly-dashboard',
      '/ko/tax/spt-masa',
      '/ko/tax/anomaly',
      '/ko/tax/transfer-pricing',
      '/ko/tax/multi-entity',
      '/ko/tax/report',
    ],
  },
  {
    role: 'TAX_OPERATOR',
    email: 'operator.test@aipajak.com',
    pw: 'TestPassword123!',
    pages: [
      '/ko/operator/dashboard',
      '/ko/operator/queue',
    ],
  },
];

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const allKeys = new Map(); // key -> Set of locations found

for (const r of roles) {
  const ctx = await b.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const txt = m.text();
    const match = txt.match(/MISSING_MESSAGE: ([a-zA-Z0-9_.]+)\s/);
    if (match) {
      const key = match[1];
      if (!allKeys.has(key)) allKeys.set(key, new Set());
      allKeys.get(key).add(currentPath);
    }
  });

  let currentPath = '/ko/login';
  try {
    await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.fill('input[type=text]', r.email);
    await page.fill('input[type=password]', r.pw);
    await page.locator('button[type=submit]').click();
    await page.waitForURL((u) => u.pathname.includes('/dashboard') || u.pathname.includes('/operator'), { timeout: 30000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.log(`✗ ${r.role} login failed: ${e.message.slice(0, 100)}`);
    await ctx.close();
    continue;
  }

  let visited = 0;
  for (const path of r.pages) {
    currentPath = path;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      visited++;
    } catch {
      // skip timeouts
    }
  }
  console.log(`✓ ${r.role}: visited ${visited}/${r.pages.length} pages`);
  await ctx.close();
}

await b.close();

console.log(`\n=== ${allKeys.size} unique MISSING_MESSAGE keys ===\n`);
const byNamespace = new Map();
for (const [key, locations] of allKeys) {
  const ns = key.split('.')[0];
  if (!byNamespace.has(ns)) byNamespace.set(ns, []);
  byNamespace.get(ns).push({ key, locations: [...locations] });
}

const sortedNs = [...byNamespace.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [ns, items] of sortedNs) {
  console.log(`\n[${ns}] (${items.length})`);
  for (const { key, locations } of items) {
    console.log(`  ${key}  — ${locations.join(', ')}`);
  }
}
