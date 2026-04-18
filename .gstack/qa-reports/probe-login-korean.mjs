import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ locale: 'id-ID' });
const page = await ctx.newPage();
await page.goto(`${BASE}/id/login`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
// Extract all Korean chars with surrounding context
const found = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent || '';
    if (/[\uac00-\ud7af]/.test(t)) {
      let parent = n.parentElement;
      const path = [];
      while (parent && path.length < 5) {
        path.push(parent.tagName + (parent.className ? '.' + String(parent.className).slice(0, 30) : ''));
        parent = parent.parentElement;
      }
      hits.push({ text: t.trim().slice(0, 120), path: path.join(' > ') });
    }
  }
  return hits;
});
console.log('Korean hits:', found.length);
found.forEach((h, i) => console.log(`  [${i}] "${h.text}"\n       ${h.path}`));
await b.close();
