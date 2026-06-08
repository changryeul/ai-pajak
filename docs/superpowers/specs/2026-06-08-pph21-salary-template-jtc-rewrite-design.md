# PPh21 Salary Template — JTC 24-column xlsx 전면 도입

- **Date**: 2026-06-08
- **Status**: Approved — full rewrite per JTC template `1. (JAKARTA TAX CONSULTING)_TEMPLATE-SALARY_One Sheet.xlsx`
- **Replaces**: 기존 CSV 6-column simple bulk calculator

## 1. Context

JTC 가 새 표준 salary 템플릿 제공 (xlsx, PEGAWAI TETAP 시트). 기존 simple CSV (`name,npwp,ptkp,gross_salary,jht,jp`) 를 buritan 한 24-column xlsx 로 교체. 모든 employment status (Tetap/Tidak Tetap/Berhenti) + 회사 부담 BPJS 6 항목 + 직원 부담 BPJS 4 항목 + 추가 income/deduction 통합.

## 2. 새 템플릿 컬럼 (24 + 1 null = A:X)

| Col | 헤더 | 의미 |
|---|---|---|
| A | NO. | 행 번호 |
| B | Bentuk ketenagakerjaan | 1=Pegawai Tetap / 2=Tidak Tetap / 3=Berhenti |
| C | NAMA PEGAWAI | 이름 |
| D | JENIS KELAMIN | M / F |
| E | STATUS PAJAK | TK/0, TK/1, TK/2, TK/3, K/0, K/1, K/2, K/3 |
| F | NPWP | 12.345.678.9-123.000 형식 |
| G | TANGGAL MULAI BEKERJA | 입사일 |
| H | GAJI | 기본급 |
| I | TUNJANGAN | 수당 |
| J | BONUS/THR | 보너스 + 종교보너스 |
| K | NATURA | 비현금 fringe benefit |
| L | PINJAMAN GAJI | 직원 대출 |
| M | POTONGAN GAJI | 기타 공제 |
| **PENAMBAH (회사 부담)** | | gross-up — 직원 income 으로 잡힘 (v1: non-taxable 으로 store only) |
| N | BPJS Kesehatan | 4% gaji |
| O | JKK | 0.24% gaji (risk-level) |
| P | JKM | 0.30% gaji |
| Q | JHT | 3.70% gaji |
| R | JP | 2% gaji (cap 적용) |
| S | JKP | 정해진 비율 |
| **PENGURANG (직원 부담)** | | deduction — gross 에서 빼기 |
| T | BPJS Kesehatan | 1% gaji |
| U | JHT | 2% gaji |
| V | JP | 1% gaji |
| W | JKP | 현재 0 (직원 부담 없음) |
| X | (null) | unused |

## 3. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 계산 — NATURA 처리 | **taxable** — PMK 66/2023 따라 gross_income 에 가산 |
| Q2 | 계산 — PENAMBAH (회사 BPJS) | **v1: non-taxable** — store only, gross_income 에 X. 향후 토글로 gross-up 옵션 |
| Q3 | 계산 — PENGURANG (직원 BPJS) | gross_income 에서 deduction. biaya jabatan 도 별도 차감 |
| Q4 | Employment status 2/3 | **v1: 1 (Tetap) 만 정식 계산**. 2/3 은 store + 경고 ("PER-16/2016 룰 별도 트랙") |
| Q5 | PTKP 형식 | **slash 형식 (TK/0, K/1) 정식** + 기존 (TK0, K1) backward compat. 변환은 client/server 양쪽 |
| Q6 | UI | 기존 simple 6-input → 24-column grid (스크롤). xlsx 업로드 우선, manual entry 도 24 컬럼 |
| Q7 | template 파일 | `public/templates/pph21-salary-template-jtc.xlsx` 정적 호스팅. 다운로드 버튼 1-click |

## 4. 계산 로직 (Pegawai Tetap)

```
penghasilan_bruto = GAJI + TUNJANGAN + BONUS_THR + NATURA
                    (v1: PENAMBAH 회사 BPJS 제외)

biaya_jabatan = min(5% × penghasilan_bruto, 6_000_000)   // 연간 cap
iuran_karyawan = PENGURANG.BPJS_Kes + PENGURANG.JHT + PENGURANG.JP + PENGURANG.JKP

penghasilan_neto = penghasilan_bruto - biaya_jabatan - iuran_karyawan
penghasilan_kena_pajak (PKP) = penghasilan_neto - PTKP

PPh21_tahunan = tarif_progresif(PKP)   // 5% / 15% / 25% / 30% / 35% bracket
PPh21_bulanan = PPh21_tahunan / 12
```

PINJAMAN 과 POTONGAN GAJI 는 PPh21 계산에 무관 (net pay 계산용) — store only.

## 5. Code 변경

### 5.1 신규: xlsx parser

`src/lib/tax/bulk-import/pph21-salary-template-parser.ts`:

```ts
export interface JTCSalaryRow {
  no: number;
  employmentStatus: 1 | 2 | 3;
  name: string;
  gender: 'M' | 'F' | null;
  ptkpCategory: string;       // 정규화: 'TK/0', 'K/1' ...
  npwp: string;
  joinDate: string | null;    // ISO YYYY-MM-DD
  gaji: number;
  tunjangan: number;
  bonusThr: number;
  natura: number;
  pinjamanGaji: number;
  potonganGaji: number;
  penambah: {                 // 회사 부담
    bpjsKesehatan: number;
    jkk: number;
    jkm: number;
    jht: number;
    jp: number;
    jkp: number;
  };
  pengurang: {                // 직원 부담
    bpjsKesehatan: number;
    jht: number;
    jp: number;
    jkp: number;
  };
}

export interface ParseJTCSalarySummary {
  rows: JTCSalaryRow[];
  skippedNonTetap: number;    // employmentStatus !== 1 카운트 (v1 store-only)
  skippedInvalid: number;     // PTKP 미지원 / name 없음
  warnings: string[];
}

export function parseJTCSalaryTemplate(buffer: ArrayBuffer): ParseJTCSalarySummary {
  // XLSX.read → 'PEGAWAI TETAP' sheet → sheet_to_json header=1
  // rows.slice(3) (multi-row header 3 줄 skip)
  // 각 row: NO 가 numeric + NAMA 있어야 valid
  // PTKP: TK0 → TK/0 정규화 (slash 추가) — 기존 입력 호환
  // employmentStatus: 1 / 2 / 3 만 허용, 그 외 skip
  // Number parse: comma/Rp 제거 후 parseFloat
}
```

### 5.2 신규 unit tests
`src/lib/tax/bulk-import/__tests__/pph21-salary-template-parser.test.ts` — 12-15 case:
- 24-col header 정확 인식
- PTKP slash/no-slash 모두 정규화
- employment status 1 only / 2 only / mixed
- 빈 row skip
- 금액 parsing (Rp 8,000,000 → 8000000)
- continuation row (NAMA null) skip
- 잘못된 PTKP → skippedInvalid
- 회사/직원 BPJS 분리

### 5.3 신규: 정적 template 파일

`public/templates/pph21-salary-template-jtc.xlsx` — JTC 가 보낸 원본 파일 그대로 복사 (sample row 만 제거, header 3줄 유지).

또는 (대체) 동적 생성:
`src/lib/tax/bulk-import/pph21-salary-template-builder.ts` — XLSX.write() 로 같은 layout 생성. **v1 권장: 정적 파일** (원본 보존, instructions 시트 유지).

### 5.4 endpoint 확장: `POST /api/tax/pph21-bulk`

기존 shape (`employee_name, employee_npwp, ptkp_category, gross_salary, jht_employee, jp_employee`) → 신규 shape:

```ts
interface BulkEmployeeInput {
  employee_name: string;
  employee_npwp?: string;
  employment_status: 1 | 2 | 3;
  ptkp_category: string;            // 'TK/0' 형식 권장, 'TK0' 도 허용
  gender?: 'M' | 'F';
  join_date?: string;
  gaji: number;
  tunjangan?: number;
  bonus_thr?: number;
  natura?: number;
  pinjaman_gaji?: number;
  potongan_gaji?: number;
  penambah?: { bpjs_kesehatan, jkk, jkm, jht, jp, jkp };
  pengurang?: { bpjs_kesehatan, jht, jp, jkp };
}
```

backward compat: 기존 keys (`gross_salary`, `jht_employee`, `jp_employee`) 도 받음 — fallback. 신규 keys 우선.

계산:
- `employment_status === 1` → 새 로직 (4번 섹션)
- `=== 2 || === 3` → 기존 simple 계산 사용 (gross_salary 기반) + warning flag

### 5.5 UI 전면 갱신: `PPh21BulkCalculator.tsx`

- CSV → xlsx 업로드 (XLSX.read on browser)
- 기존 6-input row → 24-column horizontal-scrollable table (또는 expandable card)
- 신규 download 버튼: "JTC Salary Template (xlsx)" — `/templates/pph21-salary-template-jtc.xlsx`
- 신규 컬럼: Employment Status select / Gender / Join Date / Tunjangan / Bonus_THR / Natura / Loan / Potongan / PENAMBAH 6 / PENGURANG 4
- result 표시: 기존 + PENAMBAH/PENGURANG breakdown + warning ("status 2/3 은 v1 에서 simple 계산")

### 5.6 calculator: `pph21-calculator.ts`

기존 함수 backward compat. 신규 옵션 input:

```ts
export interface PPh21AnnualInput {
  // 기존
  ptkpCategory: string;
  grossIncome: number;        // 기존 — gross_salary
  jhtEmployee?: number;
  jpEmployee?: number;
  // 신규 (옵션, employment_status=1 정식 계산)
  jtcDetail?: {
    tunjangan?: number;
    bonusThr?: number;
    natura?: number;
    pengurangBpjsKesehatan?: number;
    pengurangJkp?: number;
  };
}
```

`jtcDetail` 있으면 4번 섹션 계산. 없으면 기존 simple. 기존 호출자 (E-Bupot 등) 변경 0.

## 6. Files

**신규** (5):
- `src/lib/tax/bulk-import/pph21-salary-template-parser.ts`
- `src/lib/tax/bulk-import/__tests__/pph21-salary-template-parser.test.ts`
- `public/templates/pph21-salary-template-jtc.xlsx` (정적, JTC 원본)
- `scripts/verify-pph21-jtc-template-contract.ts`
- `docs/superpowers/specs/2026-06-08-pph21-salary-template-jtc-rewrite-design.md` (this)

**수정** (4):
- `src/lib/tax/pph21-calculator.ts` — `jtcDetail` 옵션 input
- `src/app/api/tax/pph21-bulk/route.ts` — 새 shape + backward compat
- `src/components/tax/PPh21BulkCalculator.tsx` — 전면 갱신 (xlsx + 24 col)
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 신규 키 (~15개)

**마이그레이션**: 0 — DB 변경 없음 (계산기만, 결과는 기존처럼 client/result 만 반환)

## 7. Smoke

`scripts/verify-pph21-jtc-template-contract.ts` — 6 assertion:
1. POST `/api/tax/pph21-bulk` 새 shape (3 employee, status=1, GAJI+TUNJANGAN+NATURA 포함) → 200, PPh21 계산
2. PENGURANG.JHT/JP 가 iuran_karyawan 으로 들어갔는지 (response.deduction_breakdown)
3. biaya_jabatan = min(5% × bruto, 500_000 monthly) 확인
4. Employment status 2 → simple 계산 + warning flag
5. PTKP 'TK/0' 와 'TK0' 모두 받아짐 (backward compat)
6. backward compat: 기존 shape (`gross_salary` only) 도 200

smoke runner +1 (27→28).

## 8. Out of scope (Phase 별도)

- Employment status 2 (Tidak Tetap) — PER-16/2016 daily/casual 계산 룰
- Employment status 3 (Berhenti) — final settlement 계산 + prorate
- PENAMBAH (회사 BPJS) gross-up 토글 (taxable vs non-taxable) — MASTER governance
- JKP 직원 부담 (현재 0% 이지만 미래 변경 대비)
- PINJAMAN/POTONGAN 의 net pay 표시
- 1721-A1 자동 생성 연동
- Salary slip PDF (직원 별)

## 9. Risks

- **PMK 66/2023 NATURA 룰 적용 범위**: 모든 NATURA 가 taxable 은 아님 (식사, 의료, 종교 facility 등 예외). v1 default: 사용자가 NATURA 컬럼에 적은 금액 = 전부 taxable. 사용자가 비과세 항목은 0 으로 적도록 instructions 에 명시.
- **PTKP 변환 일관성**: client 에서 slash → server 에서 normalize. 둘 다 normalize 권장 (double safety). 기존 DB enum 이 어느 형식인지 확인 (TK0 vs TK/0) — pph21-calculator.test.ts grep.
- **xlsx multi-row header 충돌**: 3 row 헤더 가정 fixed. 만약 사용자가 row 0/1/2 를 수정하면 parser 가 실패 (header check). detection 강화: row 0 의 "NO." 와 "NAMA PEGAWAI" 키워드 존재 검증.
- **continuation row** (NAMA null 인 row, employment_status 만 있음): skip — fixture 가 보여주는 패턴 (5 row × 3 status = 15 + 헤더 3 = 18, 실제 24 = 5x3 + tunnels)
- **24 컬럼 모바일**: 가로 스크롤 불편. v1 우선 desktop, 모바일은 v2 (column collapse).
- **계산 정확도**: 사용자 (JTC 대표) 가 직접 검증 필요. spec 의 4번 섹션 공식이 실 사례와 일치하는지 첫 사용 후 피드백.
- **endpoint backward compat**: 기존 caller (E-Bupot 등) 안 깨도록 jhtEmployee/jpEmployee key 도 받음.
- **prod schema drift**: DB 변경 0 — drift CI guard PASS.
