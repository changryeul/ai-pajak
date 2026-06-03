# SPT Masa PPN — dpp_nilai_lain 활용 + Luxury Split

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2+Q3 = a+a+a)
- **Builds on**: PPN Phase 3.1~3.4 (dpp_nilai_lain 컬럼 + 자동 분류 + luxury governance)

## 1. Context

`SPTMasaCalculator.calculatePPNMasa()` (현 코드) 가 `tax_calculation` 테이블에서 PPN 행 aggregate. 그러나:
- 실 source 는 `ppn_faktur_monthly` (Phase 3.x 의 import 흐름이 여기 저장)
- `dpp_nilai_lain` (PMK 131/2024 adjusted DPP) 활용 0
- luxury vs essential 분리 표시 없음 → DJP audit trail 미흡

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | data source | **(a) `ppn_faktur_monthly` 로 source 전환** — dpp_nilai_lain 직접 사용 |
| Q2 | summary 분리 | **(a) luxury vs essential split** + effective rate + PMK 131/2024 legal_basis |
| Q3 | PDF scope | **(a) 기존 PPN 섹션 보강** — lampiran 신규 X (Phase 별도) |

## 3. Code 변경

### 3.1 `SPTMasaCalculator.calculatePPNMasa()`
`src/lib/tax/spt-masa-calculator.ts`:

```ts
// 기존 (tax_calculation 기반)
static async calculatePPNMasa(params: { customerId, month, year }) {
  const { data } = await supabase
    .from('tax_calculation')
    .select('*')
    .eq('tax_type', 'PPN');
  // ... aggregate output_tax / input_tax / net_tax
}

// 신규 (ppn_faktur_monthly 직접)
static async calculatePPNMasa(params: { customerId, taxPeriod }) {
  const { data: fakturs } = await supabase
    .from('ppn_faktur_monthly')
    .select('faktur_type, dpp, dpp_nilai_lain, ppn, is_luxury')
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod);

  // Split by faktur_type and luxury
  const splits = {
    sales_luxury: { count: 0, total_dpp: 0, total_dpp_nilai_lain: 0, total_ppn: 0 },
    sales_essential: { count: 0, total_dpp: 0, total_dpp_nilai_lain: 0, total_ppn: 0 },
    purchase_luxury: { count: 0, total_dpp: 0, total_dpp_nilai_lain: 0, total_ppn: 0 },
    purchase_essential: { count: 0, total_dpp: 0, total_dpp_nilai_lain: 0, total_ppn: 0 },
  };
  for (const f of fakturs ?? []) {
    const side = f.faktur_type === 'KELUARAN' ? 'sales' : 'purchase';
    const kind = f.is_luxury === true ? 'luxury' : 'essential';
    const k = `${side}_${kind}` as keyof typeof splits;
    splits[k].count++;
    splits[k].total_dpp += Number(f.dpp) || 0;
    splits[k].total_dpp_nilai_lain += Number(f.dpp_nilai_lain) || 0;
    splits[k].total_ppn += Number(f.ppn) || 0;
  }

  const output_tax = splits.sales_luxury.total_ppn + splits.sales_essential.total_ppn;
  const input_tax = splits.purchase_luxury.total_ppn + splits.purchase_essential.total_ppn;
  const net_tax = output_tax - input_tax;

  return {
    tax_type: 'PPN',
    period: taxPeriod,
    output_tax,
    input_tax,
    net_tax,
    sales_count: splits.sales_luxury.count + splits.sales_essential.count,
    purchase_count: splits.purchase_luxury.count + splits.purchase_essential.count,
    // 신규 — PMK 131/2024 split
    splits,
    legal_basis: 'PMK 131/2024 — Essential: DPP × 11/12 × 12% = effective 11%; Luxury: DPP × 12%',
  };
}
```

### 3.2 SPTMasaResponse 형식 확장
- 기존 `output_tax / input_tax / net_tax` 유지 (backward compat)
- 신규 필드 `splits.{sales_luxury, sales_essential, purchase_luxury, purchase_essential}` + `legal_basis`

### 3.3 PDF generator
`src/lib/tax/spt-masa/pdf-generator.tsx`:

기존 PPN 섹션 (line 188+):
```tsx
<Text style={styles.sectionTitle}>B. RINCIAN PPN</Text>
<Row>PPN Keluaran ({sales_count} faktur): {fmt(output_tax)}</Row>
<Row>PPN Masukan ({purchase_count} faktur): {fmt(input_tax)}</Row>
<Row>Selisih (Net PPN): {fmt(net_tax)}</Row>
```

확장:
```tsx
<Text style={styles.sectionTitle}>B. RINCIAN PPN</Text>

{/* Sales (Keluaran) */}
<Text style={styles.subSectionTitle}>B.1 PPN Keluaran (Penjualan)</Text>
<Row>Essential ({splits.sales_essential.count} faktur)
  DPP: {fmt(splits.sales_essential.total_dpp)}
  DPP Nilai Lain (×11/12): {fmt(splits.sales_essential.total_dpp_nilai_lain)}
  PPN (12%): {fmt(splits.sales_essential.total_ppn)}
</Row>
<Row>Luxury ({splits.sales_luxury.count} faktur)
  DPP: {fmt(splits.sales_luxury.total_dpp)}
  PPN (12%): {fmt(splits.sales_luxury.total_ppn)}
</Row>
<Row>Total PPN Keluaran: {fmt(output_tax)}</Row>

{/* Purchases (Masukan) */}
<Text style={styles.subSectionTitle}>B.2 PPN Masukan (Pembelian)</Text>
<Row>Essential ({splits.purchase_essential.count} faktur)
  DPP: {fmt(splits.purchase_essential.total_dpp)}
  DPP Nilai Lain (×11/12): {fmt(splits.purchase_essential.total_dpp_nilai_lain)}
  PPN (12%): {fmt(splits.purchase_essential.total_ppn)}
</Row>
<Row>Luxury ({splits.purchase_luxury.count} faktur)
  DPP: {fmt(splits.purchase_luxury.total_dpp)}
  PPN (12%): {fmt(splits.purchase_luxury.total_ppn)}
</Row>
<Row>Total PPN Masukan: {fmt(input_tax)}</Row>

{/* Net */}
<Text style={styles.subSectionTitle}>B.3 Selisih (Net PPN)</Text>
<Row>Net PPN: {fmt(net_tax)} {net_tax > 0 ? '(KURANG BAYAR)' : net_tax < 0 ? '(LEBIH BAYAR)' : '(NIHIL)'}</Row>

{/* Legal basis footer */}
<Text style={styles.footnote}>{legal_basis}</Text>
```

### 3.4 endpoint `/api/tax/spt-masa`
변경 0 — calculator 결과를 그대로 반환. response shape 확장만 (splits + legal_basis 추가).

UI page `tax/spt-masa/page.tsx` — 새 필드 표시 (선택. PDF 만 보강 v1).

## 4. Files

**수정 (2)**:
- `src/lib/tax/spt-masa-calculator.ts` — `calculatePPNMasa()` 재구현
- `src/lib/tax/spt-masa/pdf-generator.tsx` — PPN 섹션 확장 (B.1/B.2/B.3)

**선택 수정 (1)**:
- `src/app/[locale]/(dashboard)/tax/spt-masa/page.tsx` — UI 에 splits 표시 (v1 PDF only, UI 는 v2 별도)

**마이그레이션 0**. endpoint 0 신규.

## 5. i18n (PDF 는 hardcoded ID/KO, summary 안내 1-2 키)

PDF 의 라벨은 인도네시아어 hardcode (DJP 양식 형식). UI 라벨만 i18n 갱신:
- `pphPpnLuxurySplit`: "PMK 131/2024 — Luxury / Essential 분리"
- `pphPpnLegalBasis`: "법적 근거: PMK 131/2024"

신규 2 키 × 5 locale.

## 6. Smoke

`scripts/verify-spt-masa-ppn-split.ts` — 4 assertion:
1. Seed 2 ESSENTIAL + 1 LUXURY ppn_faktur_monthly rows
2. POST `/api/tax/spt-masa` taxType=PPN → response 200
3. response.splits.sales_essential.count = expected, total_dpp_nilai_lain = (sum × 11/12)
4. response.splits.sales_luxury.count = expected, total_dpp_nilai_lain = total_dpp (no adjustment)
5. cleanup

smoke runner +1 step (23→24).

## 7. Out of scope (Phase 별도)

- DJP Form 1111 lampiran A1/A2/B1/B2 신규 PDF — DJP form 완전 구현 (4시간+, 별도 트랙)
- DJP API 직접 submit (현재 `DRAFT` status 만)
- PPN Tidak Dipungut / Tidak Dikredit 별도 처리
- 다년 / 다월 SPT 통합 (현재 monthly 만)
- xml/csv export for DJP electronic filing

## 8. Risks

- **`tax_calculation` 테이블 의존 코드**: 기존 calculator 변경하면 다른 호출자 (PPh21, PPh23) 영향 없는지 확인 — `calculatePPNMasa()` 만 변경, 나머지 메소드 그대로.
- **legacy SPT Masa filing**: 기존 `filing` row 의 metadata 가 old shape — 응답에 `splits` 가 undefined 일 수 있음. PDF 가 fallback 처리.
- **PDF layout**: subSectionTitle / footnote 스타일이 PDF generator 에 없으면 styles 객체에 추가.
- **prod schema drift audit**: 신규 컬럼 0 — 영향 없음.
