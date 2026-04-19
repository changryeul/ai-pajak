import { chromium } from 'playwright';
const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const BASE = process.env.BASE_URL || 'https://ai-pajak.vercel.app';

const b = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1400, height: 2600 }, locale: 'ko-KR' });
const page = await ctx.newPage();

await page.goto(`${BASE}/ko/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.fill('input[type="text"]', 'customer.test@example.com');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname.includes('/dashboard') || u.pathname.includes('/register/'), { timeout: 30000 });
await page.waitForTimeout(1500);
if (!page.url().includes('/dashboard')) {
  await page.goto(`${BASE}/ko/dashboard`, { waitUntil: 'networkidle' });
}
await page.waitForTimeout(4000);
await page.screenshot({ path: '.gstack/qa-reports/screenshots/personal-dash-v3.png', fullPage: true });
const body = (await page.textContent('body')) || '';
const hits = {
  headerSub: body.includes('최근 신고 이력 및 자산/부채 변동을 확인하세요'),
  filters: body.includes('국적') && body.includes('세법 기준'),
  recent3y: body.includes('최근 3년 신고 이력'),
  spouseMode: body.includes('배우자 신고 방식') && body.includes('NPWP 통합'),
  dependents: body.includes('부양가족 수'),
  assetsCard: body.includes('자산 (Assets)') && body.includes('현금 / 은행'),
  liabilitiesCard: body.includes('부채 (Liabilities)') && body.includes('은행 대출'),
  domesticAssetChart: body.includes('자산 변동 (국내)'),
  domesticLiabilityChart: body.includes('부채 변동 (국내)'),
  foreignAssetChart: body.includes('해외 자산 변동'),
  foreignLiabilityChart: body.includes('해외 부채 변동'),
  anomaly: body.includes('자산 증가 이상 감지'),
  fundSource: body.includes('자산 증가 자금 출처 확인'),
  aiComment: body.includes('AI 분석 코멘트'),
  ctaStart: body.includes('신고 시작하기'),
  ctaProgress: body.includes('진행현황 보기'),
};
console.log(JSON.stringify(hits, null, 2));
await b.close();
