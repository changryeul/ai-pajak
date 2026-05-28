# PPh23 Wholesale Withholding Importer

- **Date**: 2026-05-27
- **Trigger**: User attempted to upload `샘플 급여 데이터.xlsx` (실은 wholesale withholding 거래 dataset) to `/tax/pph21`. Bug fix (`aedef98`) 후 xlsx 파싱은 되지만 schema mismatch 로 의미 X. 파일이 PPh23 페이지가 더 적합한 형태라 그 페이지 보강.
- **Status**: Design approved, ready for implementation plan

## 1. Context

`/tax/pph23` 의 `handleCsvImport` 가 CSV 한 행 → 한 PPh23 transaction 직접 매핑 가정. 실제 wholesale ledger 파일은:
- **3-row meta header** ("Input Data" → "Opp Company Info" → 실제 컬럼명) — 컬럼 위치 자동 이동
- **자유 텍스트 컬럼** ("Biz Name", "Invoice Amount IDR") — 매핑 필요
- **혼합 tax type** ("PPH 23 Jasa" 1652 / "PPH 23 Sewa" 155 / "PPH 4 AYAT 2 …" 152 / "PPh 26" 42 / "PPH 21 Bukan Pegawai" 2) — PPh23 외 196 행 drop
- **Indo 날짜** ("20-Jan-22") — YYYY-MM-DD 변환
- **금액 포맷** (" 16,902,630 " with spaces+thousands separator) — number 변환
- **자유 텍스트 service description** — enum 분류 필요

Track 목적: 이런 ledger 파일을 그대로 업로드 하면 PPh23 행만 골라내고 enum 으로 정규화 후 기존 server endpoint 로 보낸다. 서버 contract / DB schema 변경 없음.

## 2. Decisions (confirmed in brainstorming)

| # | 결정 | 선택 | 이유 |
|---|---|---|---|
| Q-scope | 파일 어디까지 처리 | **(a) PPh23 only** | 1807 행 처리, 비-PPh23 196 행은 explicit skipped 카운트. PPh4(2)/PPh26/PPh21BP 는 별도 페이지/별도 트랙. |
| Q-UX | 매핑 UI 도입 vs auto | **(a) Auto-transform** | mapping UI (PPh21 식) 추가 미필요. 자동 분류 실패는 error breakdown 으로 보고. 추후 (c) hybrid 로 진화 가능. |
| Q-where | client vs server transform | **Client** | `parseTabularFile` (commit `aedef98`) 이미 client. server endpoint 변경 0 → contract 단순 유지. |

## 3. Module structure

신규 모듈 `src/lib/tax/bulk-import/pph23-wholesale-importer.ts`:

```ts
export interface WholesaleImportSummary {
  imported: number;
  skippedByTaxType: number;
  skippedByValidation: number;
  errors: Array<{ rowNumber: number; reason: string }>;
  csvContent: string;        // ready to POST to existing /api/tax/pph23-transactions/import
}

export async function importWholesaleFile(file: File): Promise<WholesaleImportSummary>;
```

내부 단계 (순서대로):

### 3.1 `parseTabularFile(file)` → `{ headers, dataRows }`
기존 `client-file-parser.ts` 그대로 사용. csv/xlsx 통합 파싱.

### 3.2 `detectHeaderRow(rawRows)` → `{ headerRowIdx, columnMap }`
파싱 결과 의 처음 5 행 안에서 "PPh23 같이 들리는 컬럼명" 이 ≥3 개 있는 행을 헤더로 picks. 키워드:
```ts
const HEADER_HINTS = [
  /^biz\s*name$/i,
  /^npwp$/i,
  /^invoice\s*(amount|date|no\.?|number)/i,
  /^tax\s*(rate|base|method)/i,
  /^type\s*of\s*tax/i,
  /^transaction\s*(desc|description)/i,
  /^sub\s*transaction/i,
];
```
2개 이상의 hint 매치하는 첫 행이 헤더. 그 위는 metadata 로 buffer (warn 출력).

매치 못 하면 row 0 가정 + 경고. `columnMap` shape:
```ts
{
  opp_biz_name?: number,
  opp_npwp?: number,
  invoice_amount?: number,
  invoice_date?: number,
  invoice_no?: number,
  sub_transaction?: number,
  type_of_tax?: number,  // ← 필터링용 (PPh23 vs others)
  transaction_desc?: number,
}
```

문서 파일 의 컬럼 텍스트 → columnMap key 매핑은 keyword:
- `Biz Name` → 첫 번째 매치는 `opp_biz_name`, 두 번째는 무시 (My Company info 는 사용 안함)
- `NPWP` → 첫 번째 `opp_npwp`
- `Invoice Amount IDR` / `Invoice Amount` → `invoice_amount`
- `Invoice Date` → `invoice_date`
- `Invoice No` / `Invoice Number` → `invoice_no`
- `Sub Transaction` → `sub_transaction`
- `Type of Tax` (col 20 — Tax block) → `type_of_tax`. 우선순위: column index 가 큰 (오른쪽) "Type of Tax" 가 withholding tax type — `type_of_tax`. 작은 (왼쪽, col 17) 는 VAT type (사용 안함).
- `Transaction Desc` → `transaction_desc`

필수 매핑: `opp_biz_name`, `invoice_amount`, `invoice_date`, `type_of_tax` 4개. 없으면 throw with clear message.

### 3.3 `filterByTaxType(dataRows, columnMap.type_of_tax)` → `{ pph23Rows, skipped }`
- `type_of_tax` 컬럼 값이:
  - `/^PPH\s*23(\s+Jasa)?/i` → keep, classify 단계 에서 JASA_LAINNYA 폴백
  - `/^PPH\s*23\s+Sewa/i` → keep
  - `/^PPH\s*4\s+AYAT\s+2/i` → skip, 카운트 `pph4(2)`
  - `/^PPh\s*26/i` → skip, 카운트 `pph26`
  - `/^PPH\s*21/i` → skip, 카운트 `pph21bp`
  - 빈/매치 안됨 → skip, 카운트 `unknown` 
- Return `pph23Rows` (kept) + `skipped: { pph4_2, pph26, pph21bp, unknown }`.

### 3.4 `normalizeRow(row, columnMap)` → `NormalizedRow | { error }`
각 행에 대해:

- **counterparty_name** = `cleanCell(row[opp_biz_name])`. 빈 string → error "missing counterparty_name".
- **counterparty_npwp** = `cleanNpwp(row[opp_npwp])` (optional). 단순 정리 (공백 strip).
- **invoice_number** = `cleanCell(row[invoice_no])` (optional).
- **description** = `cleanCell(row[transaction_desc])` (optional).
- **gross_amount** = `parseAmount(row[invoice_amount])`. 0 이거나 NaN → error.
- **transaction_date** = `parseIndoDate(row[invoice_date])` → "YYYY-MM-DD". 실패 → error.
- **service_type** = `classifyServiceType(row[type_of_tax], row[sub_transaction], row[transaction_desc])` → enum string.

#### `parseAmount(s)`
공백 제거 → comma/period thousands separator 제거 → Number. " 16,902,630 " → 16902630. "16.902.630" 도 (Indo 식) → 16902630. 마지막에 0 이면 NaN-safe 0 반환 X — caller 가 0 검사.

#### `parseIndoDate(s)`
허용 포맷:
- `DD-MMM-YY` ("20-Jan-22") — Indo 영어 month abbrev
- `DD-MMM-YYYY` ("20-Jan-2022")
- `D/M/YYYY` ("20/1/2022")
- `D/M/YY`
- `YYYY-MM-DD` (ISO)
- `DD-MM-YYYY` 또는 `DD-MM-YY`

`YY` 처리: ≤30 → 2000-2030, >30 → 1900-1999 (Indo 인보이스 맥락). 매치 안됨 → null.

#### `classifyServiceType(typeOfTax, subTrans, desc)`
```ts
const t = typeOfTax.toUpperCase();
if (/PPH\s*23\s+SEWA/.test(t)) return 'SEWA';
// 이 시점에서 t 는 'PPH 23 Jasa' 류
const blob = `${subTrans} ${desc}`.toLowerCase();
if (/manajemen|management/.test(blob)) return 'JASA_MANAJEMEN';
if (/konsultan|consultant|consulting/.test(blob)) return 'JASA_KONSULTAN';
if (/teknik|telekom|internet|sambungan|software|hardware/.test(blob)) return 'JASA_TEKNIK';
return 'JASA_LAINNYA';
```

### 3.5 결과 합산 → CSV serialization
유효한 normalized rows 만 `rowsToCsv(headers, rows)` (`client-file-parser.ts` 기존 export). headers 는 서버 schema 정확히:
```
transaction_date,service_type,gross_amount,counterparty_name,counterparty_npwp,invoice_number,description
```

server endpoint 의 `parseCSV` (papaparse) 가 그대로 받아 처리.

### 3.6 Summary 반환
```ts
{
  imported: 1807,
  skippedByTaxType: 196,      // pph4(2) + pph26 + pph21bp + unknown
  skippedByValidation: 0,     // missing amount/date/name 등
  errors: [],                 // rowNumber + reason
  csvContent: "..."           // POST 이전 client 가 보유
}
```

## 4. UI changes (PPh23 page)

`src/app/[locale]/(dashboard)/tax/pph23/page.tsx` 의 `handleCsvImport`:

기존 (`aedef98` 후):
```ts
const parsed = await parseTabularFile(file);
csvContent = rowsToCsv(parsed.headers, parsed.dataRows);
const res = await fetch('/api/tax/pph23-transactions/import', ...);
```

변경:
```ts
let summary;
try {
  summary = await importWholesaleFile(file);
} catch (parseErr) {
  showMsg('error', `${t('csvUploadFailed')} — ${(parseErr as Error).message}`);
  setUploading(false);
  return;
}

if (summary.imported === 0) {
  showMsg('error', t('wholesaleNoRowsImported', {
    skippedByTaxType: summary.skippedByTaxType,
    skippedByValidation: summary.skippedByValidation,
  }));
  setUploading(false);
  return;
}

const res = await fetch('/api/tax/pph23-transactions/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customerId, taxPeriod: importPeriod, csvContent: summary.csvContent }),
});
// ... 기존 응답 처리 ...

// Toast: 서버 응답의 inserted/total + 클라이언트의 skippedByTaxType 합산
if (summary.skippedByTaxType > 0) {
  showMsg('info', t('wholesaleSkippedTaxType', { count: summary.skippedByTaxType }));
}
```

지금 흐름의 import call 은 그대로. 추가 toast 만 wholesale skip 정보.

## 5. i18n (3 신규 키 × 5 locale)

`pph23Page.*` 에:

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `wholesaleNoRowsImported` | "PPh23 행 0개 — 세금 종류 skip: {skippedByTaxType}, 검증 실패: {skippedByValidation}" | "No PPh23 rows imported — wrong-tax-type skipped: {skippedByTaxType}, validation skipped: {skippedByValidation}" | "Tidak ada baris PPh23 — tipe pajak salah: {skippedByTaxType}, validasi gagal: {skippedByValidation}" | "PPh23 行 0 件 — 税種スキップ: {skippedByTaxType}、検証スキップ: {skippedByValidation}" | "未导入 PPh23 行 — 税种跳过: {skippedByTaxType}, 验证跳过: {skippedByValidation}" |
| `wholesaleSkippedTaxType` | "{count} 행은 PPh23 외 세금 (PPh4(2)/PPh26/PPh21BP) 이라 건너뜀" | "{count} rows skipped — non-PPh23 tax types" | "{count} baris dilewati — bukan PPh23" | "{count} 行スキップ (PPh23 以外)" | "{count} 行已跳过 (非 PPh23)" |
| `wholesaleParseError` | "파일 분석 실패: {reason}" | "File parse failed: {reason}" | "Gagal memproses file: {reason}" | "ファイル解析失敗: {reason}" | "文件解析失败: {reason}" |

## 6. Tests

순수 logic 모듈 → 충분한 단위 테스트:

`src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts`:

- `detectHeaderRow` — 3-row meta header / row 0 헤더 / hint 매치 없음 / hint 2개 vs 3개 경계
- `parseAmount` — " 16,902,630 " / "16.902.630" / "16902630" / "abc" / "" / "0"
- `parseIndoDate` — "20-Jan-22" / "20-Jan-2022" / "20/1/2022" / "2022-01-20" / "abc" / "32-Jan-22" (invalid day)
- `classifyServiceType` — Sewa / Manajemen / Konsultan / Teknik (multiple keywords) / Lainnya fallback / 빈 description
- `filterByTaxType` — PPh23 Jasa kept / PPh23 Sewa kept / PPh 4(2) skipped (각 variant) / PPh26 / PPh21BP / unknown
- end-to-end `importWholesaleFile` — fixture (샘플 파일의 첫 30 행 + 비-PPh23 5 행 + edge cases 5 행 mix) → expected imported / skipped 카운트 정확.

## 7. Files

신규:
- `src/lib/tax/bulk-import/pph23-wholesale-importer.ts` — 메인 파이프라인
- `src/lib/tax/bulk-import/__tests__/pph23-wholesale-importer.test.ts`
- `src/lib/tax/bulk-import/__tests__/fixtures/pph23-sample.csv` 또는 .json — 30+ 행 mixed fixture

수정:
- `src/app/[locale]/(dashboard)/tax/pph23/page.tsx` — handleCsvImport 가 importWholesaleFile 호출
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 신규 i18n 키
- `CLAUDE.md` (optional) — bulk import 가이드 한 줄

서버 endpoint / DB schema 변경: **0**.

## 8. Risks / open questions

- **헤더 detection 의 false positive**: hint 2개 매치 임계가 너무 낮아 잘못된 row 를 헤더로 picks 할 수 있음. 첫 dataRow 가 인식 안 되면 silent 데이터 손실. 대응: 매핑 후 `gross_amount` parse 가 행의 ≥80% 에서 0/NaN 이면 throw + "wrong header row" 메시지.
- **Indo 날짜 ambiguity (DD/MM vs MM/DD)**: "1/3/2022" 는 1월 3일 or 3월 1일? 이 파일 패턴은 DD/MM/YYYY 로 일관 — Indo 표준. parser 는 DD/MM 가정. US-format 파일 들어오면 잘못 해석. 대응: parser 가 month ≤12, day ≤31 양쪽 valid 면 첫 숫자가 day (DD/MM) 로 해석 — 명시.
- **service_type classification 정확도**: 키워드 기반이라 unknown sub-transaction 은 모두 `JASA_LAINNYA` 로 fall back. 사용자가 잘못 분류된 row 발견 시 server 단의 PPh23 list page 에서 수정 가능 (이미 존재하는 기능). 첫 cut 은 fallback OK, 향후 unknowns 가 많이 발견되면 keyword 사전 확장.
- **Counterparty NPWP 정규화**: 파일 NPWP 가 "75.156.278.6-013.000" 포맷. 그대로 두면 정상. validation 없음 (서버가 받아서 PPh23 list 에 저장 — 매칭은 별도 화면 별도 트랙).
- **첫 행 fixture in repo**: 샘플 파일 자체는 user-private. fixture 는 sanitize 된 sample row (NPWP/회사명 가공) 30 행으로 작성. 실 파일은 repo 에 commit 하지 않음.
- **client bundle**: `parseTabularFile` 이미 dynamic xlsx import. 이번 모듈은 추가 lib 없음 → 0 bundle 영향.

## 9. Out of scope

- PPh4(2) / PPh26 / PPh21BP 페이지의 동일 파일 import (별도 트랙)
- VAT/PPN 컬럼 처리 (이 파일에 있지만 PPh23 페이지의 책임 아님)
- Counterparty 자동 매칭 (별도 화면)
- 사용자가 매핑 결과 수정하는 hybrid UI (옵션 (c))
- "Tax Base IDR" vs "Invoice Amount IDR" 구분 (PPh23 는 gross_amount 만 받고 서버가 rate 곱해 계산 — Tax Base 직접 사용 안 함)
