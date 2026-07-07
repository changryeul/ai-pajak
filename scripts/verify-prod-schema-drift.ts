/**
 * Verify prod Supabase schema matches what the migration files declare.
 *
 * 2026-06-03 audit found 30+ columns + 1 entire table that Supabase
 * migration history said were applied but were actually missing on prod
 * (root cause: broken `supabase db push` on 2026-04-10 wrote history rows
 * but skipped some statements). Manual audit caught it; this script catches
 * the next one automatically.
 *
 * Scope:
 *   - ADD COLUMN / CREATE TABLE — probed via PostgREST select
 *   - CREATE POLICY / DROP POLICY — probed via schema_audit() RPC
 *   - CREATE INDEX / DROP INDEX — probed via schema_audit() RPC
 *   - ADD CONSTRAINT CHECK / DROP CONSTRAINT — probed via schema_audit() RPC
 *
 * v1 verifies NAME existence only — does NOT compare USING expressions,
 * index column lists, or CHECK predicates. False negatives possible
 * (same name, different definition); false positives unlikely.
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

interface Decl {
  table: string;
  columns: Set<string>;
  dropped: Set<string>;
  policies: Set<string>;          // policy names (per table)
  policiesDropped: Set<string>;
  checks: Set<string>;            // CHECK constraint names (per table)
  checksDropped: Set<string>;     // also covers ANY ALTER TABLE ... DROP CONSTRAINT
  origin: string;
}

interface IndexDecl {
  table: string;
  name: string;
  origin: string;
}

interface ParseResult {
  decls: Decl[];
  indexCreates: IndexDecl[];      // global by name (Postgres)
  indexDrops: { name: string; origin: string }[];
}

// Capture schema (optional) + table so we can skip non-public schemas
// (storage.objects, auth.users, etc. — schema_audit() only covers `public`).
const POLICY_CREATE_RE = /CREATE\s+POLICY\s+["']([^"']+)["']\s+ON\s+(?:(\w+)\.)?["`]?(\w+)["`]?/gi;
const POLICY_DROP_RE = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']([^"']+)["']\s+ON\s+(?:(\w+)\.)?["`]?(\w+)["`]?/gi;

// CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] name ON [public.]table
const INDEX_CREATE_RE = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ON\s+(?:public\.)?["`]?(\w+)["`]?/gi;
// DROP INDEX [IF EXISTS] [public.]name
const INDEX_DROP_RE = /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?/gi;

// Inside ALTER TABLE body:
const CHECK_ADD_RE = /ADD\s+CONSTRAINT\s+["`]?(\w+)["`]?\s+CHECK\b/gi;
const CONSTRAINT_DROP_RE = /DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseMigration(path: string, file: string): ParseResult {
  const sql = stripComments(readFileSync(path, 'utf-8'));
  const declMap = new Map<string, Decl>();
  const indexCreates: IndexDecl[] = [];
  const indexDrops: { name: string; origin: string }[] = [];

  function getDecl(table: string): Decl {
    const t = table.toLowerCase();
    let d = declMap.get(t);
    if (!d) {
      d = {
        table: t,
        columns: new Set(),
        dropped: new Set(),
        policies: new Set(),
        policiesDropped: new Set(),
        checks: new Set(),
        checksDropped: new Set(),
        origin: file,
      };
      declMap.set(t, d);
    }
    return d;
  }

  // CREATE TABLE … (cols, inline constraints)
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    const decl = getDecl(m[1]);
    const body = m[2];
    body.split(',').forEach((line) => {
      const trimmed = line.trim();
      // inline named CHECK constraint: CONSTRAINT name CHECK (...)
      const inlineChk = trimmed.match(/^CONSTRAINT\s+["`]?(\w+)["`]?\s+CHECK\b/i);
      if (inlineChk) {
        decl.checks.add(inlineChk[1].toLowerCase());
        return;
      }
      if (/^(constraint|primary\s+key|foreign\s+key|unique|check|exclude|like)/i.test(trimmed)) return;
      const cm = trimmed.match(/^["`]?(\w+)["`]?\s+/);
      if (cm) decl.columns.add(cm[1].toLowerCase());
    });
  }

  // ALTER TABLE …
  const alterRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?\s+([\s\S]*?);/gi;
  while ((m = alterRe.exec(sql)) !== null) {
    const decl = getDecl(m[1]);
    const body = m[2];

    // columns
    const colRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;
    let cm: RegExpExecArray | null;
    while ((cm = colRe.exec(body)) !== null) decl.columns.add(cm[1].toLowerCase());

    const dropColRe = /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;
    while ((cm = dropColRe.exec(body)) !== null) decl.dropped.add(cm[1].toLowerCase());

    // RENAME COLUMN old TO new = drop(old) + add(new)  (P6.3 rename 대응)
    const renameColRe = /RENAME\s+(?:COLUMN\s+)?["`]?(\w+)["`]?\s+TO\s+["`]?(\w+)["`]?/gi;
    while ((cm = renameColRe.exec(body)) !== null) {
      decl.dropped.add(cm[1].toLowerCase());
      decl.columns.add(cm[2].toLowerCase());
    }

    // CHECK constraints (and any DROP CONSTRAINT)
    let chk: RegExpExecArray | null;
    const checkAddRe = new RegExp(CHECK_ADD_RE.source, CHECK_ADD_RE.flags);
    while ((chk = checkAddRe.exec(body)) !== null) decl.checks.add(chk[1].toLowerCase());

    const constraintDropRe = new RegExp(CONSTRAINT_DROP_RE.source, CONSTRAINT_DROP_RE.flags);
    while ((chk = constraintDropRe.exec(body)) !== null) decl.checksDropped.add(chk[1].toLowerCase());
  }

  // CREATE POLICY (works inside or outside DO blocks). Skip non-public
  // schemas (storage.*, auth.*) because schema_audit() only covers public.
  const polCreateRe = new RegExp(POLICY_CREATE_RE.source, POLICY_CREATE_RE.flags);
  while ((m = polCreateRe.exec(sql)) !== null) {
    const schema = (m[2] ?? 'public').toLowerCase();
    if (schema !== 'public') continue;
    const decl = getDecl(m[3]);
    decl.policies.add(m[1].toLowerCase());
  }
  const polDropRe = new RegExp(POLICY_DROP_RE.source, POLICY_DROP_RE.flags);
  while ((m = polDropRe.exec(sql)) !== null) {
    const schema = (m[2] ?? 'public').toLowerCase();
    if (schema !== 'public') continue;
    const decl = getDecl(m[3]);
    decl.policiesDropped.add(m[1].toLowerCase());
  }

  // CREATE INDEX (global by name)
  const idxCreateRe = new RegExp(INDEX_CREATE_RE.source, INDEX_CREATE_RE.flags);
  while ((m = idxCreateRe.exec(sql)) !== null) {
    indexCreates.push({ name: m[1].toLowerCase(), table: m[2].toLowerCase(), origin: file });
  }
  const idxDropRe = new RegExp(INDEX_DROP_RE.source, INDEX_DROP_RE.flags);
  while ((m = idxDropRe.exec(sql)) !== null) {
    indexDrops.push({ name: m[1].toLowerCase(), origin: file });
  }

  return { decls: Array.from(declMap.values()), indexCreates, indexDrops };
}

async function probeColumn(sb: SupabaseClient, table: string, col: string): Promise<{ ok: boolean }> {
  const { error } = await sb.from(table).select(col).limit(1);
  return { ok: !error };
}
async function probeTable(sb: SupabaseClient, table: string): Promise<{ ok: boolean }> {
  const { error } = await sb.from(table).select('*', { count: 'exact', head: true });
  return { ok: !error };
}

interface SchemaAuditResult {
  policies: Array<{ table: string; name: string }>;
  indexes: Array<{ table: string; name: string }>;
  check_constraints: Array<{ table: string; name: string }>;
}

function stripSchemaPrefix(t: string): string {
  return t.replace(/^public\./, '').replace(/^"public"\./, '').toLowerCase();
}

async function main() {
  console.log(`\n[drift audit] prod schema vs migration declarations\n`);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  // Merge across migration files in chronological order so that ADD-then-DROP
  // across separate files correctly leaves the entity OUT of the expected set.
  const merged = new Map<string, {
    columns: Set<string>;
    policies: Set<string>;
    checks: Set<string>;
    firstOrigin: string;
    policyOrigin: Map<string, string>;
    checkOrigin: Map<string, string>;
    columnOrigin: Map<string, string>;
  }>();
  const expectedIndexes = new Map<string, { table: string; origin: string }>();

  for (const file of files) {
    const { decls, indexCreates, indexDrops } = parseMigration(join(MIGRATIONS_DIR, file), file);
    for (const d of decls) {
      let ex = merged.get(d.table);
      if (!ex) {
        ex = {
          columns: new Set(),
          policies: new Set(),
          checks: new Set(),
          firstOrigin: d.origin,
          policyOrigin: new Map(),
          checkOrigin: new Map(),
          columnOrigin: new Map(),
        };
        merged.set(d.table, ex);
      }
      d.columns.forEach((c) => { ex.columns.add(c); if (!ex.columnOrigin.has(c)) ex.columnOrigin.set(c, d.origin); });
      d.dropped.forEach((c) => { ex.columns.delete(c); ex.columnOrigin.delete(c); });
      d.policies.forEach((p) => { ex.policies.add(p); if (!ex.policyOrigin.has(p)) ex.policyOrigin.set(p, d.origin); });
      d.policiesDropped.forEach((p) => { ex.policies.delete(p); ex.policyOrigin.delete(p); });
      d.checks.forEach((c) => { ex.checks.add(c); if (!ex.checkOrigin.has(c)) ex.checkOrigin.set(c, d.origin); });
      d.checksDropped.forEach((c) => { ex.checks.delete(c); ex.checkOrigin.delete(c); });
    }
    for (const i of indexCreates) {
      expectedIndexes.set(i.name, { table: i.table, origin: i.origin });
    }
    for (const i of indexDrops) {
      expectedIndexes.delete(i.name);
    }
  }
  console.log(`parsed ${files.length} migrations -> ${merged.size} tables`);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ------- Column + table probe (existing) -------
  const driftedCols: Array<{ table: string; col: string; origin: string }> = [];
  const missingTables: Array<{ table: string; origin: string }> = [];
  let colProbes = 0;
  for (const [table, info] of merged.entries()) {
    const t = await probeTable(sb, table);
    if (!t.ok) { missingTables.push({ table, origin: info.firstOrigin }); continue; }
    const cols = Array.from(info.columns);
    for (let i = 0; i < cols.length; i += 8) {
      const batch = cols.slice(i, i + 8);
      const results = await Promise.all(batch.map((c) => probeColumn(sb, table, c)));
      results.forEach((r, idx) => {
        colProbes++;
        if (!r.ok) driftedCols.push({
          table,
          col: batch[idx],
          origin: info.columnOrigin.get(batch[idx]) ?? info.firstOrigin,
        });
      });
    }
  }
  console.log(`probed ${colProbes} columns across ${merged.size} tables`);

  // ------- Schema audit RPC: policies + indexes + checks -------
  const { data: auditData, error: auditErr } = await sb.rpc('schema_audit');
  if (auditErr || !auditData) {
    console.error('!! schema_audit() RPC failed:', auditErr?.message ?? 'no data');
    process.exit(1);
  }
  const audit = auditData as SchemaAuditResult;

  const actualPolicies = new Set<string>();    // "table::name"
  const actualIndexes = new Set<string>();     // name only (Postgres-global)
  const actualChecks = new Set<string>();      // "table::name"

  for (const p of audit.policies ?? []) {
    actualPolicies.add(`${stripSchemaPrefix(p.table)}::${p.name.toLowerCase()}`);
  }
  for (const i of audit.indexes ?? []) {
    actualIndexes.add(i.name.toLowerCase());
  }
  for (const c of audit.check_constraints ?? []) {
    actualChecks.add(`${stripSchemaPrefix(c.table)}::${c.name.toLowerCase()}`);
  }

  const driftedPolicies: Array<{ table: string; name: string; origin: string }> = [];
  const driftedChecks: Array<{ table: string; name: string; origin: string }> = [];
  let polProbes = 0;
  let chkProbes = 0;
  for (const [table, info] of merged.entries()) {
    for (const p of info.policies) {
      polProbes++;
      if (!actualPolicies.has(`${table}::${p}`)) {
        driftedPolicies.push({ table, name: p, origin: info.policyOrigin.get(p) ?? info.firstOrigin });
      }
    }
    for (const c of info.checks) {
      chkProbes++;
      if (!actualChecks.has(`${table}::${c}`)) {
        driftedChecks.push({ table, name: c, origin: info.checkOrigin.get(c) ?? info.firstOrigin });
      }
    }
  }

  const driftedIndexes: Array<{ name: string; table: string; origin: string }> = [];
  let idxProbes = 0;
  for (const [name, info] of expectedIndexes.entries()) {
    idxProbes++;
    if (!actualIndexes.has(name)) {
      driftedIndexes.push({ name, table: info.table, origin: info.origin });
    }
  }
  console.log(`probed ${polProbes} policies / ${idxProbes} indexes / ${chkProbes} checks via schema_audit()`);
  console.log(`drift: ${driftedCols.length} cols, ${missingTables.length} tables, ${driftedPolicies.length} pol, ${driftedIndexes.length} idx, ${driftedChecks.length} chk\n`);

  if (missingTables.length > 0) {
    console.error('MISSING TABLES:');
    missingTables.forEach((t) => console.error(`  - ${t.table} (origin: ${t.origin})`));
  }
  if (driftedCols.length > 0) {
    console.error('\nDRIFTED COLUMNS:');
    const byTable = new Map<string, Array<{ col: string; origin: string }>>();
    for (const d of driftedCols) {
      const arr = byTable.get(d.table) ?? [];
      arr.push({ col: d.col, origin: d.origin });
      byTable.set(d.table, arr);
    }
    for (const [table, cols] of byTable.entries()) {
      console.error(`  ${table}:`);
      cols.forEach((c) => console.error(`    - ${c.col} (origin: ${c.origin})`));
    }
  }
  if (driftedPolicies.length > 0) {
    console.error('\nDRIFTED POLICIES:');
    const byTable = new Map<string, Array<{ name: string; origin: string }>>();
    for (const d of driftedPolicies) {
      const arr = byTable.get(d.table) ?? [];
      arr.push({ name: d.name, origin: d.origin });
      byTable.set(d.table, arr);
    }
    for (const [table, names] of byTable.entries()) {
      console.error(`  ${table}:`);
      names.forEach((n) => console.error(`    - ${n.name} (origin: ${n.origin})`));
    }
  }
  if (driftedIndexes.length > 0) {
    console.error('\nDRIFTED INDEXES:');
    const byTable = new Map<string, Array<{ name: string; origin: string }>>();
    for (const d of driftedIndexes) {
      const arr = byTable.get(d.table) ?? [];
      arr.push({ name: d.name, origin: d.origin });
      byTable.set(d.table, arr);
    }
    for (const [table, names] of byTable.entries()) {
      console.error(`  ${table}:`);
      names.forEach((n) => console.error(`    - ${n.name} (origin: ${n.origin})`));
    }
  }
  if (driftedChecks.length > 0) {
    console.error('\nDRIFTED CHECKS:');
    const byTable = new Map<string, Array<{ name: string; origin: string }>>();
    for (const d of driftedChecks) {
      const arr = byTable.get(d.table) ?? [];
      arr.push({ name: d.name, origin: d.origin });
      byTable.set(d.table, arr);
    }
    for (const [table, names] of byTable.entries()) {
      console.error(`  ${table}:`);
      names.forEach((n) => console.error(`    - ${n.name} (origin: ${n.origin})`));
    }
  }

  const totalDrift = driftedCols.length + missingTables.length
    + driftedPolicies.length + driftedIndexes.length + driftedChecks.length;
  if (totalDrift === 0) {
    console.log(`PASS - no drift (${colProbes} cols, ${polProbes} pol, ${idxProbes} idx, ${chkProbes} chk)\n`);
    process.exit(0);
  }
  console.error('\nFAIL - drift detected. Generate a resync migration.\n');
  process.exit(1);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
