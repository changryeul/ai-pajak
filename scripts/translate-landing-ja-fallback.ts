/**
 * One-off OpenAI fallback for ja-pricing / ja-text.
 *
 * The main translate-landing.ts uses Anthropic, but our key ran out of
 * credit before ja-pricing and ja-text finished. This script uses
 * OpenAI to fill in those two cache entries; once they exist, re-running
 * translate-landing.ts will assemble the final auto-translated.json
 * straight from the disk cache (Anthropic only re-called for missing
 * pieces).
 *
 *   npx tsx scripts/translate-landing-ja-fallback.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { pricingKO } from '../src/data/landing/pricing';
import { koText } from './translate-landing';

config({ path: path.resolve(__dirname, '../.env.local') });

const client = new OpenAI();
const CACHE_DIR = path.resolve(__dirname, '.translate-cache');

const PROMPT_BASE = `You translate Korean marketing JSON into natural Japanese (丁寧体, marketing tone).
RULES:
- Preserve the EXACT JSON structure (same keys, same array order, same nesting).
- Translate only string VALUES, never keys.
- Keep all proper nouns / brand names / tax-form names / Indonesian terms unchanged:
  AI Pajak, Jakarta Tax Consulting, JTC, NPWP, NIK, PPh 21, PPh 23, PPh 4(2), PPh 26,
  Faktur Pajak, SPT, NTPN, BPE, ID Billing, Coretax, A1/A2, payroll, Active/Archive
  Storage, Personal Simple/Standard/Complex, Rp ...
- Keep numbers and currency unchanged (Rp 50,000 / 10GB / 월 → Rp 50,000 / 10GB / 月).
- Output ONLY the JSON value, no commentary, no markdown fences.`;

async function callOpenAI(source: unknown): Promise<string> {
  const resp = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PROMPT_BASE },
      { role: 'user', content: `Translate this Korean JSON to Japanese:\n\n${JSON.stringify(source, null, 2)}` },
    ],
    temperature: 0.2,
  });
  const txt = resp.choices[0].message.content ?? '';
  return txt;
}

async function translateInChunks(source: unknown[]): Promise<unknown[]> {
  // pricing has 10 plans — process in chunks of 2 to keep each prompt
  // small enough that gpt-4o reliably returns valid JSON without truncation.
  const chunkSize = 2;
  const out: unknown[] = [];
  for (let i = 0; i < source.length; i += chunkSize) {
    const chunk = source.slice(i, i + chunkSize);
    console.log(`  pricing chunk ${i / chunkSize + 1}/${Math.ceil(source.length / chunkSize)}…`);
    const text = await callOpenAI({ items: chunk });
    const parsed = JSON.parse(text) as { items: unknown[] };
    if (!Array.isArray(parsed.items)) throw new Error(`Unexpected chunk shape at ${i}`);
    out.push(...parsed.items);
  }
  return out;
}

async function main() {
  // ─ pricing (10 plans, chunked) ─
  const pricingPath = path.join(CACHE_DIR, 'ja-pricing.json');
  if (!fs.existsSync(pricingPath)) {
    console.log('ja-pricing.json missing — translating…');
    const translated = await translateInChunks(pricingKO as unknown[]);
    if (translated.length !== (pricingKO as unknown[]).length) {
      throw new Error(`Plan count mismatch: ${translated.length} vs ${(pricingKO as unknown[]).length}`);
    }
    fs.writeFileSync(pricingPath, JSON.stringify(translated, null, 2));
    console.log(`✓ ja-pricing.json written (${translated.length} plans)`);
  } else {
    console.log('ja-pricing.json already exists, skipping');
  }

  // ─ text (single object) ─
  const textPath = path.join(CACHE_DIR, 'ja-text.json');
  if (!fs.existsSync(textPath)) {
    console.log('ja-text.json missing — translating…');
    const text = await callOpenAI(koText);
    const parsed = JSON.parse(text);
    fs.writeFileSync(textPath, JSON.stringify(parsed, null, 2));
    console.log(`✓ ja-text.json written (${Object.keys(parsed).length} keys)`);
  } else {
    console.log('ja-text.json already exists, skipping');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
