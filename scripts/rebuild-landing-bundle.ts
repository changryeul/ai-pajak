import * as fs from 'fs';
import * as path from 'path';
import { modulesKO } from '../src/data/landing/modules';
import { pricingKO } from '../src/data/landing/pricing';

// Reconstruct the same koText that translate-landing.ts uses. We could
// import it from there, but it isn't exported. So we just inline the
// minimal subset that's needed by `text` and re-read the live file's
// koText literal. Easier: use ko text from auto-translated.json's
// previous ko block since the script always re-writes that section.
const CACHE = path.resolve(__dirname, '../scripts/.translate-cache');
const OUT = path.resolve(__dirname, '../src/data/landing/auto-translated.json');

// Pull ko bundle from previous auto-translated.json (it's stable; the
// script always writes the live koText into the ko slot).
const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const koBundle = { modules: modulesKO, pricing: pricingKO, text: prev.ko.text };

// Update ko.text from the latest translate-landing.ts koText. We
// re-read it via a regex from the script source.
const scriptSrc = fs.readFileSync(path.resolve(__dirname, '../scripts/translate-landing.ts'), 'utf8');
const koTextStart = scriptSrc.indexOf('const koText = {');
if (koTextStart >= 0) {
  // Parse from `const koText = {` to matching `};` — naive brace count.
  const i = scriptSrc.indexOf('{', koTextStart);
  let depth = 0;
  let end = -1;
  for (let p = i; p < scriptSrc.length; p++) {
    if (scriptSrc[p] === '{') depth++;
    else if (scriptSrc[p] === '}') {
      depth--;
      if (depth === 0) { end = p + 1; break; }
    }
  }
  if (end > 0) {
    const objSrc = scriptSrc.slice(i, end);
    // Evaluate via Function — the literal is plain JS.
    try {
       
      const koText = new Function(`return ${objSrc}`)();
      koBundle.text = koText;
    } catch (e) {
      console.warn('Failed to parse koText literal, falling back to previous:', (e as Error).message);
    }
  }
}

function loadCached(lang: string, label: 'modules' | 'pricing' | 'text') {
  const p = path.join(CACHE, `${lang}-${label}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const output: Record<string, unknown> = { ko: koBundle };
for (const lang of ['en', 'id', 'zh', 'ja']) {
  const modules = loadCached(lang, 'modules') ?? koBundle.modules;
  const pricing = loadCached(lang, 'pricing') ?? koBundle.pricing;
  const text = loadCached(lang, 'text') ?? koBundle.text;
  output[lang] = { modules, pricing, text };
  const miss = ['modules', 'pricing', 'text'].filter((l) => !fs.existsSync(path.join(CACHE, `${lang}-${l}.json`)));
  console.log(`${lang}: ${miss.length === 0 ? 'full' : `falls back to ko for [${miss.join(', ')}]`}`);
}

fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`\n✓ Wrote ${OUT}`);
