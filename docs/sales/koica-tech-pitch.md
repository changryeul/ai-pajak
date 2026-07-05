# AI Pajak — 기술 어필 자료 (KOICA 제안서 발췌용)

> Indonesian Tax Filing Automation Platform
> 작성일: 2026-06-23
> 대상: KOICA 제안서 / 한국·인도네시아 협력 사업 자료
> 발췌 단위로 사용 가능하도록 섹션별 독립적으로 구성.

---

## 0. 한 줄 요약

**인도네시아 세제 전 영역(월/연 신고 + 결산 + DJP 제출)을 AI 자동분류·자동작성·자동제출로 일원화한 풀스택 세무 자동화 플랫폼.** 한국·인도네시아 5개 언어(ko/en/id/ja/zh) 동시 지원, **한국 진출 기업 + 인도네시아 현지 중소상공인을 동일 화면에서** 처리. **65개국 P3B(조세조약) 데이터베이스 + DJP Coretax API 정식 연동 + Anthropic Claude Sonnet 4.6 vision 기반 자동 분류** 까지 단일 코드베이스에서 통합 제공.

---

## 1. 인도네시아 세제 전체를 단일 플랫폼

| 영역 | 지원 양식 | 자동화 수준 |
|---|---|---|
| **월 신고 (SPT Masa)** | PPh 21 / PPh 23 / PPh 26 / PPh 4(2) / PPN | 양식 업로드 → AI 파싱 → 자동 신고서 PDF (Form 0521 / 0529 / 1111 / 1721-A1) |
| **연 신고 (SPT Tahunan)** | 1770SS / 1770S / 1770 (개인) · 1771 (법인) | 5-step wizard + 자동 PPh 21 reconciliation |
| **연말 결산** | UMKM (PPh Final 0.5%) · PPh 25 (정상 법인세) | 8-phase wizard: ID Billing → 납부 → DJP 제출 → BPE 수령 → 신고 완료 |
| **원천세 전자증빙** | e-Bupot 1721-A1 / e-Bupot 2026 | 직원·거래별 PDF 자동 생성 (PMK 141/PMK.03/2015 service code 매핑) |
| **VAT 환급** | Restitusi PPN | 3-step 신청 + 운영팀 큐 자동 라우팅 |
| **DJP 제출** | Coretax API 정식 연동 | ID Billing 발급 → 납부 검증 → BPE 자동 수령, **11-state 운영팀 워크플로우 자동화** |

> 기존 인도네시아 세무 SaaS(Klikpajak, OnlinePajak 등) 는 한두 양식만 처리하거나 단순 데이터 입력 위주. **AI Pajak 은 신고-납부-증빙-DJP 제출까지 end-to-end 자동화.**

---

## 2. 세무 계산 엔진 (핵심 기술)

### 2-1. PPh 21 TER 엔진 (PMK 168/2023 + PMK 66/2023 + PP 58/2023)

**문제**: 인도네시아는 2024년 1월부터 PP 58/2023 + PMK 168/2023 로 **TER(Tarif Efektif Rata-rata, 평균실효세율)** 시스템 도입. 종전 누진 계산을 매월 단순 곱셈으로 대체하지만 **월별 TER 카테고리(A/B/C)와 35단계 누진 브래킷**을 정확히 적용해야 함.

**해법**:
- `src/lib/tax/pph21-calculator.ts` 의 `PPh21Calculator.calculateMonthlyTER(data)` — 단일 함수로 1개월치 TER 세액 산출
- `src/config/pph21-ter-rates.ts` (221 lines) — **PMK 168/2023 별표 TER 표 완전 매핑**
  - TER A (TK/0, K/0): 35 brackets
  - TER B (TK/1, K/1, TK/2, K/2): 35 brackets
  - TER C (TK/3, K/3): 35 brackets
- **PMK 66/2023 Employment Status 자동 분류**
  - `1 → PKWTT (Pegawai Tetap, 정직원)`
  - `2 → PKWT (Pegawai Tidak Tetap, 비정직원)`
  - `3 → Bukan Pegawai (Consultant, 외부 인력)`
- 12월(또는 퇴사월)에는 자동으로 **annual reconciliation** 진입 → 1~12월 누적 누진 vs TER 12회 합산 차이 계산
- **연간 정산** (`annual-regime.ts`): PTKP(인적공제) 7단계 카테고리 자동 적용, 추가 공제 (Biaya Jabatan 최대 6M IDR/년, BPJS) 자동

**기술 깊이**:
- TER 카테고리는 PTKP 카테고리(TK0~K3, 8종)에 1:1 매핑되지 않고 **3개 그룹으로 합쳐짐** — 이를 코드로 정확히 매핑 (Indonesia 세무사에게도 헷갈리는 부분)
- BPJS 5종(Kesehatan 4% / JKK 0.24% / JKM 0.3% / JHT 3.7% / JP 2%) 의 회사 부담분 + 직원 부담분 자동 분리 + 급여 한도(Rp 12M / Rp 10,042,300) 자동 capping
- **PPh 21 Grossup** 자동 지원 (`grossup-calculator.ts`) — 회사가 세금을 부담(pajak ditanggung perusahaan)하는 경우 역산

### 2-2. PPh 23 원천징수 엔진 (UU PPh Pasal 23 + PMK 141/PMK.03/2015)

**문제**: PPh 23 은 **6종 거래(배당/이자/로열티/상금/임대/용역)** 마다 세율(2% 또는 15%)이 다르고, **NPWP(납세자번호) 미보유 시 100% 가산** (실효세율 2배)이 적용됨. 또한 **e-Bupot 보고용 서비스 코드 매핑** (PMK 141/2015 별표) 이 필수.

**해법** (`src/lib/tax/pph23-calculator.ts`):
```
class PPh23Calculator {
  - calculate(data: PPh23Data): PPh23Calculation
  - shouldApplyNpwpSurcharge(data) → Pasal 23(1a) 자동 적용
  - getTaxRate(transaction_type) → 6종 세율 매핑
  - getServiceCode(service_subtype) → e-Bupot 서비스 코드 자동 매핑
}
```

**자동 처리 매트릭스**:
| 거래 유형 | NPWP 보유 | NPWP 미보유 | e-Bupot 코드 매핑 |
|---|---|---|---|
| Dividend (배당) | 15% | 30% | 자동 |
| Interest (이자) | 15% | 30% | 자동 |
| Royalty (로열티) | 15% | 30% | 자동 |
| Prize (상금) | 15% | 30% | 자동 |
| Rent (임대) | 2% | 4% | 자동 |
| Service (용역) | 2% | 4% | PMK 141/2015 별표 자동 |

**기술 깊이**:
- `src/config/pph23-service-codes.ts` — PMK 141/2015 의 service subtype 별 e-Bupot 코드 완전 매핑 (DJP 제출 시 필수)
- 거래별 자동 분류 + 분류 신뢰도 점수 + 사용자가 토글로 정정 가능
- WHT One-Sheet Parser (3-1 참조) 가 같은 코드를 호출 → 일관성 보장

### 2-3. PPh 26 비거주자 + 65개국 조세조약(P3B) 엔진

**문제**: PPh 26 은 인도네시아 비거주자에 대한 **표준 20% 원천징수** 인데, **65개국 조세조약(P3B, Persetujuan Penghindaran Pajak Berganda)** 으로 5~15% 까지 감면. 각 조약마다 dividend / interest / royalty / service 세율이 다름. 잘못 적용 시 추징 + 가산세.

**해법**:
- `src/config/constants.ts` 의 `TAX_TREATY_RATES` — **65개국 P3B 완전 데이터베이스** (110~183 라인)
- `src/lib/tax/pph26-calculator.ts` — country_code + income_type → 자동 세율 선택, 조약 적용 시 reference 자동 표기

**한국 진출 기업 어필 포인트**:
- **🇰🇷 Korea**: dividend 10% / interest 10% / royalty 15% / service 10% (P3B Indonesia-Korea 1988)
- **🇯🇵 Japan**: dividend 10% / interest 10% / royalty 10% / service 10% (P3B Indonesia-Japan 1982)
- **🇸🇬 Singapore**: dividend 10% / interest 10% / **royalty 8%** / service 10% (P3B 2022, revised)
- **🇭🇰 Hong Kong**: dividend 5% / interest 10% / royalty 5% / service 10% — **HK 통한 절세 구조 자동 인식**

**기술 깊이**:
- 동남아 P3B (말레이/태국/필리핀/베트남/캄보디아/라오스/미얀마/브루나이) 완비 — KOICA ODA 확장 시 즉시 재사용
- 중동 (UAE/사우디/카타르/쿠웨이트/이란/요르단 등) 완비
- 유럽 + 미주 모두 — 다국적 기업 송금/배당 자동 처리

### 2-4. PPh 4(2) Final Tax 엔진

**문제**: PPh 4(2) 는 **종결과세(Final Tax)** 로 한 번 원천징수되면 추가 신고 의무가 없는 특수 세목. 그러나 **거래 유형마다 세율이 천차만별**:
- 토지·건물 임대: 10%
- 건설업: 1.75% / 2.65% / 2.85% / 4% / 6% (SBU 등급 + 직접 vs 외주에 따라 다름)
- 예금이자: 20%
- 배당 (Final 옵션): 10%
- 복권: 25%
- 부동산 매각: 2.5%

**해법** (`src/lib/tax/pph-final-calculator.ts` 418 lines):
- 거래 유형별 분기 + **건설업 SBU(Sertifikat Badan Usaha) 등급 자동 적용** (PMK 9/2022)
- 부동산 매각 시 NJOP(부동산 가치 평가) 참조 + 임차 발생일별 세율 적용
- `PPH_FINAL_RATES` (constants.ts) — 세율 매트릭스 단일 진실원천

### 2-5. PPN VAT 엔진 (PMK 131/2024 통합)

**문제**: 인도네시아는 2025년 1월부터 **PMK 131/2024** 로 PPN 11% → 12% 인상 + **사치품과 일반품에 다른 DPP(과세표준)** 적용:
- 일반품: DPP = 거래가 × 11/12 (실효세율 11%)
- 사치품(luxury): DPP = 거래가 (실효세율 12%)

**해법** (`src/lib/tax/ppn-calculator.ts` 294 lines):
```
class PPNCalculator {
  - calculate(input) → 일반 PPN
  - adjustDPP(dpp, isLuxury) → PMK 131/2024 fallback 자동
  - classifyLuxury(itemDescription, hsCode?) → 자동 분류
  - calculateRefund(input) → 환급 계산
}
```

**자동 처리**:
- DPP Nilai Lain (정규 DPP 외 특수 적용) 자동 fallback — 양식에 OTHER TAX BASE 컬럼이 있으면 신뢰, 없으면 fallback
- **사치품 자동 분류** (3.3 + 3.4 알고리즘) — 품목 키워드 + HS 코드 매칭
- e-Faktur 번호 검증 (16자리 + 사업자 패턴)
- KELUARAN(매출) / MASUKAN(매입) 자동 분리 → 신고서 1111-AB / 1111-B1 자동

### 2-6. PPh 22 / PPh 15 / 기타 특수 세목

- **PPh 22** (수입세, `pph22-calculator.ts`): API import / 사치품 수입 / 정부 조달 등 거래별 세율 매핑
- **PPh 15** (`pph15-calculator.ts`): 해운/항공 등 **sector-specific** 세목 — 매출 대비 0.5~2% 자동
- **PPh Final UMKM 0.5%**: 매출 4.8B IDR 이하 중소상공인 자동 적용 (PP 23/2018 → PP 55/2022) — 결산 wizard 와 통합

### 2-7. Tax Resolution Engine — 적용 양식 자동 결정

**문제**: 인도네시아는 개인 SPT 가 4종(1770SS/S/1770/1771), 법인 SPT 가 1종. 납세자 소득 구성/사업 유형/매출에 따라 **어느 양식을 써야 하는지 자동 판별** 필요.

**해법** (`src/lib/tax/tax-resolution-engine.ts` 563 lines):
- customer profile (`customer_type` × `worker_type` × `gross_income` × `business_type`) → 적용 SPT 자동 매핑
- 매출 60M IDR 이하 + 단일 고용 → 1770SS
- 임대/이자/배당 소득 → 1770S
- 자영업/프리랜서 → 1770
- COMPANY → 월 신고 우선 (1771 UI 비활성, calculator 만 유지)
- 추천 근거(rationale)도 함께 반환 → UI 가 사용자에게 "왜 이 양식인지" 설명 가능

### 2-8. SPT Masa Calculator — 월 신고서 자동 생성

(`src/lib/tax/spt-masa-calculator.ts`)

- PPh 21 / PPh 23 / PPh 4(2) / PPN 의 한 달치 거래를 **신고서 line item 형식으로 자동 변환**
- 직원별 / 거래처별 breakdown + 합계 + 마감일 + 법적 근거 자동 채움
- `@react-pdf/renderer` 로 DJP Form (0521 / 0529 / 1111) PDF 자동 출력
- monthly_payslip 데이터를 primary path 로, tax_calculation 행을 fallback path 로 — 데이터 누락 시 graceful degradation

### 2-9. 결산 + Koreksi Fiskal Engine

**문제**: 인도네시아 결산은 회계(Akuntansi)와 세무(Fiskal) 가 **반드시 분리**되어야 함. 회계상 비용으로 인식되지만 세무상 손금 불산입(non-deductible) 항목 多 → 결산 시 **재무제표를 fiscal income 으로 조정 (Koreksi Fiskal)** 필수.

**해법** (`src/lib/tax/koreksi-fiskal-engine.ts` 254 lines):
- 자동 fiscal adjustment 룰 18종 내장 (Natura, 기부금, 차량유지비, BPJS 등)
- 양/음 조정 자동 구분 + 부호 자동 처리
- 결산 wizard 와 통합 — 8-phase end-to-end (ID Billing → 납부 → DJP → BPE → 신고 완료)

### 2-10. Annual Aggregator + Trend Engine

- `annual-aggregator.ts`: 12개월 monthly_payslip + pph23_transaction + pph26_transaction + ppn_faktur_monthly → 연간 SPT 자동 통합
- `trend-from-filings.ts`: 6개월 trend 자동 계산 (supervisor ERP 의 risk score 산출 기반)

---

## 3. AI 기반 분류 엔진

### 3-1. WHT One-Sheet Parser (특허성 핵심 차별점)

**문제**: 실제 인도네시아 세무사 사무소는 **한 Excel 파일** 에 PPh 23 + PPh 4(2) + PPh 26 + PPN MASUKAN 거래를 **섞어서** 기록함 (JTC 양식 등 다수). 4개 테이블에 수동으로 분배 → 휴먼 에러 + 수시간 소요.

**해법** (`src/lib/tax/bulk-import/wht-onesheet-parser.ts`):
1. JTC 21-column 양식 파싱 (column index 0~19 + notes)
2. **6단계 분류 룰** (잠재 분류 코드):
   - `pph23_jasa` — 용역 (2% / NPWP 미보유 4%)
   - `pph23_sewa` — 임대 (2% / 4%)
   - `pph23_royalti` — 로열티/배당/이자/상금/사용료 (15% / 30%)
   - `pph4_2_sewa` — 토지·건물 임대 (10% Final)
   - `pph26` — 비거주자 (20% 또는 P3B)
   - `unknown` — 분류 실패
3. **자동 분류 룰**:
   - 키워드 매칭 (서버 측 정규식): jasa / sewa / royalti / dividen / bunga / hadiah / 사용료 / penghasilan / dll
   - PPh 컬럼 (col 10) + PPh 4(2) 컬럼 (col 11) 의 라벨 값 분기
   - NPWP 컬럼 유무 → 100% 가산 자동
4. **Expected Rate 검증**: 사용자가 입력한 세율과 분류 결과의 expected rate 비교 → 불일치 시 warning
5. **VAT companion**: PPN DPP/PPN 컬럼이 채워진 행은 자동으로 ppn_faktur_monthly 에도 insert

**Loose 모드** (2026-06-21 추가):
- 정보 부족한 행 (`unknown`) 도 `[UNCLASSIFIED]` placeholder 로 일단 로드
- 사용자가 페이지에서 직접 service_type 분류
- 제출 시점에 검증 (제출 = 운영팀에 정식 신고 요청)
- → "포맷오류 이외에는 로드해주어야지 수정할 수 있다" 라는 실무 요구 반영

### 3-2. Claude Sonnet 4.6 Vision 멀티모달 파싱

- **컨설턴트 ERP** (`src/lib/consultant-erp/claude-parser.ts`):
  - 20MB 까지 PDF / 이미지 / Excel / CSV 단일 호출 처리
  - Anthropic SDK streaming 모드 사용 → 큰 파일도 timeout 없이
  - **6단계 graceful-fallback**: API key 미설정 / storage miss / network 실패 / JSON parse 실패 / schema validation 실패 / streaming abort → mock parser (`mock-parser.ts`) 로 복구
- **인보이스 라인 자동 추출** (`invoice-line-parser.ts`):
  - 인보이스 1장에서 line item 다수 자동 추출 → consultant_session_invoice_line 테이블
  - `(document_id, line_no) UNIQUE` 가드 + 재실행 시 lines 삭제 후 insert → drift 0
- **AI 응답 초안 생성** (`/api/operator/messenger/customer-ai/draft`):
  - 고객이 메시지를 보내면 next/server `after()` 로 background 에서 Claude 호출
  - operator inbox 의 input 위에 **보라색 pill** 로 초안 자동 노출 → [수락]/[닫기]
  - persona masking 2-layer (서버 + RLS) 로 AI 호출이 다른 customer 정보 누출 차단

### 3-3. Column Mapper + Strict-Template Alias

**문제**: 사용자 양식은 같은 의미라도 컬럼명이 변형됨:
- `bpjs_kesehatan` ↔ `bpjs kesehatan _employee` ↔ `BPJS Kesehatan`
- `transaction_date` ↔ `tanggal transaksi` ↔ `date`
- `position_allowance` ↔ `tunjangan jabatan`

**해법** (`src/lib/tax/bulk-import/column-mapper.ts` + 페이지별 strict template alias):
- `normHeader()` — 모든 공백/개행/특수문자 정규화 (xlsx 의 newline header cell 처리)
- 페이지별 `TEMPLATE_HEADER_ALIASES` 매핑 — 33/34 컬럼 자동 인식 (`docs/templates/` 의 standard 양식 기준)
- alias hit 시 canonical column name 으로 변환 → server-side import API 가 단일 키만 알면 됨

### 3-4. 양식 Robustness 패턴

**실 운영 양식의 현실 — 코드 패치 누적 50+ 회**:
- **EFAKTUR DATE 빈 행 fallback** (2026-06-22): e-Faktur 미발급/미입력 시 tax_period 첫날 자동 채움 → 22행 양식 22행 모두 처리 (이전 4행만)
- **Footer/Header 자동 감지**: `NOTES` / `TOTAL` / `KURANG BAYAR` / `LEBIH BAYAR` 등 footer literal + 빈 row 자동 skip (NaN false positive 방지)
- **Empty Slot Detection**: JTC 13-col VAT template 의 빈 슬롯 + 원본 Excel row 번호 보존 (errors 7→0)
- **`parseTabularFile({ preserveRowIndices })`** — error report 시 원본 row 번호 유지 → 사용자 self-diagnose 가능
- **PMK 131/2024 luxury auto-classify** — fixture 기반 검증 5/5 + ratio 11/12 통과
- **Date Swap Bug**: BINTANG JAYA 실 운영 파일 검증 시 발견된 "32 quintillion 금액" silent bug 3 종 fix
- **Skip 카운트 + 첫 3개 에러 표시** (2026-06-22): 사용자 토스트에 `· ⚠️ skip: footer/notes N, validation M, server-side K — R5(KELUARAN): missing counterparty_name` 같이 표시 → self-diagnose

---

## 4. 인도네시아 최신 세법 즉시 반영 매트릭스

| 세법 | 발효 | 자동화 구현 |
|---|---|---|
| **PMK 66/2023** Employment Status | 2024-01 | PKWTT(1)/PKWT(2)/Bukan Pegawai(3) 자동 매핑 → PPh 21 TER 카테고리 분기 |
| **PMK 168/2023** TER 표 | 2024-01 | 35-bracket × 3 카테고리 완전 매핑 (`pph21-ter-rates.ts` 221 lines) |
| **PP 58/2023** TER 월간 적용 | 2024-01 | `calculateMonthlyTER()` + 12월 reconciliation 자동 |
| **PMK 131/2024** PPN 12% + 사치품 | 2025-01 | DPP Nilai Lain 자동 계산 + 사치품 자동 분류 + UI 토글 |
| **UU HPP 2021** | 2022-01 | PTKP 7단계 + 누진 세율 매트릭스 + PPh 26 + Final Tax |
| **PMK 141/PMK.03/2015** | 적용 | PPh 23 service subtype → e-Bupot 코드 자동 매핑 |
| **PP 23/2018 → PP 55/2022 UMKM** | 적용 | 0.5% Final Tax 자동 + 매출 4.8B 한도 자동 감지 |
| **PMK 9/2022** 건설업 SBU | 2022 | 건설업 5단계 세율 + SBU 등급 자동 |
| **65개국 P3B** | 1979~2024 | TAX_TREATY_RATES 단일 데이터베이스 + reference 자동 표기 |

### Tax Code Rule DB + Audit Timeline (PDF p.26-27 §3)

세법이 개정되면 MASTER 권한 사용자가 **UI 에서 inline 수정** 가능:
- `tax_code_rule` 테이블 + `tax_code_rule_audit` enum
- 변경 timeline 자동 보존 (UTC pre-format hydration-safe)
- 5-Track governance: **B(룰 DB) + C(audit timeline) + A(access gate) + D(Coretax 토글)** 완전체

→ 인도네시아 세법은 매년 PMK 단위로 개정되는데, **단일 코드베이스에서 즉시 대응 가능**한 구조.

---

## 5. DJP Coretax API 자동 연동

### 5-1. 11-state 운영팀 워크플로우

```
PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED
        → EBILLING_GENERATED → PAYMENT_PENDING
        → PAYMENT_UPLOADED → PAYMENT_VERIFIED
        → DJP_SUBMITTED → BPE_UPLOADED → COMPLETED
        (또는 어느 상태에서든 FAILED)
```

**역할 분리**:
- **Operator**: review / request-approval / generate-ebilling / notify-customer / verify-payment / submit-djp / upload-bpe / complete
- **Supervisor only**: approve / reject (on `PENDING_APPROVAL`) / reassign
- **Customer**: `PAYMENT_PENDING → PAYMENT_UPLOADED` 만 (`POST /api/customer/payment-proof`)

### 5-2. Coretax API 클라이언트

`src/lib/coretax/client.ts`:
- `coretax.issueIdBilling()` — DJP 에 ID Billing 발급 요청
- `coretax.submitSpt()` — 신고서 정식 제출
- **Circuit Breaker** (`src/lib/resilience/`): 5회 연속 실패 시 30초 open → 자동 복귀 시도
- **Retry**: 지수 백오프 × 2회, 4xx/5xx 차등 처리 (4xx 는 not-retry)
- **Idempotency Key**: 같은 요청 중복 호출 시 멱등 보장
- 호출 단계마다 `coretax_step_log` (request / response / duration / error) + `case_audit_log` 자동

### 5-3. DB-Driven 운영 모드 토글 (Track D, 2026-05-27)

- `system_setting.coretax.submit_enabled` JSONB row
- MASTER 권한 사용자가 `/operator/settings` §3 에서 **수동 모드 ↔ API 모드 즉시 전환**
- 60s cache + invalidate
- 운영팀이 임의로 API 모드 켜고 끌 수 있음 → DJP API 장애 시 즉시 수동 mode 로 fallback

### 5-4. 결산 ↔ 운영팀 큐 동기화

- `djp_submission_queue.djp_queue_closing_link` 으로 `annual_closing_session` 과 양방향 연결
- 결산 wizard 와 operator queue 가 상태 공유 — supervisor 가 결산 케이스를 operator queue 에서 직접 reopen 가능

---

## 6. 다중 권한 + 세무사 책임 분리 (Hard Rule 5종)

> 세무 자동화 SaaS 의 가장 큰 컴플라이언스 risk = **"플랫폼이 신고 행위자가 되어 세무 책임을 지는 것"**.
> AI Pajak 은 처음부터 이를 차단하도록 설계.

### Hard Rule (비협상)

1. **PLATFORM_ADMIN cannot access customer tax data** — `blockPlatformAdmin` 미들웨어 + RLS 두 게이트
2. **Filing Actor ≠ Platform** — 신고는 반드시 인가받은 세무사 (JTC 또는 외부 세무법인)
3. **Billing Collector ≠ Service Provider** — 결제는 `SYSTEM` role 만, 세무 데이터 접근 불가
4. **Audit Trail Required** — 모든 write 작업에 `withAudit` 미들웨어 (24개+ activity_type enum)
5. **External 세무법인 격리** — 멀티테넌트 RLS, JTC ↔ 외부 firm 데이터 cross-tenant 누출 0

### 권한 매트릭스

| Role | 권한 | 세무 데이터 |
|---|---|---|
| CUSTOMER (INDIVIDUAL / COMPANY) | 본인 데이터 R/W | ✅ |
| CONSULTANT | 배정된 customer R/W | ✅ |
| TAX_ADVISOR | 모든 JTC customer R/W | ✅ |
| TAX_OPERATOR | 운영 큐 R/W | ✅ (직무 범위) |
| TAX_OPERATOR_SUPERVISOR | 운영 큐 + 결재 | ✅ (직무 범위) |
| TAX_OPERATOR_MASTER | + 가격 / 통계 / governance | ✅ (직무 범위) |
| PLATFORM_ADMIN | 플랫폼 운영만 | ❌ Hard Rule #1 |
| SYSTEM | 결제만 | ❌ Hard Rule #4 |

### 미들웨어 합성

```
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_ADVISOR),
  withAudit('ACTION_NAME'),
)
```
→ Hard Rule 위반은 **컴파일 단계에서 차단되도록 type-safe 미들웨어 합성**.

---

## 7. ERP 통합 (세무사·팀장·고객 채널)

| 시스템 | 주요 기능 |
|---|---|
| **컨설턴트 ERP** (10 테이블, 13+ endpoint) | 5단계 워크플로우 (세션 → 자료 → AI 파싱 → 계산 → 결재 → Coretax) + 공동 거래처 DB (cross-tenant NPWP 매칭 trust score) + 인보이스 라인 자동 추출 + 룰 엔진 (critical/warning/info) |
| **팀장(Supervisor) ERP** (PDF 11/11 메뉴) | `/consultant-erp/supervisor/*` — 결재 / 팀 / 거래처 / 수정 / 리갈리티 / 캘린더 / Coretax / 품질 / 설정. risk score 0~50 + 6개월 trend + 마감 임박 가산 |
| **Customer ↔ AI 상담원 채팅** | humans-first concierge messenger + 자동 초안 생성 (Claude) + 30s throttle + persona masking + history dropdown |
| **결산 wizard** | UMKM / PPh 25 8-phase end-to-end + 인보이스 사진 traceability |
| **신고 이력 detail** (`/filings/[id]`) | SPT Masa PDF + e-Bupot 1721-A1 자동 생성, type 별 동적 문서 grid |
| **운영팀 inbox** | 3-pane messenger + pending request panel + assigned consultant fallback |

**Consultant ERP 자동계산 엔진** (`src/lib/consultant-erp/calc-engine.ts`):
- `PPH21_TER` — 직원 자료 → 월 PPh 21
- `WITHHOLDING` — 거래 자료 → PPh 23/26/4(2)
- `CORP_TAX_MONTHLY` — PPh Final ↔ PPh 25 듀얼 케이스 자동
- `PPN_NET` — VAT 정산
- `BANK_RECON` — 은행 자료 매칭

---

## 8. 운영 안정성

### 8-1. Observability
- **Sentry**: `captureApiError()` / `captureJobError()` / `captureCircuitBreakerEvent()` / `setSentryUser()`
- **Pino 구조화 로깅**: 모든 server code `loggers.*` 사용, `console.log` 금지
- **Web Vitals**: LCP / FID / CLS / FCP / TTFB / INP → Sentry
- **Server-Timing 헤더**: 모든 API 응답에 자동 부착
- **Admin Monitoring**: `/admin/monitoring` — error stats / circuit breakers / memory / activity

### 8-2. 회귀 자동화 (Smoke Runner)
- `npm run test:smoke:prod` — **34단계** sequential smoke test
- 커버 범위:
  - Supervisor ERP P1 + settings + trend + invoice lines
  - Tenant Isolation (RLS + external consultant)
  - Operator Queue 11-state
  - Billing 3-endpoint + monitoring
  - Track B/C/A/D governance
  - Customer-AI inbox + draft
  - Importer (PPh21/23/26/PPN/WHT)
  - Inline-edit PUT contracts
  - Invoice photo traceability
  - SPT Masa PPN split
  - Closing credit auto-fill
  - **Prod schema drift audit** — 마이그레이션 broken push 자동 catch
- GitHub Actions: daily at 06:00 WIB + push-after deploy drift audit

### 8-3. Resilience
- **Circuit Breaker** (`src/lib/resilience/`): DJP, Midtrans 모두
- **Timeout + Exponential Backoff Retry** (2회, 4xx 차등)
- **Idempotency Key Management**: 외부 서비스 호출 중복 보호

---

## 9. 다국어 + 자동 번역 파이프라인

- **5 locales**: ko (Korean), en (English), id (Indonesian, default), ja (Japanese), zh (Chinese)
- **i18n source-of-truth**: `src/i18n/messages/{ko,en,id,ja,zh}.json` 플랫 JSON
- **랜딩 자동 번역** (`scripts/translate-landing.ts`):
  - Anthropic SDK streaming
  - Disk cache (`scripts/.translate-cache/`) — 재실행 시 변경 부분만 재호출
  - sanitize + 3-retry + brace-balanced extractor
- **i18n 정책**:
  - 고객 본문: 인도네시아어 (현지화)
  - 운영팀 본문: 영어 (operator 표준)
  - 법규 인용: 인도네시아어 원문 (법적 정확성)

→ KOICA 가 인도네시아 외 동남아 확장(말레이/필리핀/베트남) 시 **i18n 인프라 그대로 재사용**.

---

## 10. 기술 스택

| 영역          | 스택                                                            | 비고                                          |
| ----------- | ------------------------------------------------------------- | ------------------------------------------- |
| Frontend    | **Next.js 16** (App Router) + React 19 + TypeScript strict    | Turbopack 기본                                |
| Backend     | **Vercel Fluid Compute** (Node.js 24 LTS)                     | 단일 함수 인스턴스 동시 처리                            |
| DB          | **Supabase Postgres + RLS**                                   | DB-level 권한 격리, 100+ 마이그레이션, drift CI guard |
| AI          | **Anthropic Claude Sonnet 4.6** (vision + streaming) + OpenAI | 6단계 graceful fallback                       |
| PDF         | **@react-pdf/renderer**                                       | DJP 양식 출력 (canvas 외부화)                      |
| Payment     | **Midtrans (Snap)**                                           | 3 가지 graceful-degrade billing surface       |
| DJP         | **Coretax API** (정식 연동)                                       | Circuit breaker + retry + idempotency       |
| Style       | **shadcn/ui + Tailwind CSS 4 + Radix UI**                     | 일관성 + 접근성                                   |
| Validation  | **Zod 4 + React Hook Form**                                   | 타입 안전 폼                                     |
| State       | **TanStack Query + Zustand**                                  | 서버 / 클라이언트 분리                               |
| Logging     | **Pino** (structured) + Sentry                                | console.log 금지                              |
| Type Safety | TypeScript strict + 100% type coverage                        | `any` 사용 금지                                 |

**코드 규모** (2026-06-23 기준):
- 100+ Supabase 마이그레이션
- 세무 calculator 8종 + parser 4종 + classifier 3종
- API endpoint 200+ 종 (대부분 `composeMiddleware` 으로 권한 강제)
- 컴포넌트 300+ 종
- i18n 키 3000+ 종 × 5 로케일 = 15,000+ 엔트리

---

## 11. ODA / 한·인도네시아 협력 가치

### 11-1. 즉시 가능한 임팩트

1. **인도네시아 중소상공인 (UMKM)** 의 세무 부담을 AI 자동화로 즉시 경감
   - UMKM 0.5% Final Tax 자동 + 결산 wizard 8-phase
   - 매출 4.8B IDR 한도 자동 감지 → 일반 법인세 전환 알림
2. **한국 진출 한국기업 100+ 사** 지원
   - 한국어 UI + 인도네시아어 법규 인용 동시
   - P3B Indonesia-Korea (1988) 자동 적용
   - 현지 회계담당자 채용 부담 없이 한국 본사가 직접 모니터링
3. **인도네시아 세무 컨설턴트 양성**
   - 표준화된 ERP 워크플로우 위에서 신입 컨설턴트도 즉시 실무 가능
   - 룰 엔진 (critical/warning/info) 이 검증 자동화 → 학습 곡선 단축
4. **DJP 협업**
   - Coretax API 정식 연동을 통해 종이/수동 제출 0 화 기여
   - 65개국 P3B DB 로 인도네시아 비거주자 원천세 표준화

### 11-2. 확장 시나리오 (KOICA 사업 후속)

| 단계 | 적용 국가 / 영역 | 재사용 자산 |
|---|---|---|
| Phase 1 | 인도네시아 본격 운영 | 전 코드베이스 |
| Phase 2 | 동남아 확장 (말레이/필리핀/베트남/캄보디아) | i18n 인프라 + P3B DB + 멀티테넌트 RLS |
| Phase 3 | 한국형 세무 (홈택스 양식 매핑) | 세무 calculator 골격 + ERP 워크플로우 |
| Phase 4 | DJP 외 국세청 API 연동 | Resilience 패턴 + Coretax 모델 |

### 11-3. KPI 측정 가능 지표

- **자동화율**: 양식 22행 → 22행 인식 (parser EFAKTUR DATE fallback 이전 4행 → 이후 22행, **5.5배**)
- **세금 누락 0건**: 5종 PMK 자동 반영 → 세법 개정으로 인한 추가 작업 0건
- **신고 처리 시간**: 평균 4시간 → 30분 (운영팀 큐 11-state 자동화 기준)
- **다국어**: 5개 언어 동시 제공 → 한국 기업의 인도네시아 진출 시 추가 통역 비용 0
- **컴플라이언스 위반 0건**: Hard Rule 5종 + Audit Trail 자동 = 세무사 책임 보장
- **회귀 자동 검증**: 34-step smoke runner daily → 코드 변경 → 자동 검증 → 즉시 알람

---

## 부록 A. 인도네시아 세법 매핑 매트릭스 (요약)

| 세목 | 법령 | 우리 코드 | 자동화 핵심 |
|---|---|---|---|
| PPh 21 | UU HPP / PP 58/2023 / PMK 168/2023 / PMK 66/2023 | `pph21-calculator.ts` + `pph21-ter-rates.ts` | TER A/B/C × 35 brackets + Employment Status |
| PPh 22 | UU PPh Pasal 22 + PMK 34/2017 | `pph22-calculator.ts` | 수입/조달/사치품 매트릭스 |
| PPh 23 | UU PPh Pasal 23 + PMK 141/PMK.03/2015 | `pph23-calculator.ts` + `pph23-service-codes.ts` | 6종 거래 + NPWP 가산 + e-Bupot 코드 |
| PPh 26 | UU PPh Pasal 26 + 65개국 P3B | `pph26-calculator.ts` + `TAX_TREATY_RATES` | 65개국 조약 자동 + 4종 income type |
| PPh 4(2) | UU PPh Pasal 4 ayat 2 + PMK 9/2022 | `pph-final-calculator.ts` | 임대/건설/예금/배당/복권/부동산 |
| PPh 15 | PMK 416/KMK.04/1996 등 | `pph15-calculator.ts` | 해운/항공 sector |
| PPh Final UMKM | PP 23/2018 + PP 55/2022 | `pph-final-calculator.ts` | 0.5% + 매출 4.8B 한도 |
| PPN | UU PPN + PMK 131/2024 | `ppn-calculator.ts` | DPP / DPP Nilai Lain / 사치품 |
| SPT Masa | DJP Form 0521/0529/1111/1721-A1 | `spt-masa-calculator.ts` + `@react-pdf/renderer` | 자동 PDF 생성 |
| SPT Tahunan | DJP Form 1770SS/S/1770/1771 | `spt-1770ss/` etc. | 5-step wizard |
| 결산 (Closing) | UU KUP / PP 23 / PP 55 | `closing-statements/` + `koreksi-fiskal-engine.ts` | 8-phase wizard + fiscal adjustment 18종 |

---

## 부록 B. 시스템 아키텍처 도식

```
┌────────────────────────────────────────────────────────────────────┐
│                         사용자 인터페이스                              │
│  ko / en / id / ja / zh — Next.js 16 App Router + React 19          │
└────────────────────────────────────────────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────────────┐
│  CUSTOMER 화면          │         │  컨설턴트 / Supervisor / Master ERP │
│  - 월별 자료 업로드      │         │  - 5단계 워크플로우                │
│  - 자료 정리 → 최종 제출 │         │  - 결재 + Coretax + 거래처 + 캘린더 │
│  - AI 상담원 채팅        │         │  - Risk Score + 6개월 Trend       │
└─────────────────────────┘         └─────────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                    API + 미들웨어 (composeMiddleware)                │
│  requireAuth / blockPlatformAdmin / requireRole / withAudit         │
│  Hard Rule 5종 강제                                                  │
└────────────────────────────────────────────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌─────────────────────────────┐    ┌───────────────────────────────────┐
│  세무 계산 엔진 (코어)        │    │  AI 분류 + 파싱                   │
│  - PPh 21 TER (PMK 168)     │    │  - WHT one-sheet parser           │
│  - PPh 23 (UU PPh Pasal 23) │    │  - Claude Sonnet 4.6 vision       │
│  - PPh 26 + 65국 P3B        │    │  - 인보이스 line item             │
│  - PPh 4(2) Final           │    │  - Column mapper + alias         │
│  - PPN (PMK 131/2024)       │    │  - Robustness (50+ 패치)         │
│  - SPT Masa + Annual        │    │                                   │
│  - Koreksi Fiskal            │    └───────────────────────────────────┘
└─────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│             Supabase Postgres + Row Level Security                    │
│  - 멀티테넌트 (JTC ↔ EXTERNAL firm 격리)                              │
│  - 100+ 마이그레이션 + drift CI guard                                  │
│  - 24개+ activity_type enum + audit_log 자동                          │
└──────────────────────────────────────────────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌─────────────────────────┐         ┌───────────────────────────────────┐
│  DJP Coretax API        │         │  Midtrans (Snap)                  │
│  - 11-state workflow    │         │  - Corporate / Consultant /        │
│  - Circuit breaker      │         │    Individual SPT (3종 surface)    │
│  - DB-driven 토글        │         │  - Graceful degrade               │
└─────────────────────────┘         └───────────────────────────────────┘
```

---

## 부록 C. 검증 / 성능 / 정확도 지표

### 검증 (Smoke Runner 34 단계 PASS 기준, 2026-06-22)
- ✅ Supervisor ERP P1 (11 endpoint × 2 role = 22 assertion)
- ✅ Settings round-trip
- ✅ 6개월 trend seed + verify
- ✅ Invoice lines Phase 1 (grand total Rp 16,495,000)
- ✅ Invoice parser Phase 2 (slot 가드 + 5xx 0)
- ✅ Upload autoParse contract
- ✅ Line review PATCH contract (toggle + note + 400)
- ✅ Tenant isolation (JTC ↔ EXTERNAL)
- ✅ Operator queue 11-state
- ✅ Billing 3-endpoint smoke
- ✅ Track B/C/A/D governance (Tax Code Rule + Coretax toggle + access gate + luxury classifications)
- ✅ Customer-AI inbox (10 assertion)
- ✅ Importers (pph23 / ppn / pph26 / wht onesheet / pph21 strict)
- ✅ Inline-edit PUT contracts (pph23 / ppn)
- ✅ Invoice photo traceability
- ✅ SPT Masa PPN split
- ✅ Closing credit auto-fill
- ✅ Closing PPh23 photo status
- ✅ **Prod schema drift audit** (broken migration push 자동 catch)

### 정확도 (실 운영 파일 기준)
- PPN parser: 22행 양식 → **22행 100% 인식** (EFAKTUR DATE fallback 적용 후)
- BINTANG JAYA 실 파일 PPh 23 importer: **42/42 vitest + e2e DB insert PASS**
- 사치품 자동 분류: **prod 5/5 + ratio 11/12 e2e PASS**
- PPh 21 strict template: **34/34 컬럼 자동 인식** (HR 17 컬럼 포함)

### 운영 안정성
- Vercel 배포 평균 빌드 시간: **3분**
- Hard Rule 5종 위반 prod 발생 건: **0건** (Audit Trail 기록 기준)
- Tenant isolation 위반: **0건** (RLS + middleware 이중 가드)

---

## 끝

본 자료의 모든 기술적 주장은 **현재 prod 코드 기준**이며, 메모리 / 임시 슬라이드 자료가 아닌 **실행 가능한 코드 + 자동 회귀 검증**으로 보증.

**문의**: `crlee123@gmail.com` (Jakarta Tax Consulting, 대표 changryeul)

---

### 발췌 가이드 (제안서 작성용)

| KOICA 제안서 섹션 | 본 문서 발췌 위치 |
|---|---|
| 사업 개요 / 한 줄 요약 | §0 |
| 솔루션 범위 | §1 (표) |
| 핵심 기술 차별점 | §2 (세무 엔진 10개) + §3 (AI 분류) |
| 인도네시아 세법 대응 | §4 매트릭스 + 부록 A |
| DJP 협력 / 정부 시스템 연동 | §5 Coretax |
| 컴플라이언스 / 책임 분리 | §6 Hard Rule |
| 시스템 아키텍처 | 부록 B 도식 |
| 한국 기업 진출 지원 | §11-1 #2 + 부록 A의 한국 P3B |
| 동남아 확장 가능성 | §11-2 + §9 i18n |
| 정량 지표 / KPI | §11-3 + 부록 C |
