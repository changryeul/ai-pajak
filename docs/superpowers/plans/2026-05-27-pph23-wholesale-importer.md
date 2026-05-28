# PPh23 Wholesale Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tax/pph23` 가 wholesale ledger xlsx (3-row 헤더 + 혼합 tax type + Indo 날짜 + 자유 텍스트 service) 를 그대로 받아 PPh23 행만 추출 + 정규화 + 기존 server endpoint POST.

**Architecture:** Client-side importer 모듈 (`pph23-wholesale-importer.ts`) 가 `parseTabularFile` (이미 존재) 위에 detectHeader + columnMap + filterByTaxType + normalizeRow 파이프라인. 서버 endpoint / DB / 서버 lib 변경 0.

**Tech Stack:** TypeScript strict, vitest, 기존 `client-file-parser` helper, 추가 라이브러리 0.

**Spec reference:** `docs/superpowers/specs/2026-05-27-pph23-wholesale-importer-design.md`

---

## File Structure

**New files:**
- `src/lib/tax/bulk-import/pph23-wholesale-importer.ts` — 메인 모듈 (~250 lines)
- `src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts` — 단위 테스트 (~30 cases)

**Modified files:**
- `src/app/[locale]/(dashboard)/tax/pph23/page.tsx` — `handleCsvImport` 가 importer 호출
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — `pph23Page.wholesale*` 3 키 추가

마이그레이션 / 서버 변경: **0**.

---

## Task 1: Pure-logic 모듈 — pph23-wholesale-importer.ts

**Files:**
- Create: `src/lib/tax/bulk-import/pph23-wholesale-importer.ts`

Implementer should write the module with these required exports:

- `detectHeaderRow(rows: string[][], lookahead?: number): number` — scans first `lookahead` (default 5) rows for the one with most HEADER_HINTS regex matches; returns best index, falls back to 0 if no row reaches ≥2 hints.
- `mapColumns(header: string[]): ColumnMap` — keyword-matches header cells to schema field indices. "Biz Name" / "NPWP" / "Type of Tax" appear multiple times — pick FIRST for biz_name/npwp (opp side), LAST for type_of_tax (withholding column, not VAT). Required: opp_biz_name, invoice_amount, invoice_date, type_of_tax. Throws `ColumnMapError` (custom class with `.missing: string[]`) if any required column missing.
- `classifyTaxType(s: string): 'pph23_jasa' | 'pph23_sewa' | 'pph4_2' | 'pph26' | 'pph21bp' | 'unknown'` — regex-based classifier for the "Type of Tax" cell value.
- `parseAmount(s: string): number` — strips spaces and `[.,]` thousand separators, returns Number; NaN for any non-digit input or empty.
- `parseIndoDate(s: string): string | null` — accepts: ISO `YYYY-MM-DD` (passthrough), `DD-MMM-YY/YYYY` (Indo English month abbrev), `DD/MM/YYYY` / `DD/MM/YY`, `DD-MM-YYYY` / `DD-MM-YY`. 2-digit year: ≤30 → 20YY, >30 → 19YY. Returns null on parse failure or invalid day/month.
- `classifyServiceType(typeOfTax: string, subTrans: string, desc: string): string` — Sewa → SEWA; PPH 23 Jasa + keyword match in `(subTrans + ' ' + desc).toLowerCase()`: manajemen/management → JASA_MANAJEMEN, konsultan/consultant/consulting → JASA_KONSULTAN, teknik/telekom/internet/sambungan/software/hardware → JASA_TEKNIK, else → JASA_LAINNYA.
- `importWholesaleFile(file: File): Promise<WholesaleImportSummary>` — main pipeline. Calls `parseTabularFile` → prepends headers as row 0 for detection → detectHeaderRow → mapColumns → loop rows: classify tax type (skip non-PPh23 incrementing `skippedByTaxType`), normalize counterparty_name (skip empty), parseAmount (skip ≤0), parseIndoDate (skip null), classifyServiceType → build NormalizedRow array → `rowsToCsv` with exact PPh23 server header order → return summary.

The `PPH23_HEADERS` constant must be the exact ordered tuple:
`['transaction_date', 'service_type', 'gross_amount', 'counterparty_name', 'counterparty_npwp', 'invoice_number', 'description']`

`WholesaleImportSummary` interface:
```ts
export interface WholesaleImportSummary {
  imported: number;
  skippedByTaxType: number;
  skippedByValidation: number;
  errors: Array<{ rowNumber: number; reason: string }>;
  csvContent: string;
}
```

HEADER_HINTS regex list to embed:
```
/^biz\s*name$/i, /^npwp$/i, /^invoice\s*(amount|date|no\.?|number)/i,
/^tax\s*(rate|base|method)/i, /^type\s*of\s*tax/i,
/^transaction\s*(desc|description)/i, /^sub\s*transaction/i
```

Imports needed at top of new file:
- `parseTabularFile, rowsToCsv` from `./client-file-parser`

Steps for implementer:

- [ ] **1.1** Write the module per spec above.
- [ ] **1.2** Run `npx tsc --noEmit -p .` and confirm 0 errors.
- [ ] **1.3** Commit combined with Task 2 (see Task 2 step 2.3).

---

## Task 2: Unit tests (30+ cases)

**Files:**
- Create: `src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts`

Implementer should:

- [ ] **2.1** Create `src/lib/tax/bulk-import/__tests__/` directory if needed (mkdir -p) and write the test file using vitest (`describe / it / expect`, imports from `vitest`).

Tests to include (group by describe block):

**`describe('detectHeaderRow')`**
- returns 0 when no hints match
- finds header at row 2 in a 3-row meta layout (fixture: `[['Input Data','','expected'], ['Opp Company Info','My Co','VAT'], ['Biz Name','NPWP','Invoice Amount'], ['PT X','01.000','100000']]` → expect 2)
- requires ≥2 hints (only "Biz Name" → fallback to 0)

**`describe('mapColumns')`**
- maps the sample wholesale header (22-cell array exactly matching the user's file: `['Biz Name','Type of','NPWP','Biz Type','Biz No','Biz Name','NPWP','Biz Type','Biz No','Transaction Desc','Sub Transaction','Invoice Amount IDR','Invoice Date','Invoice No','Tax Base IDR','Tax Method','IDR','Type of Tax','Tax Rate','IDR','Type of Tax','Tax Rate']`) → expect opp_biz_name=0, opp_npwp=2, invoice_amount=11, invoice_date=12, invoice_no=13, sub_transaction=10, transaction_desc=9, **type_of_tax=20** (LAST match wins).
- throws ColumnMapError with `.missing` containing 'Biz Name', 'Invoice Amount', 'Invoice Date', 'Type of Tax' when given `['name','foo']`.

**`describe('classifyTaxType')`** — 8 cases:
- 'PPH 23 Jasa' → pph23_jasa
- 'PPH 23 Sewa' → pph23_sewa
- 'PPH 23' (no subtype) → pph23_jasa
- 'PPH 4 AYAT 2 konstruksi pelaksanaan' → pph4_2
- 'PPh 26' → pph26
- 'PPH 21 Bukan Pegawai 50%' → pph21bp
- '' → unknown
- 'SOME OTHER TAX' → unknown

**`describe('parseAmount')`** — 7 cases:
- ' 16,902,630 ' → 16902630
- '16.902.630' → 16902630
- '16902630' → 16902630
- '0' → 0
- '' → NaN (use `Number.isNaN`)
- 'abc' → NaN
- '123abc' → NaN

**`describe('parseIndoDate')`** — 11 cases:
- '20-Jan-22' → '2022-01-20'
- '20-Jan-2022' → '2022-01-20'
- '20/1/2022' → '2022-01-20'
- '20-01-2022' → '2022-01-20'
- '20/1/25' → '2025-01-20' (YY≤30 → 20YY)
- '20/1/85' → '1985-01-20' (YY>30 → 19YY)
- '2022-01-20' → '2022-01-20' (ISO passthrough)
- '32-Jan-22' → null (invalid day)
- '20/13/22' → null (invalid month)
- 'not a date' → null
- '' → null

**`describe('classifyServiceType')`** — 7 cases:
- ('PPH 23 Sewa', '', '') → 'SEWA'
- ('PPH 23 Jasa', 'Jasa Management', '') → 'JASA_MANAJEMEN'
- ('PPH 23 Jasa', 'Jasa Konsultan', '') → 'JASA_KONSULTAN'
- ('PPH 23 Jasa', 'Jasa internet', 'Pembayaran Tagihan Internet') → 'JASA_TEKNIK'
- ('PPH 23 Jasa', '', 'Jasa Telekomunikasi') → 'JASA_TEKNIK'
- ('PPH 23 Jasa', 'Unknown service', 'desc') → 'JASA_LAINNYA'
- ('PPH 23 Jasa', '', '') → 'JASA_LAINNYA'

- [ ] **2.2** Run `npx vitest run src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts`. Expected: all PASS (≥30 tests).

- [ ] **2.3** Commit Tasks 1 + 2 together.

Add both files to git:
- `src/lib/tax/bulk-import/pph23-wholesale-importer.ts`
- `src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts`

Commit message (HEREDOC, ko/en bilingual, tag `Wholesale 1/N`):
```
feat(bulk-import): PPh23 wholesale importer + 30+ unit tests (Wholesale 1/N)

신규 src/lib/tax/bulk-import/pph23-wholesale-importer.ts:
  - detectHeaderRow + mapColumns (Type of Tax 는 LAST match)
  - classifyTaxType (PPh23 Jasa/Sewa keep, PPh4(2)/PPh26/PPh21BP skip)
  - parseAmount + parseIndoDate + classifyServiceType
  - importWholesaleFile 파이프라인 → WholesaleImportSummary

테스트 30+ case PASS.
```

---

## Task 3: i18n (3 신규 키 × 5 locale)

**Files:**
- Modify: `src/i18n/messages/{ko,en,id,ja,zh}.json`

For each of 5 locale files, in `pph23Page.*` namespace, add these 3 keys (place near existing `csvUploadFailed` / `csvImportDone`):

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `wholesaleNoRowsImported` | "PPh23 행 0개 — 세금 종류 skip: {skippedByTaxType}, 검증 실패: {skippedByValidation}" | "No PPh23 rows imported — wrong-tax-type skipped: {skippedByTaxType}, validation skipped: {skippedByValidation}" | "Tidak ada baris PPh23 — tipe pajak salah: {skippedByTaxType}, validasi gagal: {skippedByValidation}" | "PPh23 行 0 件 — 税種スキップ: {skippedByTaxType}、検証スキップ: {skippedByValidation}" | "未导入 PPh23 行 — 税种跳过: {skippedByTaxType}, 验证跳过: {skippedByValidation}" |
| `wholesaleSkippedTaxType` | "{count} 행은 PPh23 외 세금 (PPh4(2)/PPh26/PPh21BP) 이라 건너뜀" | "{count} rows skipped — non-PPh23 tax types" | "{count} baris dilewati — bukan PPh23" | "{count} 行スキップ (PPh23 以外)" | "{count} 行已跳过 (非 PPh23)" |
| `wholesaleParseError` | "파일 분석 실패: {reason}" | "File parse failed: {reason}" | "Gagal memproses file: {reason}" | "ファイル解析失敗: {reason}" | "文件解析失败: {reason}" |

- [ ] **3.1** Edit each of the 5 locale files. Use Edit tool with exact JSON insertion before the closing `}` of `pph23Page` (or sibling location with existing similar keys).
- [ ] **3.2** Validate JSON: for each `f` in the 5 files, run `npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));"` and confirm output. Expected: all 5 files parse cleanly.
- [ ] **3.3** Commit combined with Task 4.

---

## Task 4: PPh23 page wiring

**Files:**
- Modify: `src/app/[locale]/(dashboard)/tax/pph23/page.tsx`

- [ ] **4.1** In `src/app/[locale]/(dashboard)/tax/pph23/page.tsx`, find `handleCsvImport` (around line 416). The current parsing+submission block (after `aedef98`) reads:

```
const parsed = await parseTabularFile(file);
csvContent = rowsToCsv(parsed.headers, parsed.dataRows);
const res = await fetch('/api/tax/pph23-transactions/import', ...);
```

Replace the parsing block (NOT the surrounding try/catch/setUploading) with the importer call + early-exit guards. After the importer call:
- If parse throws: showMsg('error', t('wholesaleParseError', {reason: ...})), setUploading(false), return.
- If `summary.imported === 0`: showMsg('error', t('wholesaleNoRowsImported', {skippedByTaxType, skippedByValidation})), setUploading(false), return.
- Else: send `csvContent: summary.csvContent` in the existing fetch body.

After the existing success toast (where it shows the inserted count), add: `if (summary.skippedByTaxType > 0) showMsg('info', t('wholesaleSkippedTaxType', { count: summary.skippedByTaxType }));`

Imports at top: replace
```
import { parseTabularFile, rowsToCsv } from '@/lib/tax/bulk-import/client-file-parser';
```
with
```
import { importWholesaleFile } from '@/lib/tax/bulk-import/pph23-wholesale-importer';
```
(grep first to confirm `parseTabularFile`/`rowsToCsv` aren't used elsewhere in the file — if they are, keep both imports.)

- [ ] **4.2** TS check: `npx tsc --noEmit -p .` expect 0 errors.

- [ ] **4.3** Commit Tasks 3 + 4 together.

Add to git:
- `src/i18n/messages/ko.json src/i18n/messages/en.json src/i18n/messages/id.json src/i18n/messages/ja.json src/i18n/messages/zh.json`
- `src/app/[locale]/(dashboard)/tax/pph23/page.tsx`

Commit message (HEREDOC, ko/en bilingual, tag `Wholesale 2/N`):
```
feat(pph23): wholesale ledger import 통합 (Wholesale 2/N)

handleCsvImport 가 신규 importWholesaleFile 호출 → wholesale xlsx/csv
의 PPh23 행만 추출 + 정규화 → 기존 server endpoint 로 clean CSV POST.
서버 변경 0.

- imported=0 → 명시적 에러 (tax type / 검증 skip 카운트 포함)
- skippedByTaxType > 0 → 성공 toast 후 info toast 추가
- 파일 분석 실패 → wholesaleParseError

i18n 3 신규 키 × 5 locale.
```

---

## Task 5: Push + verify with the sample file

- [ ] **5.1** `git push origin main`.

- [ ] **5.2** Sample file dry-run (Node — verify summary shape).

Use the following tsx snippet (mocking File for Node since the helper expects browser File). Save as `/tmp/dryrun-wholesale.ts` then run via tsx:

```ts
import { importWholesaleFile } from './src/lib/tax/bulk-import/pph23-wholesale-importer';
import * as fs from 'fs';

class NodeFile {
  constructor(public buffer: Buffer, public name: string) {}
  async arrayBuffer() { return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength); }
  async text() { return this.buffer.toString('utf-8'); }
}

const filePath = '/Users/winwaysystems/Downloads/샘플 급여 데이터.xlsx';
const f = new NodeFile(fs.readFileSync(filePath), 'sample.xlsx') as any;

importWholesaleFile(f).then(s => {
  console.log('imported:', s.imported);
  console.log('skippedByTaxType:', s.skippedByTaxType);
  console.log('skippedByValidation:', s.skippedByValidation);
  console.log('errors (first 5):');
  s.errors.slice(0, 5).forEach(e => console.log(' ', e.rowNumber, e.reason));
  console.log('csv first 2 lines:');
  s.csvContent.split('\n').slice(0, 2).forEach(l => console.log(' ', l));
}).catch(e => console.error('FAIL:', e.message));
```

Then run: `npx tsx /tmp/dryrun-wholesale.ts`

Expected:
- `imported: ~1807` (PPh23 Jasa + Sewa)
- `skippedByTaxType: ~196` (PPh4(2) + PPh26 + PPh21BP)
- `skippedByValidation: 0` or small
- csv first line: `transaction_date,service_type,gross_amount,counterparty_name,counterparty_npwp,invoice_number,description`
- csv second line: populated normalized values

- [ ] **5.3** Vercel deploy wait (~2-4 min) — optional visual via browser at `/ko/tax/pph23`, upload xlsx, confirm toast shows imported + skipped counts.

- [ ] **5.4** Save memory file `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_27_pph23_wholesale_importer.md` with sections: name/description/type frontmatter + 결정 + 변경 + Why + How to apply + 미해결. Pattern matches Tracks B/C/A/D memory files.

Then add 1-line pointer to `MEMORY.md` right after the prior pointer:
```
- [2026-05-27 PPh23 wholesale ledger importer](project_2026_05_27_pph23_wholesale_importer.md) — wholesale xlsx 자동 detect+filter+normalize → /tax/pph23 직접 업로드. 신규 client 모듈 + 30+ unit test.
```

## Self-Review checklist
- All unit tests PASS
- TS clean (0 errors)
- Sample file dry-run: imported ≈ 1807, skipped ≈ 196
- 2 feat commits (Wholesale 1/N + 2/N), ko/en bilingual
- `git log origin/main..HEAD` is EMPTY after push
- Memory file + MEMORY.md pointer added
- No env files leaked

## Report Format
- **Status**: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- vitest output summary
- Sample file dry-run output (imported / skipped numbers, csv first line)
- Files changed (per commit)
- 2 commit SHAs
- `git log origin/main..HEAD` empty confirmation
- Concerns

---

## Out of scope

- ecommerce / spt-masa pages (same file.text() bug, separate followup)
- PPh4(2) / PPh26 / PPh21BP pages can use same pattern (separate tracks)
- Counterparty NPWP auto-matching (separate UI)
- Hybrid preview UI (option c) — invoke if auto-classification accuracy issues surface
