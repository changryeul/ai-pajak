import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ locale: 'id-ID' });
const page = await ctx.newPage();
await page.goto('https://ai-pajak.vercel.app/id/register', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
const hits = await page.evaluate(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  let n; while ((n = w.nextNode())) {
    const t = n.textContent || '';
    if (/[\uac00-\ud7af]/.test(t)) out.push(t.trim().slice(0, 120));
  }
  return out;
});
console.log('register Korean hits:', hits.length);
hits.forEach(h => console.log('  -', h));
await b.close();
