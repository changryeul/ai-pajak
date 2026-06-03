/**
 * Verify prod Supabase schema matches what the migration files declare.
 *
 * 2026-06-03 audit found 30+ columns + 1 entire table that Supabase
 * migration history said were applied but were actually missing on prod
 * (root cause: broken `supabase db push` on 2026-04-10 wrote history rows
 * but skipped some statements). Manual audit caught it; this script catches
 * the next one automatically.
 *
 * Scope: ADD COLUMN + CREATE TABLE statements only. Does NOT verify CHECK
 * constraints / indexes / RLS / comments / triggers — PostgREST does not
 * expose those. The 90% case (column drift) is covered.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-prod-schema-drift.ts
 *
 * Exit 0 = no drift. Exit 1 = drift found.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

interface Decl { table: string; columns: Set<string>; origin: string; }

function parseMigration(path: string, file: string): Decl[] {
  const sql = readFileSync(path, 'utf-8')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Decl[] = [];

  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const body = m[2];
    const columns = new Set<string>();
    body.split(',').forEach((line) => {
      const trimmed = line.trim();
      if (/^(constraint|primary\s+key|foreign\s+key|unique|check|exclude|like)/i.test(trimmed)) return;
      const cm = trimmed.match(/^["`]?(\w+)["`]?\s+/);
      if (cm) columns.add(cm[1].toLowerCase());
    });
    if (columns.size > 0) out.push({ table, columns, origin: file });
  }

  const alterRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?["`]?(\w+)["`]?\s+([\s\S]*?);/gi;
  while ((m = alterRe.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const body = m[2];
    const columns = new Set<string>();
    const colRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;
    let cm: RegExpExecArray | null;
    while ((cm = colRe.exec(body)) !== null) columns.add(cm[1].toLowerCase());
    if (columns.size > 0) out.push({ table, columns, origin: file });
  }
  return out;
}

async function probeColumn(sb: SupabaseClient, table: string, col: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await sb.from(table).select(col).limit(1);
  return error ? { ok: false, reason: error.message } : { ok: true };
}
async function probeTable(sb: SupabaseClient, table: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await sb.from(table).select('*', { count: 'exact', head: true });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

async function main() {
  console.log(`\n[drift audit] prod schema vs migration declarations\n`);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const merged = new Map<string, { columns: Set<string>; firstOrigin: string }>();
  for (const file of files) {
    for (const d of parseMigration(join(MIGRATIONS_DIR, file), file)) {
      const ex = merged.get(d.table);
      if (ex) d.columns.forEach((c) => ex.columns.add(c));
      else merged.set(d.table, { columns: d.columns, firstOrigin: d.origin });
    }
  }
  console.log(`parsed ${files.length} migrations -> ${merged.size} tables`);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const drifted: Array<{ table: string; col: string; origin: string }> = [];
  const missing: Array<{ table: string; origin: string }> = [];

  let probes = 0;
  for (const [table, info] of merged.entries()) {
    const t = await probeTable(sb, table);
    if (!t.ok) { missing.push({ table, origin: info.firstOrigin }); continue; }
    const cols = Array.from(info.columns);
    for (let i = 0; i < cols.length; i += 8) {
      const batch = cols.slice(i, i + 8);
      const results = await Promise.all(batch.map((c) => probeColumn(sb, table, c)));
      results.forEach((r, idx) => {
        probes++;
        if (!r.ok) drifted.push({ table, col: batch[idx], origin: info.firstOrigin });
      });
    }
  }

  console.log(`probed ${probes} columns across ${merged.size} tables`);
  console.log(`drift: ${drifted.length} columns, ${missing.length} entire tables\n`);

  if (missing.length > 0) {
    console.error('MISSING TABLES:');
    missing.forEach((t) => console.error(`  - ${t.table} (origin: ${t.origin})`));
  }
  if (drifted.length > 0) {
    console.error('DRIFTED COLUMNS:');
    const byTable = new Map<string, Array<{ col: string; origin: string }>>();
    for (const d of drifted) {
      const arr = byTable.get(d.table) ?? [];
      arr.push({ col: d.col, origin: d.origin });
      byTable.set(d.table, arr);
    }
    for (const [table, cols] of byTable.entries()) {
      console.error(`  ${table}:`);
      cols.forEach((c) => console.error(`    - ${c.col} (origin: ${c.origin})`));
    }
  }

  if (drifted.length === 0 && missing.length === 0) {
    console.log('PASS - no drift\n');
    process.exit(0);
  }
  console.error('\nFAIL - drift detected. Generate a resync migration.\n');
  process.exit(1);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
