# DJP Form 1111 Lampiran A1/A2/B1 — SPT Masa PPN PDF 확장

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2 = a+a)
- **Builds on**: SPT Masa PPN dpp_nilai_lain (commit `21a4526`)

## 1. Context

SPT Masa PPN PDF 가 현재 summary (B.1/B.2/B.3) 만. DJP Form 1111 의 정식 lampiran (faktur 별 detail) 없음. DJP 신고 시 inspector 가 행별 detail 검증 못함.

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | scope | **(a) A1+A2+B1** — NPWP 유무로 A1/A2 split, B1 = 모든 MASUKAN (공제 가능 가정). B2/B3 는 schema 확장 필요 → 별도 트랙 |
| Q2 | layout | **(a) 기존 SPT Masa PDF append** — B.3 뒤에 lampiran 페이지 추가. 신규 endpoint X |

### Lampiran 분류 규칙
- **A1** = `faktur_type='KELUARAN'` AND `counterparty_npwp` NOT NULL (PKP 매출)
- **A2** = `faktur_type='KELUARAN'` AND `counterparty_npwp` NULL OR empty (Non-PKP)
- **B1** = `faktur_type='MASUKAN'` ALL (현 spec 은 공제 가능 가정 — schema 에 tidak_dikreditkan 컬럼 없음)

## 3. Code 변경

### 3.1 `SPTMasaCalculator.calculatePPNMasa()` 반환 확장
`src/lib/tax/spt-masa-calculator.ts`:

기존 response 에 `lampiran` field 추가:
```ts
type FakturRow = {
  id: string;
  faktur_number: string | null;
  faktur_date: string;
  counterparty_npwp: string | null;
  counterparty_name: string | null;
  dpp: number;
  dpp_nilai_lain: number;
  ppn: number;
  ppnbm: number;
  is_luxury: boolean;
};

return {
  // ... 기존 (output_tax / input_tax / net_tax / splits / legal_basis)
  lampiran: {
    a1_pkp_sales: FakturRow[],     // KELUARAN with NPWP
    a2_non_pkp_sales: FakturRow[], // KELUARAN without NPWP
    b1_input_credit: FakturRow[],  // MASUKAN all
  },
};
```

분류 로직:
```ts
const a1 = [], a2 = [], b1 = [];
for (const f of fakturs ?? []) {
  const row = mapToFakturRow(f);
  if (f.faktur_type === 'KELUARAN') {
    const hasNpwp = (f.counterparty_npwp ?? '').trim().length >= 15;
    (hasNpwp ? a1 : a2).push(row);
  } else if (f.faktur_type === 'MASUKAN') {
    b1.push(row);
  }
}
// Sort by faktur_date ASC for DJP convention
a1.sort((x, y) => x.faktur_date.localeCompare(y.faktur_date));
// ... same for a2, b1
```

### 3.2 PDF generator 확장
`src/lib/tax/spt-masa/pdf-generator.tsx`:

기존 PPN 섹션 (B.1/B.2/B.3) 뒤에 lampiran 페이지 추가. `@react-pdf/renderer` 의 `<Page>` 로 새 페이지 break:

```tsx
{sptMasa.tax_type === 'PPN' && sptMasa.breakdown.lampiran && (
  <>
    <Page size="A4" style={styles.page}>
      <LampiranSection title="LAMPIRAN A1 — Penyerahan kepada PKP" rows={lampiran.a1_pkp_sales} />
    </Page>
    {lampiran.a2_non_pkp_sales.length > 0 && (
      <Page size="A4" style={styles.page}>
        <LampiranSection title="LAMPIRAN A2 — Penyerahan kepada Non-PKP" rows={lampiran.a2_non_pkp_sales} />
      </Page>
    )}
    <Page size="A4" style={styles.page}>
      <LampiranSection title="LAMPIRAN B1 — Perolehan yang Dapat Dikreditkan" rows={lampiran.b1_input_credit} />
    </Page>
  </>
)}
```

신규 컴포넌트 `LampiranSection`:
```tsx
function LampiranSection({ title, rows }: { title: string; rows: FakturRow[] }) {
  const totalDpp = rows.reduce((s, r) => s + r.dpp, 0);
  const totalDppNilaiLain = rows.reduce((s, r) => s + r.dpp_nilai_lain, 0);
  const totalPpn = rows.reduce((s, r) => s + r.ppn, 0);

  return (
    <View>
      <Text style={styles.lampiranTitle}>{title}</Text>
      <Text style={styles.lampiranSubtitle}>{rows.length} faktur</Text>

      {/* Table header */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={styles.colNo}>No.</Text>
        <Text style={styles.colFaktur}>Nomor Faktur</Text>
        <Text style={styles.colDate}>Tanggal</Text>
        <Text style={styles.colNpwp}>NPWP</Text>
        <Text style={styles.colCounterparty}>Nama Lawan Transaksi</Text>
        <Text style={styles.colAmount}>DPP</Text>
        <Text style={styles.colAmount}>DPP Nilai Lain</Text>
        <Text style={styles.colAmount}>PPN</Text>
      </View>

      {/* Rows */}
      {rows.map((r, i) => (
        <View key={r.id} style={styles.tableRow}>
          <Text style={styles.colNo}>{i + 1}</Text>
          <Text style={styles.colFaktur}>{r.faktur_number || '—'}</Text>
          <Text style={styles.colDate}>{r.faktur_date}</Text>
          <Text style={styles.colNpwp}>{r.counterparty_npwp || '—'}</Text>
          <Text style={styles.colCounterparty}>{r.counterparty_name || '—'}</Text>
          <Text style={styles.colAmount}>{fmt(r.dpp)}</Text>
          <Text style={styles.colAmount}>{fmt(r.dpp_nilai_lain)}</Text>
          <Text style={styles.colAmount}>{fmt(r.ppn)}</Text>
        </View>
      ))}

      {/* Total row */}
      <View style={[styles.tableRow, styles.tableTotal]}>
        <Text style={[styles.colNo, styles.tableTotalLabel]} colSpan={5}>TOTAL ({rows.length} faktur)</Text>
        <Text style={styles.colAmount}>{fmt(totalDpp)}</Text>
        <Text style={styles.colAmount}>{fmt(totalDppNilaiLain)}</Text>
        <Text style={styles.colAmount}>{fmt(totalPpn)}</Text>
      </View>
    </View>
  );
}
```

신규 styles 추가:
```ts
lampiranTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
lampiranSubtitle: { fontSize: 8, color: '#666', marginBottom: 12 },
tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 4 },
tableHeader: { backgroundColor: '#f3f4f6', fontWeight: 'bold', fontSize: 8 },
tableTotal: { backgroundColor: '#fef3c7', fontWeight: 'bold', fontSize: 9 },
tableTotalLabel: { textAlign: 'right' },
colNo: { width: '4%', fontSize: 8, textAlign: 'center' },
colFaktur: { width: '15%', fontSize: 8 },
colDate: { width: '9%', fontSize: 8, textAlign: 'center' },
colNpwp: { width: '14%', fontSize: 8 },
colCounterparty: { width: '22%', fontSize: 8 },
colAmount: { width: '12%', fontSize: 8, textAlign: 'right' },
```

### 3.3 페이지 분리 (rows 많을 때)
react-pdf 의 `<Page>` 는 자동 페이지 break 제공. 단 `View` 가 페이지 넘침 시 `wrap` 속성으로 break 가능. 또는 `View break` 또는 row 50개씩 manual chunk.

v1: 한 lampiran 당 한 `<Page>` + react-pdf 의 default wrap behavior (다음 페이지로 overflow).

## 4. Files

**수정 (2)**:
- `src/lib/tax/spt-masa-calculator.ts` — `calculatePPNMasa()` 가 `lampiran` field 추가 (3 array 분류)
- `src/lib/tax/spt-masa/pdf-generator.tsx` — LampiranSection 컴포넌트 + 3 page append + styles

**마이그레이션 0. endpoint 0**.

## 5. Smoke

기존 `verify-spt-masa-ppn-split.ts` 확장 — assertion 추가:
- 5. response.sptMasa.lampiran.a1_pkp_sales.length = (NPWP 있는 KELUARAN 수)
- 6. response.sptMasa.lampiran.a2_non_pkp_sales.length = (NPWP 없는 KELUARAN 수)
- 7. response.sptMasa.lampiran.b1_input_credit.length = (모든 MASUKAN 수)

총 4 → 7 assertion.

## 6. Out of scope

- **B2 (PPN Tidak Dipungut) + B3 (Tidak Dapat Dikreditkan)**: schema 확장 필요 — 별도 Phase
- **A2 의 NPWP 형식 정확 검증** (15-digit + checksum): v1 은 NULL/empty 만 분리
- **PDF export 형식 (XML for DJP electronic filing)**: 별도 Phase
- **PDF 한국어 자막**: hardcoded ID (DJP form 관행)

## 7. Risks

- **PDF row 폭증**: 한 thread 가 1000+ faktur 면 PDF 페이지 30+. react-pdf 가 자동 wrap 처리. 큰 PDF 다운로드 시간 ↑ — 1000+ faktur 면 별도 export endpoint 권장 (Phase).
- **NPWP format 검증 정확도**: 15자리만 체크. invalid 15-자리 format 도 PKP 분류. v2 에서 정확한 NPWP checksum 검증.
- **PDF 페이지 layout**: 한 lampiran 의 마지막 페이지 가 비어 있을 가능성 (overflow break). UX 사소 — v2 cleanup.
- **PDF style 추가**: 기존 styles 객체와 충돌 없는지 — 신규 키만 추가 (lampiranTitle/Subtitle/tableRow/Header/Total/colNo/Faktur/Date/Npwp/Counterparty/Amount).
