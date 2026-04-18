#!/usr/bin/env node
// One-shot QA script for AI Pajak — COMPANY customer onboarding + navigation focus
// Uses project's installed Playwright directly.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = '.gstack/qa-reports/screenshots';
const EMAIL = 'company.test@example.com';
const PASSWORD = 'TestPassword123!';

fs.mkdirSync(SCREENSHOTS, { recursive: true });

const findings = [];
const consoleErrors = [];
const networkErrors = [];

function note(id, severity, category, title, detail, screenshot = null) {
  findings.push({ id, severity, category, title, detail, screenshot });
  console.log(`  [${severity}] ${id}: ${title}`);
}

async function shot(page, name, label) {
  const p = `${SCREENSHOTS}/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${label} → ${p}`);
  return p;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
const page = await ctx.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
});
page.on('pageerror', err => {
  consoleErrors.push({ url: page.url(), text: `PAGEERROR: ${err.message}` });
});
page.on('requestfailed', req => {
  const url = req.url();
  // ignore Next.js HMR & devtool noise
  if (url.includes('_next/static') || url.includes('/__nextjs')) return;
  networkErrors.push({ url, failure: req.failure()?.errorText });
});

try {
  console.log('▶ Phase 3: orient (unauth)');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await shot(page, '01-homepage', 'homepage (unauth)');
  const homeTitle = await page.title();
  console.log(`  title: ${homeTitle}`);
  console.log(`  url after redirect: ${page.url()}`);

  // Check for "시작하기 납세자 선택" related onboarding copy
  const bodyText = await page.textContent('body');
  const mentionsOnboardingChoice = /(납세자|wajib pajak|pilih|taxpayer).*(pilih|select|type|pribadi|badan)/i.test(bodyText);
  console.log(`  onboarding choice copy on landing: ${mentionsOnboardingChoice}`);

  console.log('\n▶ Phase 2: auth — login as company.test');
  // Find login link/button and click
  const loginHref = await page.$('a[href*="login"]');
  if (!loginHref) {
    note('ISSUE-LOGIN-NOTFOUND', 'critical', 'functional', 'No visible login link on homepage',
      'Homepage has no discoverable way to reach the login page.');
  } else {
    await loginHref.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  }
  // Wait for React to hydrate and render the form
  await page.waitForSelector('input', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-login-page', 'login page');

  // Dump input structure for debugging
  const inputDump = await page.evaluate(() => {
    return [...document.querySelectorAll('input')].map(i => ({
      type: i.type, name: i.name, id: i.id,
      placeholder: i.placeholder, autocomplete: i.autocomplete,
    }));
  });
  console.log('  inputs found:', JSON.stringify(inputDump));

  // Flag i18n bug: Korean placeholder on Indonesian locale page
  const koPlaceholder = inputDump.find(i => /또는|아이디|비밀번호/.test(i.placeholder));
  if (koPlaceholder) {
    note('ISSUE-I18N-KO-ON-ID', 'medium', 'content',
      'Korean text appearing on Indonesian-locale login page',
      `Login placeholder contains Korean: "${koPlaceholder.placeholder}". Expected Indonesian translation. Page URL: ${page.url()}`);
  }

  // The login page uses type="text" for email/NPWP combined field — match by position
  const passwordInput = await page.$('input[type="password"]');
  const emailInput = passwordInput ? await page.$('input[type="text"], input:not([type="password"]):not([type="hidden"]):not([type="submit"])') : null;
  if (!emailInput || !passwordInput) {
    note('ISSUE-LOGIN-FORM', 'critical', 'functional', 'Login form inputs not found',
      `email: ${!!emailInput}, password: ${!!passwordInput}. inputs dump: ${JSON.stringify(inputDump)}`);
  } else {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    const submit = await page.$('button[type="submit"]');
    if (!submit) {
      note('ISSUE-LOGIN-SUBMIT', 'critical', 'functional', 'Login submit button not found', '');
    } else {
      await submit.click();
      // Wait for either redirect or error
      await page.waitForURL(u => !u.pathname.includes('/login') || u.searchParams.has('error'), { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  await shot(page, '03-post-login', 'post-login');
  const postLoginUrl = page.url();
  console.log(`  post-login URL: ${postLoginUrl}`);

  // Check if login succeeded
  if (postLoginUrl.includes('/login')) {
    const errText = await page.textContent('body');
    const errorSnippet = errText?.slice(0, 300).replace(/\s+/g, ' ');
    note('ISSUE-LOGIN-FAILED', 'critical', 'functional', 'Login did not redirect away from /login',
      `URL still /login. Body snippet: ${errorSnippet}`);
  }

  console.log('\n▶ Phase 4: explore core paths (company customer)');

  const pages = [
    { path: '/tax', label: 'tax', name: '04-tax' },
    { path: '/customers', label: 'customers', name: '05-customers' },
    { path: '/filings', label: 'filings', name: '06-filings' },
    { path: '/documents', label: 'documents', name: '07-documents' },
    { path: '/billing', label: 'billing', name: '08-billing' },
    { path: '/reports', label: 'reports', name: '09-reports' },
    { path: '/settings', label: 'settings', name: '10-settings' },
  ];

  const pageResults = [];
  for (const p of pages) {
    const url = `${BASE}${p.path}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const status = resp?.status();
      await page.waitForTimeout(500);
      await shot(page, p.name, p.label);
      const finalUrl = page.url();
      const unauth = finalUrl.includes('/login') || status === 401 || status === 403;
      const notfound = status === 404;
      const server5xx = status >= 500;
      const title = await page.title();
      pageResults.push({ ...p, url, status, finalUrl, unauth, notfound, server5xx, title });
      console.log(`  ${p.label}: ${status} → ${finalUrl} (title: ${title})`);
      if (notfound) note(`ISSUE-NOTFOUND-${p.label}`, 'high', 'functional', `${p.label} returns 404`, `URL: ${url}`);
      if (server5xx) note(`ISSUE-5XX-${p.label}`, 'critical', 'functional', `${p.label} returns ${status}`, `URL: ${url}`);
      if (unauth && !url.includes('/login')) note(`ISSUE-AUTH-${p.label}`, 'high', 'functional', `${p.label} bounced to login`, `Expected authenticated access; got ${status}`);
    } catch (e) {
      note(`ISSUE-NAV-${p.label}`, 'high', 'functional', `${p.label} nav error`, e.message);
      pageResults.push({ ...p, url, error: e.message });
    }
  }

  console.log('\n▶ Phase 4b: navigation structure audit (onboarding/복잡도 focus)');

  // Count sidebar/nav items (various possible selectors)
  await page.goto(`${BASE}/tax`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1000);

  const navAudit = await page.evaluate(() => {
    const candidates = ['nav', 'aside', '[role="navigation"]', '[data-sidebar]'];
    let best = null;
    let bestLinks = 0;
    for (const sel of candidates) {
      for (const el of document.querySelectorAll(sel)) {
        const links = el.querySelectorAll('a[href], button[type="button"]');
        if (links.length > bestLinks) {
          bestLinks = links.length;
          best = { selector: sel, count: links.length, texts: [...links].slice(0, 30).map(l => (l.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)) };
        }
      }
    }
    return best;
  });
  console.log('  nav audit:', JSON.stringify(navAudit, null, 2));

  if (navAudit && navAudit.count > 12) {
    note('ISSUE-NAV-OVERLOAD', 'medium', 'ux',
      `Sidebar/nav has ${navAudit.count} top-level items`,
      `Nav items: ${JSON.stringify(navAudit.texts)}. >12 top-level items commonly flagged as overwhelming for new users. Prime suspect for 창업자's "복잡해 보임" concern.`);
  }

  // Take final dashboard screenshot
  await shot(page, '11-tax-with-nav', 'tax page w/ nav visible');

  // Check for empty states / onboarding banners
  const emptyStateSignals = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const signals = {
      hasEmptyStateText: /(belum ada|no data|kosong|empty|tidak ada)/i.test(body),
      hasOnboardingBanner: /(mulai|get started|tutorial|panduan|siapkan|selamat datang|welcome)/i.test(body),
      hasCustomerSelection: /(pilih|select).*(wajib pajak|taxpayer|customer|klien)/i.test(body),
    };
    return signals;
  });
  console.log('  empty state / onboarding signals:', emptyStateSignals);

  console.log('\n▶ Responsive check (mobile viewport, key pages)');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of [{ path: '/tax', name: 'mobile-tax' }, { path: '/', name: 'mobile-home' }]) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, `12-${p.name}`, `mobile ${p.path}`);
  }

  // Summary
  console.log('\n▶ Summary');
  console.log(`  console errors: ${consoleErrors.length}`);
  console.log(`  network errors: ${networkErrors.length}`);
  console.log(`  findings: ${findings.length}`);

  const summary = {
    date: new Date().toISOString(),
    baseUrl: BASE,
    consoleErrors,
    networkErrors,
    findings,
    pageResults,
    navAudit,
    emptyStateSignals,
  };
  fs.writeFileSync('.gstack/qa-reports/summary.json', JSON.stringify(summary, null, 2));
  console.log('  wrote summary.json');

} catch (e) {
  console.error('FATAL:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
