# PPN Wholesale Importer — Design

- **Date**: 2026-05-30
- **Status**: Approved (Q1+Q2+Q3 = a+a+c→B)
- **Builds on**: PPh23 wholesale importer pattern (2026-05-27)

## 1. Context

BINTANG JAYA SOLUTIONS - VAT COMPLIANCE 2026.xlsx (실 운영 파일) 처럼 customer 의 VAT 월별 시트를 통째로 업로드 → 자동으로 VAT OUT (PPN KELUARAN) + VAT IN (PPN MASUKAN) 두 섹션 분리 + 각각 ppn_faktur_monthly 로 insert. 마이그레이션 0.

PPh23 wholesale 와 동일 패턴 (parseTabularFile → findBestHeaderRow → 매핑 → CSV → POST → DB). 차이: **한 sheet 안에 두 섹션** 이라 섹션 분리 로직이 핵심.

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 섹션 처리 | **(a) 한 번에 두 섹션** — 단일 업로드, importer 가 OUT + IN 모두 추출 후 두 CSV 묶어 반환 |
| Q2 | TAX BASE 선택 | **(a) TAX BASE 그대로** (OTHER TAX BASE = DPP Nilai Lain 11/12 룰은 calculator 가 후처리). bulk 는 simple. |
| Q3 | Endpoint | **(B) 신규 `/api/tax/ppn-bulk-import`** — PPh23 패턴. 기존 단건 endpoint 무변경 + rate hard-code 회피. |

## 3. File Structure (BINTANG JAYA reference)

```
Row 0-3:  NAME / NPWP / ADDRESS / PERIOD meta
Row 4:    (blank or VAT OUT title)
Row 5:    column headers (VAT OUT)
Row 6+:   VAT OUT data rows
Row N:    (blank)
Row N+1:  TOTAL VAT OUT footer (numeric, no labels in column NO/NAME)
Row N+2:  (blank)
Row N+3:  'VAT IN / PPN MASUKAN' section header
Row N+4:  column headers (VAT IN — same as OUT)
Row N+5+: VAT IN data rows
Row M:    TOTAL VAT IN footer
Row M+1+: Notes / NIHIL/KURANG_BAYAR/LEBIH_BAYAR 계산
```

**섹션 분리 규칙**:
- VAT OUT 헤더 = 첫 번째 `findBestHeaderRow` 결과
- VAT IN 헤더 = VAT OUT 헤더 이후 두 번째 hint-rich row (또는 row 에 'VAT IN' / 'MASUKAN' literal 찾기)
- 두 헤더 사이 = VAT OUT 데이터
- VAT IN 헤더 이후 = VAT IN 데이터
- footer row = 첫 cell (NO 컬럼) 가 비어있거나 'TOTAL' literal 인 경우 skip

## 4. Backend

### 4.1 신규 importer: `src/lib/tax/bulk-import/ppn-wholesale-importer.ts`

```ts
export interface PpnWholesaleSummary {
  outImported: number;
  inImported: number;
  outCsv: string;
  inCsv: string;
  skippedByValidation: number;
  errors: Array<{ rowNumber: number; section: 'OUT' | 'IN'; reason: string }>;
}

const PPN_HEADERS = [
  'faktur_date',          // EFAKTUR DATE
  'faktur_number',        // EFAKTUR NO
  'counterparty_name',    // NAME
  'counterparty_npwp',    // NPWP
  'dpp',                  // TAX BASE
  'ppn',                  // VAT (file 의 raw — rate 무관)
  'description',          // DESC
] as const;

const HEADER_HINTS = [
  /^npwp$/i,
  /^name$/i,
  /^address$/i,
  /^desc(ription)?$/i,
  /^efaktur\s*(no\.?|number)/i,
  /^invoice\s*(no\.?|number)/i,
  /^efaktur\s*date/i,
  /^tax\s*base/i,
  /^(tax\s*rate|vat|ppn)$/i,
];

export class PpnColumnMapError extends Error {
  public missing: string[];
  constructor(missing: string[]) {
    super(`Missing required PPN columns: ${missing.join(', ')}`);
    this.name = 'PpnColumnMapError';
    this.missing = missing;
  }
}

export function mapPpnColumns(header: string[]): {
  npwp?: number; name?: number; desc?: number;
  efaktur_no?: number; efaktur_date?: number;
  tax_base?: number; vat?: number;
}

export function findVatInHeader(allRows: string[][], outHeaderIdx: number): number | null;
// 'VAT IN / PPN MASUKAN' literal row 다음의 hint-rich row 찾기

export async function importPpnWholesaleFile(file: File): Promise<PpnWholesaleSummary>;
```

**Pipeline**:
1. `parseTabularFile(file)` → headers + dataRows
2. `findBestHeaderRow(allRows, HEADER_HINTS)` → OUT header index
3. `findVatInHeader(allRows, outHeaderIdx)` → IN header index (literal 'VAT IN' / 'MASUKAN' 검색 후 그 다음 hint-rich row)
4. OUT data = allRows[outHeader+1 ... inHeader-1], skip footer (NO 컬럼 빈/숫자만)
5. IN data = allRows[inHeader+1 ... end], skip footer + Notes 섹션
6. 각 섹션: row → mapPpnColumns → normalize → CSV
7. validation: faktur_date / counterparty_name / dpp 필수

**Footer/Notes skip 규칙** (per row):
- `NO` cell (col 0) 가 비어있고 다른 cell 에 'TOTAL' / 'NIHIL' / 'KURANG' / 'LEBIH' literal 있으면 skip
- 또는 `dpp` cell 이 비어있으면 skip
- 또는 row 전체 비어있으면 skip (이건 parseTabularFile 단계에서 처리됨)

### 4.2 신규 endpoint: `POST /api/tax/ppn-bulk-import`

```ts
// body
{
  customerId?: string;
  taxPeriod: string;       // 'YYYY-MM'
  outCsv?: string;
  inCsv?: string;
}
// response
{
  success: boolean;
  data: {
    outInserted: number;
    inInserted: number;
    errors: Array<{ rowNumber: number; section: string; errors: string[] }>;
  };
}
```

**Handler 흐름**:
1. `composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PPN_BULK_IMPORT'))`
2. customerId 우선순위: body 우선, 없으면 CUSTOMER 자기 customer lookup
3. taxPeriod regex `^\d{4}-\d{2}$`
4. `parseCSV` for both outCsv + inCsv
5. `validatePPNRows` for each section — 필수 필드 + 양수 dpp
6. **Section → ppn_faktur_monthly insert with `faktur_type`**:
   - OUT rows → `faktur_type='KELUARAN'`
   - IN rows → `faktur_type='MASUKAN'`
7. `ppn` 컬럼: row 의 `ppn` field 사용 (file 값 그대로, rate 무관). NaN 이면 dpp × 0.12 fallback (현재 PMK rate)
8. 500 row 제한 (per section)
9. Response: outInserted + inInserted + errors

### 4.3 csv-parser 확장 (필요 시)

기존 `validatePPNRows` 가 `faktur_date / counterparty_name / dpp` 필수로 받음. 우리 CSV header 가 이 이름 사용해야 함 — importer CSV header 를 거기 맞춰서 출력. 추가 변경 0.

## 5. UI

`src/app/[locale]/(dashboard)/tax/ppn/page.tsx`:

PPh23 패턴 그대로:
1. "Wholesale 업로드" 버튼 (별도 또는 기존 single-file upload 와 분기)
2. `await importPpnWholesaleFile(file)` 호출
3. summary 표시: "VAT OUT N건 + VAT IN M건 추출됨"
4. confirm → POST `/api/tax/ppn-bulk-import` with outCsv + inCsv + taxPeriod
5. 결과 toast: outInserted / inInserted / errors count
6. 실패 시 graceful — errors[] sample 표시

PPh23 wholesale UI 와 동일 흐름. 새 i18n 키 3개 (`wholesaleOutImported`, `wholesaleInImported`, `wholesalePpnFailed`) × 5 locale.

## 6. Smoke (`scripts/validate-ppn-bintang-jaya.ts` + `validate-ppn-e2e.ts`)

PPh23 검증 스크립트 패턴 그대로:

### offline (`validate-ppn-bintang-jaya.ts`)
인자 받기: sheet name (default `2601`). 
- 파일 로딩 → importPpnWholesaleFile 호출 → summary print
- 첫 5 OUT + 첫 5 IN normalized row 검증
- footer/Notes skip 정상 확인

### e2e (`validate-ppn-e2e.ts`)
1. importer 실행 → outCsv + inCsv
2. company.test login → customer_id lookup
3. pre-cleanup: `delete from ppn_faktur_monthly where customer_id=$1 and tax_period=$2`
4. POST `/api/tax/ppn-bulk-import` with both CSV
5. 응답 검증: outInserted = expected, inInserted = expected
6. DB select 로 row 검증 (faktur_type 분리 확인)
7. cleanup

## 7. Files

**신규** (4):
- `src/lib/tax/bulk-import/ppn-wholesale-importer.ts`
- `src/lib/tax/bulk-import/__tests__/ppn-wholesale-importer.test.ts` (unit)
- `src/app/api/tax/ppn-bulk-import/route.ts`
- `scripts/validate-ppn-bintang-jaya.ts`
- `scripts/validate-ppn-e2e.ts`

**수정** (2):
- `src/app/[locale]/(dashboard)/tax/ppn/page.tsx` — wholesale upload 통합
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 키 × 5 locale

**마이그레이션 0**. `ppn_faktur_monthly` table 그대로 재사용.

## 8. Validation expectations (BINTANG JAYA Sheet 2601)

| Section | rows | 예시 첫 행 |
|---|---|---|
| VAT OUT | 6 | KR INDUSTRY CO LTD / NPWP 1000000002518180 / 2026-01-04 / DPP 3,900,000 / VAT 429,000 / EFAKTUR 04002600001115420 |
| VAT IN | 19 | RATU ANGKASA TEKNOLOGI / NPWP 0405879941077000 / 2026-01-01 / DPP 4,233,333 / VAT 465,667 / EFAKTUR 04002600000156638 |

E2E 성공 기준: `outInserted=6 && inInserted=19 && errors=[]`. DB 검증: `count where faktur_type='KELUARAN'=6 && faktur_type='MASUKAN'=19`.

## 9. Out of scope (Phase 3.1+)

- OTHER TAX BASE (Nilai Lain 11/12) 자동 계산 — calculator 단에서 별도 트랙
- DPP Nilai Lain 컬럼 활용
- PPN Tidak Dipungut / Dikredit 별도 처리
- 다년/다월 시트 한 번에 (현재는 sheet 1개 = month 1개)
- e-Faktur API 연동 (DJP)
- 기존 단건 endpoint `/api/tax/ppn-faktur-monthly` 의 rate `0.11` hard-code fix (별도 마이너 트랙)

## 10. Risks

- **섹션 분리 휴리스틱**: 'VAT IN' literal 못 찾으면 fallback 으로 두 번째 hint-rich row. 둘 다 실패 시 IN section 0 import + error. 명시적 에러 메시지.
- **Footer mis-detect**: TOTAL row 가 잘못 데이터로 들어가면 dpp 가 비정상 (합계 = 큰 값). validation 의 양수 dpp check + 'TOTAL' literal skip 로 방어.
- **rate mismatch**: file 의 0.12 vs 기존 endpoint 의 0.11 hard-code. bulk endpoint 는 file 의 ppn 값 그대로 사용 (rate 무관) → 회피.
- **다른 customer 파일 구조 차이**: BINTANG JAYA 만 검증. 다른 customer 가 column 순서 다를 수도 — `findBestHeaderRow` + `mapPpnColumns` 의 keyword 기반이라 어느 정도 robust. 첫 실 사용에서 더 보강.
- **DPP Nilai Lain (Q2 보류 결정)**: 11/12 룰 적용된 calculator-level 값을 그대로 import 하면 PPN 계산 일관성 X. 현재는 TAX BASE 그대로 → calculator 가 후처리. 향후 spec 확장.
