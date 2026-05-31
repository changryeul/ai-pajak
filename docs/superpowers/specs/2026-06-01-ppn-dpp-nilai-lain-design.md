# PPN Phase 3.1 — DPP Nilai Lain 자동 보존 (PMK 131/2024)

- **Date**: 2026-06-01
- **Status**: Approved (Q1+Q2+Q3 = a+b+a)
- **Builds on**: PPN wholesale importer (2026-05-30) + single-entry fix (2026-06-01)

## 1. Context

PPN calculator (`src/lib/tax/ppn-calculator.ts`) 는 이미 PMK 131/2024 정확히 처리:
- 2025+ essential: dpp × 11/12 → 12% = effective 11%
- 2025+ luxury: dpp × 12% = full 12%

그러나 importer + DB schema 가 metadata 손실:
- `ppn_faktur_monthly.dpp` = raw TAX BASE 저장
- `ppn_faktur_monthly.ppn` = file VAT raw 저장
- **누락**: `dpp_nilai_lain` (adjusted DPP), `is_luxury`
- BINTANG JAYA VAT file 의 OTHER TAX BASE (`= dpp × 11/12`) column 가 그냥 버려짐

후속 영향:
- DJP 신고서 생성 시 DPP Nilai Lain 필요 → derive 해야 (calculator 다시 호출)
- audit/reconciliation 시 file 원본의 DPP Nilai Lain 과 일치 확인 불가
- luxury 여부 알 수 없어 어떤 룰 적용했는지 traceability X

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | DB schema | **(a) 2 컬럼 추가** — `dpp_nilai_lain NUMERIC NULL` + `is_luxury BOOLEAN NULL`. backward compat. |
| Q2 | luxury 판정 | **(b) default essential** — 모든 import row 는 `is_luxury=false` (PMK 131/2024 default + safer). 사용자 review UI 는 별도 트랙. |
| Q3 | OTHER TAX BASE | **(a) file 신뢰** — 있으면 `dpp_nilai_lain` 으로 저장. 없으면 calculator 의 `adjustDPP(dpp, date, false)` fallback. |

## 3. Schema

**신규 마이그레이션**: `supabase/migrations/20260601000001_ppn_dpp_nilai_lain.sql`

```sql
alter table ppn_faktur_monthly
  add column dpp_nilai_lain numeric null,
  add column is_luxury boolean null;

comment on column ppn_faktur_monthly.dpp_nilai_lain is
  'DPP Nilai Lain (adjusted DPP per PMK 131/2024). Essential goods 2025+ = dpp × 11/12. NULL = pre-PMK or not yet computed.';
comment on column ppn_faktur_monthly.is_luxury is
  'Luxury item flag per PMK 131/2024 Pasal 2. TRUE = full 12%. FALSE/NULL = essential (effective 11%).';
```

RLS unchanged. No backfill required — NULL is meaningful (legacy rows).

## 4. Importer

`src/lib/tax/bulk-import/ppn-wholesale-importer.ts`:

**컬럼 매핑 확장** (`mapPpnColumns`):
- 기존: `npwp / name / desc / efaktur_no / efaktur_date / tax_base / vat`
- 추가: `other_tax_base` ← `/^other\s*tax\s*base/i` 또는 `/^dpp\s*nilai\s*lain/i`

**Normalize 확장**:
- 신규 field `dpp_nilai_lain: string`
- 값 결정:
  - file 에 OTHER TAX BASE 컬럼 있고 값 valid → 그대로 (file 신뢰)
  - 없거나 invalid → empty string (server 에서 calculator 호출)

**CSV header 확장** (`VAT_OUT_HEADERS`):
```ts
['faktur_date', 'faktur_number', 'counterparty_name', 'counterparty_npwp', 'dpp', 'dpp_nilai_lain', 'ppn', 'description']
```

`csv-parser.validatePPNRows` 변경 없음 (dpp_nilai_lain 은 optional).

## 5. Bulk endpoint

`src/app/api/tax/ppn-bulk-import/route.ts`:

`processSection` 의 insert payload 확장:
```ts
const dppNum = parseFloat(r.data.dpp);
const dppNilaiLainFromFile = parseFloat(r.data.dpp_nilai_lain);
const isLuxury = false;  // Q2(b) — default essential
const dppNilaiLain = Number.isFinite(dppNilaiLainFromFile) && dppNilaiLainFromFile > 0
  ? Math.round(dppNilaiLainFromFile)
  : PPNCalculator.adjustDPP(dppNum, new Date(r.data.faktur_date), isLuxury);

return {
  ...,
  dpp: dppNum,
  dpp_nilai_lain: dppNilaiLain,
  is_luxury: isLuxury,
  ppn: Math.round(ppnNum),
};
```

`import { PPNCalculator } from '@/lib/tax/ppn-calculator';` 추가.

## 6. Single-entry endpoint

`src/app/api/tax/ppn-faktur-monthly/route.ts` POST 도 같은 패턴:
- body 에 `dppNilaiLain?: number, isLuxury?: boolean` (optional)
- 미지정 시 `PPNCalculator.adjustDPP(dpp, fakturDate, isLuxury ?? false)` fallback

GET 응답 shape 변경 X (DB column 추가만 → SELECT * 가 자동 포함).

## 7. UI (optional, 최소 변경)

`src/app/[locale]/(dashboard)/tax/ppn/page.tsx`:
- 표 column 1개 추가: "DPP Nilai Lain" (있으면 표시, 없으면 dash). column header i18n key 1개.
- 단건 entry form 에 luxury checkbox + dpp_nilai_lain 자동 표시 (read-only, calculator 결과). 
- 빠른 작업: column 표시만, form 변경은 Phase 3.2 로 deferred.

## 8. Smoke

기존 검증 자산 갱신 + 1 신규:
- `scripts/validate-ppn-e2e.ts`: assertion 추가 — DB row 의 `dpp_nilai_lain` 가 file OTHER TAX BASE 와 일치 (small tolerance for rounding)
- `scripts/verify-ppn-single-entry-rate.ts`: 추가 case — body 에 dppNilaiLain 보내면 그대로 저장; 안 보내면 calculator fallback
- `scripts/validate-ppn-bintang-jaya.ts`: offline 검증에 normalized row 의 `dpp_nilai_lain` field print

신규 unit test (ppn-wholesale-importer.test.ts 에 ~3 case 추가):
- OTHER TAX BASE column 매핑
- value 있을 때 normalize 에 포함
- value 없을 때 빈 string

## 9. Files

**신규** (1):
- `supabase/migrations/20260601000001_ppn_dpp_nilai_lain.sql`

**수정** (6):
- `src/lib/tax/bulk-import/ppn-wholesale-importer.ts` — mapPpnColumns + Normalized 확장 + CSV header
- `src/lib/tax/bulk-import/__tests__/ppn-wholesale-importer.test.ts` — +3 case
- `src/app/api/tax/ppn-bulk-import/route.ts` — insert payload + PPNCalculator import
- `src/app/api/tax/ppn-faktur-monthly/route.ts` — body field 추가
- `src/app/[locale]/(dashboard)/tax/ppn/page.tsx` — table column 1
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 1 키 (`dppNilaiLain` column header)
- `scripts/validate-ppn-e2e.ts` + `verify-ppn-single-entry-rate.ts` — smoke 확장

**마이그레이션**: 1 (+2 컬럼)

## 10. 검증 기준 (BINTANG JAYA Sheet 2601)

- importer offline: 25 normalized rows, 모두 `dpp_nilai_lain != ''` (file 의 OTHER TAX BASE 직접 사용)
- e2e: DB 의 `dpp_nilai_lain` 가 file 의 OTHER TAX BASE 와 일치 (tolerance 1 IDR)
- 예시 row: dpp=3,900,000 + dpp_nilai_lain=3,575,000 + ppn=429,000 + is_luxury=false ✓ (3,575,000 × 12% = 429,000 ✓)

## 11. Out of scope (Phase 3.2+)

- luxury 일괄 review UI (사용자가 분류 토글)
- `luxury_item_classifications` 테이블 seed + auto-classification on import
- 단건 entry form 의 luxury checkbox / DPP Nilai Lain auto-display
- 기존 DB row backfill (NULL → calculator-derived)
- DJP 신고서 생성 시 DPP Nilai Lain 활용 (별도 트랙)

## 12. Risks

- **OTHER TAX BASE float artifact**: file 에 `3242750.0000000005` 같은 값 가능. cleanCell 이 이미 Math.round 처리 → 안전.
- **legacy row NULL**: 기존 import 된 row 는 `dpp_nilai_lain=NULL`. 후속 계산에서 NULL 처리 필요 (COALESCE 또는 calculator fallback). 본 spec 에선 SELECT 시 그대로 노출, UI 가 dash 표시.
- **luxury default false**: import row 가 luxury 면 잘못된 dpp_nilai_lain 저장. PMK 131/2024 안전 default 가 false (effective 11%) 라 큰 손해 없지만 정확성 ↓. Phase 3.2 의 review UI 로 보완.
- **단건 entry UI 미동기**: body 에 dppNilaiLain 안 보내면 server 가 calculator 호출. 이때 UI 는 form 미변경이라 사용자 모름. 안전한 default 동작 (essential).
