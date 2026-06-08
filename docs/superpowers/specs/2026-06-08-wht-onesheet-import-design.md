# WHT One-Sheet Import — JTC 21-col 통합 매입 ledger

- **Date**: 2026-06-08
- **Status**: Approved — option (c) full integration
- **Builds on**: PPh23/PPh26 wholesale importer 패턴, PPh4(2) 는 신규 (DB 테이블 부재 — v1 PPh23 로 폴백)

## 1. Context

JTC 가 통합 WHT 매입 ledger 템플릿 제공 (`2. (JAKARTA TAX CONSULTING)_TEMPLATE WHT_one sheet.xlsx`). 한 row = 한 매입 invoice, 여러 tax type 가 함께 (PPh23 / PPh26 / PPh4(2) / PPN). 기존 importer 는 tax type 별 ledger 였음. 새 흐름: vendor 가 한 xlsx 에 한 달 모든 매입 invoice 적음 → 시스템이 자동 분류 → 사용자가 preview 에서 row 별 override → bulk insert 가 PPh23/PPh26/PPh4(2)/PPN 각 테이블로 분배.

## 2. 새 템플릿 컬럼 (A:U = 21)

| Col | 헤더 | 의미 |
|---|---|---|
| A | NO | 행 번호 |
| B | ALAMAT | vendor 주소 |
| C | NAMA | vendor 이름 |
| D | NPWP | vendor NPWP |
| E | DESKRIPSI TRANSAKSI | 거래 설명 |
| F | NO. INVOICE | 인보이스 번호 |
| G | NO. FAKTUR PAJAK | 세금계산서 번호 |
| H | TGL INVOICE/FAKTUR PAJAK | 인보이스 날짜 |
| I | TGL JTH TEMPO INV | 만기일 |
| J | TGL PEMBAYARAN | 결제일 |
| K | PPh 21/23/26 JASA/SEWA | "Jasa" / "sewa" / 빈 |
| L | PPh 4(2) SEWA TNH & BANGUNAN | 토지/건물 임대 표시 |
| M | DPP PPN | VAT base |
| N | PPN | VAT (12% × DPP, PMK 131/2024) |
| O | DPP PIHAK KETIGA | WHT base |
| P | PPh 21/23/26 & 4(2) YANG DI INVOICE | WHT amount on invoice |
| Q | BIAYA MATERAI | 인지세 |
| R | BIAYA LAIN-LAIN | 기타 비용 |
| S | JUMLAH YANG DIBAYARKAN KE VENDOR | vendor 최종 지급액 |
| T | NOTES | 메모 |
| U | (null) | unused |

Row 0-4: meta (NAME / NPWP / ADDRESS / PERIODE / TAX COMPLIANCE)
Row 5-6: multi-row header (2 줄)
Row 7+: data

## 3. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 신규 페이지 vs 기존 페이지 통합 | **(a)** 신규 `/tax/wht-import` — workflow 명확 |
| Q2 | 분류 자동화 + override | **자동** classify + preview 에서 row 별 type select 로 override |
| Q3 | PPN 동반 처리 | M+N 채워진 row → PPh row 와 별도로 `ppn_faktur_monthly` insert (same vendor + invoice no) |
| Q4 | PPh26 검출 | NPWP 가 비었거나 invalid format (15자리 미만) → 사용자 override 필요 (default classify 'pph23' + warning) |
| Q5 | PPh4(2) DB | **테이블 부재** — v1 = `pph23_transaction` 으로 폴백 (income_type='RENT_LAND_BUILDING' + 별도 marker) + `note` 컬럼에 'PPh4(2)' 기록 |
| Q6 | partial 실패 | best-effort. row 별 결과 (success/failed/skipped). transaction 없음 — 실패 row 만 skip |

## 4. 분류 룰

```
Row.K (PPh 21/23/26)     Row.L (PPh4-2)     →  classifiedType
─────────────────────────────────────────────────────────────
"Jasa" (any case)         empty             →  pph23_jasa       (2%)
"sewa" (any case)         empty             →  pph23_sewa       (2% — vehicle/equipment)
empty                     non-empty (any)   →  pph4_2_sewa      (10%)
"Jasa" or "sewa"          non-empty         →  pph4_2_sewa      (L 우선, warning)
empty                     empty             →  unknown          (warning, skip default)

+ NPWP missing/invalid    →  warning: "consider pph26"
+ M/N 채워짐              →  vatInsert: true
+ P amount vs O × rate    →  warning if mismatch (>5%)
```

Rate 확정:
- PPh23 jasa = 2% × WHT base (DPP PIHAK KETIGA, O)
- PPh23 sewa harta (vehicle 등) = 2% × O
- PPh4(2) sewa T&B = 10% × O
- PPh26 = 20% × O (treaty 미적용 v1)

## 5. Code 변경

### 5.1 신규: parser

`src/lib/tax/bulk-import/wht-onesheet-parser.ts`:

```ts
export interface WHTLedgerRow {
  no: number;
  vendor: { alamat: string; nama: string; npwp: string };
  invoice: { description: string; invoiceNo: string; fakturNo: string };
  dates: { invoice: string | null; due: string | null; payment: string | null };
  type: { pphLabel: string; pph42Label: string };  // K, L raw
  vat: { dpp: number; ppn: number };
  wht: { base: number; amount: number };
  materai: number;
  miscFee: number;
  vendorPaid: number;
  notes: string;
}

export interface ClassifiedRow extends WHTLedgerRow {
  classified: 'pph23_jasa' | 'pph23_sewa' | 'pph4_2_sewa' | 'pph26' | 'unknown';
  vatInsert: boolean;
  expectedRate: number;          // 0.02 / 0.10 / 0.20
  expectedAmount: number;         // base × rate
  warnings: string[];
}

export interface WHTParseSummary {
  rows: ClassifiedRow[];
  totalRows: number;
  byType: Record<string, number>;
  warnings: string[];
}

export function parseWHTOneSheet(buffer: ArrayBuffer): WHTParseSummary;
export function classifyWHTRow(raw: WHTLedgerRow): ClassifiedRow;
```

parsing 룰:
- sheet 'Sheet1' 만 검사 (단일 시트). 'Sheet1' 없으면 첫 시트 사용.
- header 검출: row 5/6 에 'NO'/'NAMA'/'NPWP' 키워드. 못 찾으면 throw.
- data 시작: header 다음 row (보통 row 7).
- date parsing: '11/7/25' (MM/DD/YY) → ISO YYYY-MM-DD. 두자리 연도는 2000+ 추가. 잘못된 형식 → null.
- amount parsing: 'Rp' / comma / period (Indo thousand-sep) 처리. negative → 0. blank → 0.
- skip row: NO 없거나, vendor name 없음. continuation rows 자동 skip.

### 5.2 unit tests

`src/lib/tax/bulk-import/__tests__/wht-onesheet-parser.test.ts` — ~20 case:
- classify 8 branch 모두
- date MM/DD/YY 파싱
- amount Indo format parsing (`15,200,000.00` / `15.200.000` 둘 다)
- NPWP missing → warning + still classified
- P vs O×rate mismatch → warning
- K + L 모두 채워짐 → pph4_2 우선 + warning
- multi-row header detection
- 빈 row skip

### 5.3 신규: bulk insert endpoint

`src/app/api/tax/wht-import/route.ts`:

```ts
POST { customerId, taxPeriod, rows: ClassifiedRow[] }

per-row processing:
- skip if classified === 'unknown'
- if vatInsert: ppn_faktur_monthly insert (faktur_type='MASUKAN', counterparty_npwp/name from vendor)
- switch (classified) {
    pph23_jasa / pph23_sewa: pph23_transaction insert
    pph4_2_sewa: pph23_transaction insert (income_type='RENT_LAND_BUILDING', notes='PPh4(2)')
    pph26: pph26_transaction insert
  }
- audit log: WHT_IMPORT

response:
{
  data: {
    insertedPph23: number,
    insertedPph26: number,
    insertedPph42: number,
    insertedPpn: number,
    skipped: number,
    failed: [{ rowNo, reason }],
  }
}
```

audit enum 신규: `WHT_IMPORT`. 마이그레이션 1.

### 5.4 신규 페이지

`src/app/[locale]/(dashboard)/tax/wht-import/page.tsx`:

3 step 흐름:
1. **Upload**: xlsx 업로드 (또는 manual sample) + customer/period select
2. **Preview**: parser 결과 표시
   - 통계 카드: byType 분포 + 경고 카운트
   - 행별 표 (21 col 중 핵심만):
     | ✓ | No | Vendor | Desc | Date | Classified (override) | WHT base | WHT amt | VAT | 경고 |
   - "Classified" 셀: `<select>` 로 type 변경 가능
   - "✓" 컬럼: import 여부 토글 (unknown 은 default off)
3. **Import**: POST → result summary (성공 카운트 + 실패 row list)

신규 sidebar 링크: "WHT 일괄 import" — operator/customer 모두 보임.

template 다운로드 버튼: `<a href="/templates/wht-onesheet-template-jtc.xlsx" download>`

### 5.5 정적 template

`public/templates/wht-onesheet-template-jtc.xlsx` — JTC 원본 파일 그대로 복사.

### 5.6 i18n (~20 키 × 5 locale)

`whtImport.*` namespace:
- pageTitle / pageSubtitle
- step.upload / step.preview / step.import
- col.no / col.vendor / col.desc / col.date / col.classified / col.whtBase / col.whtAmount / col.vat / col.warnings
- type.pph23_jasa / type.pph23_sewa / type.pph4_2_sewa / type.pph26 / type.unknown
- btn.upload / btn.download / btn.import / btn.cancel
- toast.imported / toast.failed / toast.partial
- warning.npwpMissing / warning.amountMismatch / warning.dualType

## 6. Files

**신규** (6):
- `src/lib/tax/bulk-import/wht-onesheet-parser.ts`
- `src/lib/tax/bulk-import/__tests__/wht-onesheet-parser.test.ts`
- `src/app/api/tax/wht-import/route.ts`
- `src/app/[locale]/(dashboard)/tax/wht-import/page.tsx`
- `public/templates/wht-onesheet-template-jtc.xlsx`
- `scripts/verify-wht-onesheet-contract.ts`
- `supabase/migrations/20260608000001_audit_enum_wht_import.sql`

**수정** (4):
- `src/components/layout/sidebar.tsx` — "WHT 일괄 import" 링크
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 20 키
- `scripts/test-smoke-all.ts` — STEPS +1 (28→29)

**마이그레이션** (1): audit enum 만

## 7. Smoke (`scripts/verify-wht-onesheet-contract.ts`)

7 assertion:
1. Login + customer + sentinel period (e.g., '2026-08-99')
2. Build synthetic 4-row CSV (또는 parsing skip 후 ClassifiedRow array 직접):
   - Row A: Jasa, NPWP valid, VAT, WHT 60K → pph23_jasa + PPN
   - Row B: sewa (vehicle), NPWP valid, no VAT, WHT 100K → pph23_sewa
   - Row C: PPh4(2) sewa T&B, VAT, WHT 1M → pph4_2_sewa + PPN
   - Row D: PPh23 jasa, NPWP missing → warning but classified
3. POST `/api/tax/wht-import` → 200
4. response.insertedPph23 = 2 (row A vehicle + row D no-npwp)
5. response.insertedPph42 = 1 (row C)
6. response.insertedPpn = 2 (row A + row C have VAT)
7. Cleanup

smoke runner +1 (28→29).

## 8. Out of scope (Phase 별도)

- **PPh4(2) 정식 DB 테이블**: v1 = pph23_transaction 폴백 + note marker. 정식 `pph4_2_transaction` 테이블 + 페이지는 별도 트랙 (4-5h).
- **invoice photo 자동 attach**: v1 = invoice_document_id NULL. 사용자가 PPh23 페이지에서 별도 첨부.
- **PPh21 통합** (K = PPh21): v1 = warning + skip. PPh21 은 직원 급여 트랙 (이미 신규 JTC 24-col template).
- **gross-up 자동 계산** (vendor paid - WHT = invoice net): v1 store-only.
- **Treaty 적용** (PPh26): v1 = 20% flat.
- **multi-period import**: 한 xlsx 가 여러 달 row 있어도 single taxPeriod 으로 강제. 향후 row 별 period 분리.
- **계산 오류 검출 정밀화** (P vs O × rate): v1 = 5% tolerance warning. 정확 검증 v2.

## 9. Risks

- **PPh4(2) DB 없음**: pph23_transaction 폴백 — 보고 시 PPh4(2) 와 섞일 가능성. note='PPh4(2)' marker + income_type='RENT_LAND_BUILDING' 으로 분리. 정식 PPh4(2) 테이블 마이그레이션 후 backfill 가능.
- **PPN faktur 중복 insert**: 같은 invoice 가 manual 입력 + WHT import 양쪽에서 들어가면 중복. server 에서 unique check (counterparty_npwp + invoice_no + tax_period) — 중복 시 skip + warning.
- **date format**: JTC 가 MM/DD/YY 사용. 사용자가 DD/MM/YY 적었으면 swap. 검출: month > 12 면 swap. (PPh23 wholesale importer 가 이미 같은 패턴.)
- **K + L 모두 채워짐**: 사용자 실수 가능성 — v1 = pph4_2 우선 + warning. 사용자가 preview 에서 manual override.
- **NPWP format**: '000000000000' 같은 placeholder → invalid 처리 (12자리 0). 'real PPh26 후보' warning.
- **multi-tax row 1개 invoice**: 한 invoice 가 PPh23 + PPN 동시면 row 2 개 insert (pph23 + ppn_faktur). server transaction 없음 — partial failure 가능. row 별 결과 명확히 표시.
- **권한**: composeMiddleware - CUSTOMER + CONSULTANT_JTC + TAX_ADVISOR_JTC + 3 OPERATOR (PLATFORM_ADMIN block).
- **prod schema drift**: audit enum 만 — drift CI guard PASS.
