/**
 * 2026-06-24 PPN luxury 재분류 — 이전 알고리즘 (substring 매칭 + vendor
 * 이름 포함) 에서 분류된 행을 새 알고리즘 (word boundary + description
 * only + stop words 보강) 으로 재계산.
 *
 * SUBMITTED 행 (status='SUBMITTED' or 'FILED') 은 건드리지 않음.
 *
 * Run: SEED_TARGET=prod npx tsx scripts/backfill-ppn-luxury.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const LUXURY_STOP_WORDS = new Set([
  'premium', 'luxury', 'imported', 'private', 'fresh', 'large', 'small',
  'item', 'with', 'from', 'category', 'class', 'grade', 'special',
  'sports', 'sport', 'course', 'package', 'years', 'equipment',
  'price', 'property', 'membership', 'collectibles',
]);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function buildKeywordRegexes() {
  const { data } = await admin.from('luxury_item_classifications').select('item_name').eq('category', 'LUXURY');
  const keywords = new Set<string>();
  for (const row of data ?? []) {
    String(row.item_name).toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 5 && !LUXURY_STOP_WORDS.has(w) && !/^\d+$/.test(w))
      .forEach(w => keywords.add(w));
  }
  return Array.from(keywords).map(kw => new RegExp(`\\b${escapeRe(kw)}\\b`, 'i'));
}

// PMK 131/2024 DPP fallback
function adjustDPP(dpp: number, isLuxury: boolean): number {
  if (isLuxury) return dpp; // luxury: DPP = 거래가 (실효 12%)
  return Math.round(dpp * 11 / 12); // 일반: DPP = 거래가 × 11/12 (실효 11%)
}

async function main() {
  const regexes = await buildKeywordRegexes();

  const { data: rows } = await admin
    .from('ppn_faktur_monthly')
    .select('id, description, is_luxury, dpp, dpp_nilai_lain, status')
    .neq('status', 'FILED'); // FILED 는 제출 완료라 건드리지 않음

  if (!rows || rows.length === 0) {
    console.log('no rows to backfill');
    return;
  }
  console.log(`scanning ${rows.length} rows...`);

  let changed = 0;
  let unchanged = 0;
  for (const r of rows) {
    const desc = String(r.description ?? '');
    const newLuxury = regexes.some(re => re.test(desc));
    if (newLuxury === r.is_luxury) {
      unchanged++;
      continue;
    }
    const newDppNilai = adjustDPP(Number(r.dpp || 0), newLuxury);
    const { error } = await admin
      .from('ppn_faktur_monthly')
      .update({ is_luxury: newLuxury, dpp_nilai_lain: newDppNilai })
      .eq('id', r.id);
    if (error) {
      console.log(`  ❌ ${r.id} — ${error.message}`);
    } else {
      console.log(`  ✅ ${r.is_luxury ? 'L' : 'E'} → ${newLuxury ? 'L' : 'E'} "${desc.slice(0, 40)}"`);
      changed++;
    }
  }
  console.log(`\nDone. changed=${changed} unchanged=${unchanged}`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
