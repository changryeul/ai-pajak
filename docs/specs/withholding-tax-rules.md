# 인도네시아 원천세 세율 규칙 정리

> 최종 업데이트: 2026-04-03
> 목적: 월 신고(SPT Masa) 프로세스 구현을 위한 세율 규칙 기준 문서

---

## 1. 현행 구현 현황 vs 필요 사항

### 구현 완료

| 항목 | 파일 | 상태 |
|------|------|------|
| PPh 21 누진세율 (Pasal 17) | `pph21-calculator.ts` | O |
| PPh 23 기본 6종 (dividend/interest/royalty/prize/rent/service) | `pph23-calculator.ts` | O |
| PPh 22 수입/거래별 10종 | `pph22-calculator.ts` | O |
| PPh 26 표준 20% + 18개국 DTA 조약세율 | `pph26-calculator.ts` | O |
| PPh Final UMKM 0.5% | `pph-final-calculator.ts` | O |
| PPh Final Pasal 4(2) 4종 (rental/construction/ship/aircraft) | `pph-final-calculator.ts` | O |
| NPWP 미보유 가중(2배) 규칙 | 각 calculator | O |
| KLU/KBLI 코드 → PPh 23 세율 매핑 | `klu_codes` 테이블 | O (약 80개) |
| KLU → PPh Final 면제 여부 | `klu_codes` 테이블 | O |
| tax_rate_config (관리자 변경 가능) | DB 테이블 | O |

### 미구현 / 보완 필요 (GAP)

| 항목 | 현황 | 필요 사항 | 우선순위 |
|------|------|-----------|----------|
| **PPh 4(2) 건설 SBU 등급별 세율** | 일률 4% | PP 9/2022 기준 1.75%~6% 세분화 | **높음** |
| **PPh 23 jasa lain 62종 세부 분류** | service=2% 단일 | PMK 141/2015 기준 62종 서비스 매핑 | **높음** |
| **PPh 21 TER (월별 유효세율)** | 누진세율만 | PP 58/2023, PMK 168/2023 TER 카테고리 A/B/C | **높음** |
| **PPh 15 특수업종** | 미구현 | 해운 1.2%, 항공 1.8%, 외국 PE 2.64% | 중간 |
| **PPh 26 DTA 국가 확대** | 18개국 | 71개 조약국 전체 | 낮음 |
| **KBLI → 서비스 카테고리 → 세율 결정 체인** | KBLI→PPh23세율 직접 매핑 | KBLI→서비스분류→세조항→세율 (조건부 분기) | **높음** |
| **라이센스/SBU 유형별 분기** | 미구현 | 건설 SBU 등급, 전문직 라이센스 | **높음** |
| **주주구성(오너쉽) 기반 PPh 23 vs 26 분기** | 미구현 | 외국인 지분율 → PPh 26 적용 판단 | 중간 |

---

## 2. PPh 23 — 세부 규칙

### 2.1 기본 세율 (현행 구현)

| 소득 유형 | 세율 | NPWP 미보유 시 | 근거 |
|-----------|------|---------------|------|
| Dividen (배당) | 15% | 30% | Pasal 23(1)(a) UU PPh |
| Bunga (이자) | 15% | 30% | Pasal 23(1)(a) UU PPh |
| Royalti | 15% | 30% | Pasal 23(1)(a) UU PPh |
| Hadiah (상금) | 15% | 30% | Pasal 23(1)(a) UU PPh |
| Sewa (임대, 토지/건물 제외) | 2% | 4% | Pasal 23(1)(c) UU PPh |
| Jasa (용역) | 2% | 4% | Pasal 23(1)(c) UU PPh |

### 2.2 Jasa Lain 62종 (PMK 141/PMK.03/2015) — 보완 필요

현재 `service` 단일 타입으로 처리 중. 아래 서비스를 세분화해야 정확한 세율 적용 및 e-Bupot 신고 가능.

| No | 서비스 유형 (Jasa) | KBLI 예시 | 세율 |
|----|-------------------|-----------|------|
| 1 | Jasa penilaian (감정평가) | 74901 | 2% |
| 2 | Jasa aktuaris (보험수리) | 66290 | 2% |
| 3 | Jasa akuntansi/pembukuan (회계/부기) | 69200 | 2% |
| 4 | Jasa hukum (법률) | 69100 | 2% |
| 5 | Jasa arsitektur (건축설계) | 71101 | 2% |
| 6 | Jasa perencanaan kota/landscape (도시계획) | 71102 | 2% |
| 7 | Jasa desain (디자인) | 74100 | 2% |
| 8 | Jasa pengeboran migas (석유가스 시추) | 06100 | 2% |
| 9 | Jasa pertambangan (광업지원) | 09900 | 2% |
| 10 | Jasa penebangan hutan (벌목) | 02200 | 2% |
| 11 | Jasa pengolahan limbah (폐기물처리) | 38210 | 2% |
| 12 | Jasa penyedia tenaga kerja/outsourcing (인력파견) | 78200 | 2% |
| 13 | Jasa perantara/agen (중개) | 46100 | 2% |
| 14 | Jasa perdagangan efek (증권거래) | 66110 | 2% |
| 15 | Jasa custodian/penyimpanan (보관) | 66190 | 2% |
| 16 | Jasa pengisian suara (더빙) | 59120 | 2% |
| 17 | Jasa mixing film (영화 믹싱) | 59110 | 2% |
| 18 | Jasa sehubungan software komputer (소프트웨어) | 62010 | 2% |
| 19 | Jasa instalasi/pemasangan mesin (기계설치) | 33200 | 2% |
| 20 | Jasa perawatan/pemeliharaan (유지보수) | 33110 | 2% |
| 21 | Jasa penerjemahan (번역) | 74901 | 2% |
| 22 | Jasa freight forwarding (포워딩) | 52291 | 2% |
| 23 | Jasa maklon (임가공) | 10~32 | 2% |
| 24 | Jasa penyelidikan/keamanan (보안) | 80100 | 2% |
| 25 | Jasa event organizer (행사대행) | 82300 | 2% |
| 26 | Jasa pengepakan (포장) | 82920 | 2% |
| 27 | Jasa penyediaan tempat/waktu media (광고매체) | 73110 | 2% |
| 28 | Jasa pembasmian hama (방역) | 81290 | 2% |
| 29 | Jasa kebersihan/cleaning (청소) | 81210 | 2% |
| 30 | Jasa catering (케이터링) | 56210 | 2% |

> **참고**: 62종 전체 목록은 PMK 141/2015 원문 참조. 모두 **2%** 세율이나, e-Bupot 신고 시 서비스 종류 코드를 정확히 기재해야 함.

### 2.3 PPh 23 vs PPh 26 분기 기준 — 신규 구현 필요

```
수취인(recipient) 판단:
  ├─ 국내 거주자 (NPWP 보유) → PPh 23 적용
  ├─ 국내 거주자 (NPWP 미보유) → PPh 23 × 2배 가중
  └─ 비거주자 (외국인/외국법인) → PPh 26 적용
       ├─ DTA 조약국 + CoD 보유 → 조약세율
       └─ DTA 없음 또는 CoD 미보유 → 20%
```

**주주구성(오너쉽)에 따른 분기**:
- 법인 수취인의 외국인 지분율 자체로 PPh 26이 적용되는 것은 아님
- **소득의 수취인이 비거주자인 경우**에만 PPh 26 적용
- 다만, 외국 모회사에 지급하는 배당/이자/로열티 → PPh 26 대상

---

## 3. PPh 4(2) — 건설 서비스 세율 (PP 9/2022)

### 현재 문제점
`pph-final-calculator.ts`에서 건설 = 일률 4%로 처리 중. PP 9/2022에 의해 **SBU 등급별 차등 세율** 적용 필요.

### 3.1 Pekerjaan Konstruksi (건설 시공)

| SBU 등급 | 자격 | 세율 | 비고 |
|----------|------|------|------|
| Kecil (소규모) | SBU Grade 1~4 또는 SKK 개인 | **1.75%** | |
| Menengah/Besar (중/대규모) | SBU Grade 5 이상 | **2.65%** | |
| 자격 없음 | SBU/SKK 미보유 | **4%** | 현행 구현과 동일 |

### 3.2 Jasa Konsultansi Konstruksi (건설 컨설팅/설계)

| 자격 | 세율 |
|------|------|
| SBU 또는 SKK 보유 | **3.5%** |
| SBU/SKK 미보유 | **6%** |

### 3.3 Pekerjaan Konstruksi Terintegrasi (통합 건설)

| 자격 | 세율 |
|------|------|
| SBU 보유 | **2.65%** |
| SBU 미보유 | **4%** |

### 3.4 필요 데이터 모델 변경

```
기존: CONSTRUCTION → 4% (단일)

변경 필요:
  CONSTRUCTION_WORK     + SBU_SMALL    → 1.75%
  CONSTRUCTION_WORK     + SBU_MEDIUM   → 2.65%
  CONSTRUCTION_WORK     + NO_SBU       → 4%
  CONSTRUCTION_CONSULT  + SBU          → 3.5%
  CONSTRUCTION_CONSULT  + NO_SBU       → 6%
  CONSTRUCTION_INTEGR   + SBU          → 2.65%
  CONSTRUCTION_INTEGR   + NO_SBU       → 4%
```

---

## 4. PPh 21 TER — 월별 유효세율 (PP 58/2023)

### 현재 문제점
연간 누진세율(Pasal 17)만 구현. 월 신고 시에는 **TER (Tarif Efektif Rata-rata)** 사용 필요.

### 4.1 TER 카테고리

| 카테고리 | PTKP 상태 | 세율 구간 수 |
|----------|-----------|-------------|
| **A** | TK/0, TK/1, K/0 | 44개 |
| **B** | TK/2, TK/3, K/1, K/2 | 40개 |
| **C** | K/3 | 41개 |
| **일용직** | 전체 | 2개 |

### 4.2 적용 방법

```
1~11월: 월 총소득 × TER 세율 = PPh 21 원천징수액
12월:   연간 정산 (Pasal 17 누진세율 적용) - 1~11월 기납부세액 = 추가 납부/환급
```

### 4.3 TER 카테고리 A 세율 (발췌)

| 월 총소득 (Rp) | TER 세율 |
|----------------|---------|
| ~ 5,400,000 | 0% |
| 5,400,001 ~ 5,650,000 | 0.25% |
| 5,650,001 ~ 5,950,000 | 0.50% |
| 5,950,001 ~ 6,300,000 | 0.75% |
| 6,300,001 ~ 6,750,000 | 1.00% |
| ... | ... |
| 11,600,001 ~ 12,500,000 | 4.00% |
| 15,400,001 ~ 16,400,000 | 6.00% |
| 21,850,001 ~ 23,850,000 | 8.00% |
| 43,000,001 ~ 47,000,000 | 12.00% |
| 100,000,001 ~ 110,000,000 | 20.00% |
| 500,000,001 ~ 610,000,000 | 30.00% |
| > 1,400,000,000 | 34.00% |

> **참고**: 전체 세율표(127개 구간)는 PMK 168/2023 Lampiran 참조.
> 구현 시 DB `tax_rate_config`에 category='PPH21_TER_A/B/C'로 저장 권장.

---

## 5. PPh 15 — 특수업종 (해운/항공)

| 업종 | 세율 | DPP 산정 | 근거 |
|------|------|----------|------|
| 국내 해운 (pelayaran DN) | **1.2%** | 총수입(bruto) | KMK 416/1996 |
| 국내 항공 (penerbangan DN) | **1.8%** | 총수입(bruto) | KMK 475/1996 |
| 외국 해운/항공 PE | **2.64%** | 총수입(bruto) | Pasal 15 UU PPh |

---

## 6. 세율 결정 로직 흐름도

```
거래 발생
  │
  ├─ 수취인 유형 판단
  │   ├─ 비거주자 → PPh 26 (§7)
  │   └─ 거주자 → 다음 단계
  │
  ├─ 거래 유형 판단
  │   ├─ 근로소득 → PPh 21 (TER 1~11월 / Pasal 17 12월)
  │   ├─ 수입거래 → PPh 22
  │   ├─ 해운/항공 → PPh 15
  │   ├─ Final 대상 → PPh 4(2)
  │   │   ├─ 토지/건물 임대 → 10%
  │   │   ├─ 건설 시공 → SBU 등급별 1.75~4%
  │   │   ├─ 건설 컨설팅 → SBU 여부별 3.5~6%
  │   │   ├─ 선박 임대 → 3%
  │   │   ├─ 항공기 임대 → 2%
  │   │   └─ UMKM(매출<4.8B) → 0.5%
  │   └─ 기타 소득 → PPh 23
  │       ├─ 배당/이자/로열티/상금 → 15%
  │       └─ 임대(토지건물외)/용역 → 2%
  │           └─ KBLI → 서비스 분류 → e-Bupot 코드
  │
  ├─ NPWP 보유 여부
  │   ├─ 있음 → 기본 세율
  │   └─ 없음 → 세율 × 2 (100% 가중)
  │
  └─ 세액 산출: DPP(과세표준) × 세율 = 원천징수세액
```

---

## 7. 세율 결정에 필요한 입력 데이터

월 신고 프로세스 구현 시 거래별로 수집해야 할 데이터:

| 필드 | 설명 | 영향 | 필수 |
|------|------|------|------|
| `recipient_type` | 거주자/비거주자 | PPh 23 vs 26 분기 | Y |
| `recipient_npwp` | 수취인 NPWP | 가중세율 판단 | Y |
| `recipient_country` | 비거주자 국적 | DTA 조약세율 | 비거주자만 |
| `has_cod` | CoD(거주지증명) 보유 | DTA 적용 가능 여부 | 비거주자만 |
| `transaction_type` | 소득/거래 유형 | PPh 종류 결정 | Y |
| `kbli_code` | 서비스 제공자 KBLI | 서비스 분류, e-Bupot 코드 | 용역 거래 시 |
| `sbu_grade` | SBU 등급 (kecil/menengah/besar/없음) | 건설 세율 분기 | 건설 거래 시 |
| `sbu_type` | 시공/설계/통합 | 건설 세율 분기 | 건설 거래 시 |
| `gross_amount` | 총지급액 (VAT 제외) | DPP(과세표준) | Y |
| `entity_type` | 사업자 유형 (개인/PT/CV 등) | UMKM 기간 제한 | UMKM 시 |
| `annual_revenue` | 연매출 | UMKM 적격 여부 | UMKM 시 |
| `ptkp_status` | PTKP 카테고리 | PPh 21 TER 카테고리 | 근로소득 시 |

---

## 8. 구현 우선순위 로드맵

### Phase 1: 핵심 월 신고 (즉시)
1. **PPh 21 TER 엔진** — TER A/B/C 세율표 DB화 + 월별 계산 로직
2. **PPh 23 서비스 세분화** — PMK 141/2015 62종 → `klu_codes` 확장 + e-Bupot 코드 매핑
3. **PPh 4(2) 건설 SBU 등급** — `IncomeType` 확장 + SBU 파라미터 추가

### Phase 2: 신고서 생성
4. **e-Bupot PPh 23/26** — 월별 bukti potong 생성
5. **SPT Masa PPh 21** — 월별 근로소득세 신고서
6. **SPT Masa PPN** — 부가가치세 월 신고

### Phase 3: 고급 기능
7. **PPh 15 특수업종** — 해운/항공 세율
8. **DTA 국가 확대** — 71개 조약국 전체
9. **세율 변경 이력 관리** — `tax_rate_config` 유효기간 기반 버전 관리

---

## 9. 주요 법령 레퍼런스

| 법령 | 내용 | 관련 PPh |
|------|------|----------|
| UU No.7/2021 (UU HPP) | 세법 조화법 - 세율 체계 전반 | 전체 |
| PP 58/2023 | PPh 21 TER 유효세율 도입 | PPh 21 |
| PMK 168/2023 | PPh 21 TER 시행 세칙 + 세율표 | PPh 21 |
| PMK 141/2015 | PPh 23 Jasa Lain 62종 서비스 목록 | PPh 23 |
| PP 9/2022 | 건설 서비스 final tax SBU별 세율 | PPh 4(2) |
| PP 55/2022 | UMKM 0.5% final tax (PP 23/2018 개정) | PPh Final |
| PP 34/2017 | 토지/건물 임대 10% final tax | PPh 4(2) |
| PMK 34/2017 | PPh 22 수입세율 | PPh 22 |
