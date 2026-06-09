# PPN JTC Template Robustness — Design

- **Date**: 2026-06-09
- **Status**: Approved (A1 — minimal robustness, no new endpoint)
- **Builds on**: PPN wholesale importer (2026-05-30) + DPP Nilai Lain Phase 3.1 (2026-06-01)
- **Source file**: `3. (JAKARTA TAX CONSULTING)_TEMPLATE-VAT.xlsx` (JTC 공식 13-col VAT 템플릿, 13KB, A1:P38)

## 1. Context

JTC 가 신규 법인 고객에게 배포하는 공식 PPN 월별 신고 템플릿. 기존 `ppn-wholesale-importer` (BINTANG JAYA 호환) 는 구조적으로는 JTC 템플릿도 처리 가능하지만, 실제 import 시 다음 **silent quality** 이슈가 발생:

1. **빈 slot noise**: 템플릿은 NO=1,2,3,4 로 4 slot 을 미리 채워둠. 사용자가 1행만 채우면 NO=2,3,4 행이 `missing counterparty_name` 으로 `errors[]` 에 누적 → 운영팀이 "에러 7건" 으로 오해.
2. **rowNumber 부정확**: `parseTabularFile` 가 빈 행을 모두 filter (line 103) → `errors[].rowNumber` 가 원본 Excel 행과 어긋남. 사용자가 보고된 행을 Excel 에서 열어보면 다른 셀.
3. **(별도 issue)** 샘플 row 의 EFAKTUR DATE cell `v=2025-10-31T14:59Z, w=11/1/25` drift — 템플릿 파일 자체 결함. JTC 측 수정 필요. **코드 작업 scope 외**.

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 새 importer 분리 여부 | **(b) 분리 안 함** — 기존 `ppn-wholesale-importer.ts` 보강. JTC 템플릿은 BINTANG JAYA 의 mini 변형 (NO/NPWP/NAME/ADDRESS/INVOICE NO/DESC/EFAKTUR NO/EFAKTUR DATE/TAX BASE/[DPP NILAI LAIN]/TAX RATE/VAT/NOTES). 모든 헤더가 이미 `HEADER_HINTS` + `mapPpnColumns` 와 호환. |
| Q2 | 빈 slot 처리 | **(a) silently skip** as `skippedFooters++`. 사용자가 채우지 않은 미리 번호 매겨진 slot 은 데이터가 아니므로 error 가 아님. 정의: `NO` 가 정수 & 나머지 모든 핵심 컬럼 (`name`, `npwp`, `tax_base`, `efaktur_date`, `vat`) blank → skip. |
| Q3 | rowNumber 정정 방식 | **(a) parseTabularFile 옵션 추가** — `{ preserveRowIndices: true }` 일 때 `dataRows` 와 동일 길이의 `originalRowIndices: number[]` 반환. 기존 caller 무변경 (옵션 default = false). importer 가 이 옵션 켬. |
| Q4 | Endpoint / schema | **변경 없음**. 기존 `/api/tax/ppn-bulk-import` 그대로 재사용. |
| Q5 | 날짜 v/w drift | **JTC 에 별도 피드백**. parser 가 자동 보정 시 다른 silent bug 를 가릴 위험 ↑. 별도 후속 issue. |

## 3. Empty-Slot Detection Rule

```ts
function isEmptySlotRow(row: string[], colMap: PpnColumnMap): boolean {
  const no = getCell(row, colMap.no);
  if (!/^\d+$/.test(no)) return false;                  // 번호가 아니면 미적용
  const fields = [colMap.name, colMap.npwp, colMap.tax_base, colMap.efaktur_date, colMap.vat]
    .map((idx) => getCell(row, idx))
    .filter(Boolean);
  return fields.length === 0;                            // NO 외 모두 blank → 미작성 slot
}
```

`processSection` 의 footer check 직후, `counterparty_name` validation 이전에 호출. footer 와 다른 카운터 (`skippedSlots`) 로 추적해도 무방하지만 단순화 위해 `skippedFooters` 에 합산. 추가 SQL/migration 없음.

## 4. Row Index Preservation

```ts
// parseTabularFile signature change (backwards compat):
export interface ParsedTabular {
  headers: string[];
  dataRows: string[][];
  preview: string[][];
  originalRowIndices?: number[];   // present only when called with { preserveRowIndices: true }
}

export async function parseTabularFile(
  file: File,
  opts?: { preserveRowIndices?: boolean },
): Promise<ParsedTabular>;
```

importer 호출부: `parseTabularFile(file, { preserveRowIndices: true })`. processSection 의 `excelRowOffset` 대신 `originalRowIndices[dataRowIdx] + 1` (1-based) 를 rowNumber 로 사용. 기존 BINTANG JAYA 테스트는 ind 단위가 일관되게 1 씩 어긋날 수 있어 fixture-relative 단언이 필요할 수 있음 — 회귀 시 fix.

## 5. Tests

- **vitest**: 새 `it('handles JTC 13-col template — 1 OUT data + 3 empty slots + 0 IN')` (test 파일에 직접 fixture-shaped aoa 합성, 실 파일 의존 X)
  - assertion: `outImported=1`, `inImported=0`, `skippedByValidation=0`, `errors.length=0`, `outCsv` 첫 데이터행에 `dpp_nilai_lain` 값.
- **smoke**: `scripts/verify-ppn-jtc-template-contract.ts` — vitest 와 동일 시나리오 (synthetic JTC-shape xlsx 합성 → `importPpnWholesaleFile` → 5 assertion). 실 파일에 의존하지 않으므로 `optional: false` (항상 실행).

## 6. Out of Scope (별도 follow-up)

- 날짜 v/w drift 자동 보정 — JTC 측 템플릿 수정 후 재평가
- 새 endpoint, schema, migration
- BINTANG JAYA importer 동작 변경 (회귀 0)
- POST → DB e2e (JTC 템플릿은 in-memory shape 검증으로 충분; BINTANG JAYA e2e 가 이미 POST 경로 cover)

## 7. Roll-up

| 변경 | 파일 |
|---|---|
| 빈 slot detection | `src/lib/tax/bulk-import/ppn-wholesale-importer.ts` |
| Row index 보존 | `src/lib/tax/bulk-import/client-file-parser.ts` |
| 새 unit test | `src/lib/tax/bulk-import/__tests__/ppn-wholesale-importer.test.ts` |
| 새 smoke script | `scripts/verify-ppn-jtc-template-contract.ts` |
| Smoke runner 등록 | `scripts/test-smoke-all.ts` |
| (필요 시) CLAUDE.md smoke step 카운트 | `CLAUDE.md` |
