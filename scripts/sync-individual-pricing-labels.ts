/**
 * scripts/sync-individual-pricing-labels.ts
 *
 * 랜딩(auto-translated.json)의 개인 요금제 typeLabel/description 을 i18n
 * pricingPlans.SPT_1770SS / SPT_1770S / SPT_1770 의 name/description 으로 옮긴다.
 *
 * 5 lang (ko/en/id/zh/ja) × 3 plan × 2 field = 30 string 일괄 갱신.
 * 내부 id (SPT_1770SS 등)는 그대로 유지 (DB·결제 호환).
 *
 * 실행:
 *   npx tsx scripts/sync-individual-pricing-labels.ts
 */

import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const auto = require('../src/data/landing/auto-translated.json');

const ROOT = path.resolve(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'src/i18n/messages');
const LANGS = ['ko', 'en', 'id', 'zh', 'ja'] as const;
const MAPPING: Record<string, string> = {
  SPT_1770SS: 'p-simple',
  SPT_1770S: 'p-standard',
  SPT_1770: 'p-complex',
};

let touched = 0;

for (const lang of LANGS) {
  const file = path.join(I18N_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`! missing ${lang}.json`);
    continue;
  }
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pp = j.pricingPlans;
  if (!pp) {
    console.warn(`! ${lang}.json has no pricingPlans namespace`);
    continue;
  }
  const langBundle = auto[lang];
  if (!langBundle) {
    console.warn(`! auto-translated.json missing lang=${lang}`);
    continue;
  }
  let changed = 0;
  for (const [key, landingId] of Object.entries(MAPPING)) {
    const landing = langBundle.pricing.find((x: { id: string }) => x.id === landingId);
    if (!pp[key]) {
      console.warn(`  ! ${lang}.pricingPlans.${key} missing`);
      continue;
    }
    if (!landing) {
      console.warn(`  ! ${lang} landing pricing missing id=${landingId}`);
      continue;
    }
    const before = `${pp[key].name} | ${pp[key].description}`;
    pp[key].name = landing.typeLabel;
    pp[key].description = landing.description;
    const after = `${pp[key].name} | ${pp[key].description}`;
    if (before !== after) {
      changed += 2;
      console.log(`  ${lang}.${key}: ${before} → ${after}`);
    }
  }
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
  console.log(`${lang}.json: ${changed} fields changed`);
  touched += changed;
}

console.log(`\n✓ Total: ${touched} fields updated across ${LANGS.length} locales`);
