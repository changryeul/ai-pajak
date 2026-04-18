#!/usr/bin/env node
// Check all Indonesian public/auth pages for residual Korean characters.
import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';

const PATHS = ['/id', '/id/login', '/id/register', '/id/register/company', '/id/register/firm', '/id/forgot-password', '/id/pricing'];

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ locale: 'id-ID', viewport: { width: 1400, height: 1100 } });
const page = await ctx.newPage();

let totalHits = 0;
for (const p of PATHS) {
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const hits = await page.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const out = []; let n;
      while ((n = w.nextNode())) {
        const t = n.textContent || '';
        if (/[\uac00-\ud7af]/.test(t)) {
          let parent = n.parentElement;
          const tag = parent ? parent.tagName : '';
          out.push({ text: t.trim().slice(0, 80), tag });
        }
      }
      return out;
    });
    console.log(`${p}: ${hits.length} Korean hits`);
    hits.slice(0, 5).forEach((h) => console.log(`  <${h.tag}> "${h.text}"`));
    totalHits += hits.length;
  } catch (e) {
    console.log(`${p}: ERROR ${e.message.slice(0, 100)}`);
  }
}
console.log(`\nTotal Korean hits: ${totalHits}`);
await b.close();
process.exit(totalHits > 0 ? 1 : 0);
