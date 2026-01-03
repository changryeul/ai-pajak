# 인도네시아 세금 규정 및 DJP 요구사항 도메인 연구

**연구 일자**: 2026년 1월 3일
**프로젝트**: AI Pajak - AI 기반 인도네시아 세금 관리 플랫폼
**연구 범위**: DJP 시스템, PPh21, PPh23, VAT/PPN, SPT Tahunan, 세무 컨설턴트 라이센싱, 위임장 요건

---

## 1. 요약 (Executive Summary)

### 핵심 발견사항

인도네시아의 세금 행정 시스템은 2025년 1월부터 **Coretax (Core Tax Administration System)**로 대대적인 전환을 맞이하고 있습니다. 이는 DJP Online에서 통합 디지털 플랫폼으로의 이전을 의미하며, AI Pajak 플랫폼에 중요한 기술적, 운영적 시사점을 제공합니다.

#### 주요 변경사항 요약

| 영역 | 2024년 | 2025년 이후 |
|------|--------|------------|
| **세금 신고 시스템** | DJP Online (pajak.go.id) | Coretax DJP |
| **PPh21 계산** | TER (Tarif Efektif Rata-rata) 1년차 | TER 2년차 |
| **VAT 세율** | 11% | 12% (비사치품은 실효세율 11%) |
| **e-Faktur** | e-Faktur Desktop | Coretax 통합 또는 PJAP Host-to-Host |
| **NPWP 형식** | 15자리 + NIK 16자리 병행 | NIK 기반 16자리 통합 |

#### AI Pajak 핵심 시사점

1. **PJAP 통합 필수**: Coretax API를 통한 제3자 애플리케이션 통합 가능
2. **Jakarta Tax Consulting 역할 명확화**: 세금 신고는 반드시 라이센스 보유 세무 컨설턴트가 수행
3. **위임장(Surat Kuasa Khusus) 관리**: 고객 대리 신고 시 필수 문서
4. **TER 계산 엔진**: PPh21 월별 원천징수 및 12월 연말 정산 로직 필요

---

## 2. DJP 시스템 개요 (DJP System Overview)

### 2.1 현행 시스템 (DJP Online)

**공식 포털**: https://djponline.pajak.go.id

DJP Online은 현재까지 인도네시아의 주요 전자 세금 신고 플랫폼으로, 다음 서비스를 제공합니다:

- **e-Filing**: 전자 세금 신고 (SPT Masa 및 SPT Tahunan)
- **e-Billing**: 전자 세금 납부
- **e-Bupot**: 원천징수 증명서 발급
- **e-Faktur**: 부가가치세 세금계산서

#### 2024년 세금 신고 (2025년 진행)
- **개인 납세자**: DJP Online의 e-Filing 사용
- **법인 납세자**: DJP Online의 e-Form 사용
- **마감일**: 개인 2025년 3월 31일, 법인 2025년 4월 30일

### 2.2 Coretax 시스템 (2025년 1월~)

**근거 법령**: PMK-81/2024 (2024년 10월 18일 발효)

#### Coretax 핵심 특징

| 기능 | 설명 |
|------|------|
| **통합 플랫폼** | 등록, 신고, 납부, 환급을 단일 시스템으로 통합 |
| **21개 핵심 비즈니스 프로세스** | DJP의 모든 주요 세금 업무 통합 |
| **API 기술** | e-Invoice, e-Bupot Unification, e-Billing API 제공 |
| **전자 인감(Electronic Seal)** | 2025년 1월 1일부터 모든 공식 문서에 필수 |
| **MFA 인증** | 다중 인증(Multi-Factor Authentication) 도입 |
| **외부 기관 연동** | Dukcapil (인구데이터), Directorate General of AHU 연동 |

#### 접근 채널

1. **Taxpayer Portal (Coretax)**: 모든 납세자용 메인 애플리케이션
2. **Third Party Applications (PJAP)**: Coretax 통합 제3자 시스템
3. **Contact Center DJP**: 고객 지원 서비스

#### PJAP (Penyedia Jasa Aplikasi Perpajakan) 통합

```
PJAP 통합 옵션:
1. Coretax 직접 사용
2. e-Faktur Desktop (기존 애플리케이션)
3. Host-to-Host e-Faktur via PJAP

근거: KEP-54/PJ/2025, PENG-13/PJ.09/2025
```

**AI Pajak 시사점**: PJAP로서 DJP와 파트너십을 구축하거나, 기존 PJAP와 협력하여 Coretax 연동 가능

### 2.3 EFIN (Electronic Filing Identification Number)

- 모든 전자 제출, 통신, 계정 관련 활동에 필수
- Coretax 시스템 접근의 핵심 인증 수단

### 2.4 전환 일정

| 시기 | 적용 시스템 | 비고 |
|------|------------|------|
| 2024년 신고 (2025년 진행) | DJP Online | 개인 3/31, 법인 4/30 마감 |
| 2025년 1월~ | Coretax 시작 | 월별 신고부터 적용 |
| 2025년 신고 (2026년 진행) | Coretax | 완전 전환 |

---

## 3. 세금 유형 상세 분석 (Tax Types Deep Dive)

### 3.1 PPh21 - 근로소득세 (Employee Income Tax)

#### 법적 근거
- **PP 58/2023**: TER 도입 정부 규정
- **PMK 168/2023**: 상세 시행 가이드라인

#### TER (Tarif Efektif Rata-rata) 시스템

2024년 1월 1일부터 시행된 새로운 원천징수 방식으로, 월별 계산을 단순화합니다.

##### TER 유형

| 유형 | 적용 대상 |
|------|----------|
| **월별 TER** | 정규직 근로자의 월간 총소득 |
| **일별 TER** | 비정규직 근로자의 일/주/단위 소득 |

##### 월별 TER 카테고리

| 카테고리 | PTKP 기준 | 세율 범위 |
|----------|----------|----------|
| **A** | TK/0 (IDR 54M), TK/1 (IDR 58.5M), K/0 (IDR 58.5M) | 0% (≤IDR 5.4M) ~ 34% (>IDR 1.4B) |
| **B** | TK/2 (IDR 63M), K/1 (IDR 63M), TK/3 (IDR 67.5M), K/2 (IDR 67.5M) | 0% (≤IDR 6.2M) ~ 34% (>IDR 1.405B) |
| **C** | K/3 (IDR 72M) | 별도 세율표 적용 |

##### 월별 계산 공식 (1월~11월)

```
PPh21 원천징수액 = TER × 월 총소득 (Gross Monthly Income)
```

##### 12월 (연말) 정산

12월은 Article 17(1)(a) 누진세율을 사용하여 연간 정산:

1. 1월~11월 TER 기반 원천징수 합계 계산
2. 연간 과세소득(PKP)에 Article 17 세율 적용하여 연간 PPh21 계산
3. 12월 PPh21 = 연간 PPh21 - (1월~11월 원천징수 합계)

##### Article 17 누진세율

| 과세소득 구간 | 세율 |
|--------------|------|
| ≤ IDR 60,000,000 | 5% |
| IDR 60M ~ 250M | 15% |
| IDR 250M ~ 500M | 25% |
| IDR 500M ~ 5B | 30% |
| > IDR 5,000,000,000 | 35% |

##### 계산 예시

```
납세자: 기혼, 부양가족 없음 (K/0 → TER Category A)
월 급여: IDR 10,000,000

월별 원천징수 (1월~11월):
- TER 세율: 2.25%
- 원천징수액: IDR 10,000,000 × 2.25% = IDR 225,000/월
- 11개월 합계: IDR 2,475,000

12월 정산:
- 연간 총소득: IDR 120,000,000
- PTKP (K/0): IDR 58,500,000
- PKP: IDR 61,500,000
- 연간 PPh21: (IDR 60M × 5%) + (IDR 1.5M × 15%) = IDR 3,225,000
- 12월 PPh21: IDR 3,225,000 - IDR 2,475,000 = IDR 750,000
```

#### 2025년 변경사항

- **e-Bupot 제출 형식**: Excel → XML (Coretax 통해 제출)
- **TER 2년차 적용**: 시스템 안정화

#### AI Pajak 구현 요구사항

1. **TER 세율표 데이터베이스**: 125개 세율 (카테고리별 분류)
2. **PTKP 상태 관리**: 결혼 여부, 부양가족 수 추적
3. **12월 정산 로직**: Article 17 세율 적용 연간 계산
4. **e-Bupot XML 생성**: Coretax 제출용

### 3.2 PPh23 - 원천징수세 (Withholding Tax)

#### 개요

PPh23은 내국 납세자에게 지급하는 서비스료, 임대료, 이자, 배당금 등에 대한 원천징수세입니다.

#### 세율

| 소득 유형 | 세율 |
|----------|------|
| 서비스료, 임대료 | 2% |
| 이자, 배당금, 로열티 | 15% |

#### 신고 및 납부 일정

| 항목 | 마감일 |
|------|--------|
| **납부** | 지급월 익월 15일 |
| **SPT Masa 신고** | 지급월 익월 20일 |

#### 의무 대상

- PT (Perseroan Terbatas)
- PT PMA (외국인 투자 회사)
- CV (Commanditaire Vennootschap)

**중요**: NPWP 보유 법인은 수입이 없어도 월별 PPh23 신고 의무 (Nil Filing 포함)

#### 원천징수 의무자 책임

1. 지급 전 적용 Article 확인
2. 지원 문서 수집 (송장, 계약서, CoR for PPh26)
3. 원천징수 증명서 발급 (e-Bupot)

#### 미이행 제재

- 행정 벌금 및 이자
- 비용 불인정 (Article 9(1))
- NPWP 정지 가능

### 3.3 VAT/PPN - 부가가치세 (Value Added Tax)

#### 법적 근거
- **UU No. 8/1983**: VAT 기본법
- **UU No. 7/2021 (UU HPP)**: 세율 조정
- **PMK 131/2024**: 2025년 시행 가이드라인

#### 세율 변경

| 시기 | 세율 | 비고 |
|------|------|------|
| 2022년 4월~ | 11% | 10%에서 인상 |
| 2025년 1월~ | 12% (명목) / 11% (실효) | 사치품만 12% 전액 적용 |

#### 2025년 세율 구조

##### 일반 상품/서비스 (비사치품)
```
실효 VAT = 12% × (11/12) × 판매가 = 11% 실효세율 유지
```

##### 사치품 (Luxury Goods) - 12% 전액 적용
- 고급 차량
- 고급 주택 (IDR 30B 초과)
- 개인 제트기
- 요트

#### 전환 기간 (2025년 1월 1일~31일)

- 비사치품: 12% 및 11% 세금계산서 모두 유효
- 2025년 2월 1일부터: 12% 세율 계산 의무화 (비사치품은 11/12 조정 적용)

#### e-Faktur (전자 세금계산서) 요구사항

##### 필수 발급 의무
- 2016년부터 모든 PKP (Pengusaha Kena Pajak)에 의무화
- DJP 공식 포털 또는 Coretax를 통해 관리

##### e-Faktur 필수 요소

| 요소 | 설명 |
|------|------|
| **NSFP** | 고유 세금계산서 일련번호 (DJP 검증 후 자동 발급) |
| **거래 당사자 정보** | 판매자/구매자 이름, NPWP, 주소 |
| **QR 코드** | e-Faktur 시스템 생성 검증 코드 |
| **거래 상세** | 품목, 수량, 단가, 세액 |
| **VAT 계산** | 과세표준, 적용 세율 |

##### 고용량 PKP (월 10,000건 이상)

- Host-to-Host e-Faktur 애플리케이션 사용 가능
- PJAP 통합 옵션 제공

#### VAT 등록 기준

| 조건 | 등록 요건 |
|------|----------|
| 연매출 ≥ IDR 4.8B | 의무 등록 |
| 연매출 < IDR 4.8B | 자발적 등록 가능 |

#### 신고 및 납부

| 항목 | 마감일 |
|------|--------|
| **VAT 납부** | 익월 말 |
| **e-Faktur VAT 신고** | 익월 말 (Coretax 통해) |
| **개별 e-Faktur 발급** | 판매월 익월 20일 |

#### VAT 면제 항목

- 기본 식료품
- 교육 서비스
- 의료 서비스
- 수출 (0% 세율)

---

## 4. 신고 요건 및 마감일 (Filing Requirements and Deadlines)

### 4.1 월별 신고 (SPT Masa)

| 세목 | 납부 마감 | 신고 마감 |
|------|----------|----------|
| PPh21 | 익월 10일 | 익월 20일 |
| PPh23 | 익월 15일 | 익월 20일 |
| PPh26 | 익월 15일 | 익월 20일 |
| PPh 4(2) | 익월 15일 | 익월 20일 |
| VAT | 익월 말 | 익월 말 |

### 4.2 연간 신고 (SPT Tahunan)

| 납세자 유형 | 양식 | 신고 마감 |
|------------|------|----------|
| **개인 (간편)** | 1770S / 1770SS | 3월 31일 |
| **개인 (일반)** | 1770 | 3월 31일 |
| **법인** | 1771 | 4월 30일 (회계연도 종료 후 4개월) |

#### 2025년 특별 연장 (2024년 귀속분)

- 개인: 2025년 4월 11일까지 연장 (KEP-79/PJ/2025)
- 단, **납부 마감은 3월 31일 유지**

### 4.3 필수 제출 서류

#### 법인 SPT Tahunan (Form 1771)

1. 재무제표 (Financial Statements)
2. NPWP (세금 등록 번호)
3. 원천징수 증명서 (Bukti Potong)
4. 과세소득 및 공제 상세 내역
5. 최종 납세 대상 소득 별도 보고

### 4.4 미신고/지연 신고 제재

| 위반 유형 | 제재 |
|----------|------|
| SPT Tahunan 지연 제출 | IDR 1,000,000 벌금 |
| 세금 지연 납부 | 월 2%까지 이자 |
| 허위/오류 신고 | 세무 조사, 추가 과세, 법적 조치 |

### 4.5 2025년 세금 캘린더 주요 일정

```
2025년 1월 20일 - 2024년 12월분 PPh21/23 신고
2025년 1월 31일 - 2024년 12월분 VAT 신고
2025년 3월 31일 - 2024년 귀속 개인 SPT Tahunan
2025년 4월 11일 - 2024년 귀속 개인 SPT Tahunan 연장 마감
2025년 4월 30일 - 2024년 귀속 법인 SPT Tahunan
```

---

## 5. 세무 컨설턴트/어드바이저 요건 (Tax Consultant/Advisor Requirements)

### 5.1 규제 체계

#### 주요 법령
- **PMK 111/2014**: 세무 컨설턴트 기본 규정
- **PMK 175/2022**: 개정 규정 (PPPK 이관)
- **KMK 898/2019**: 감독 권한 PPPK 이관

#### 감독 기관

**PPPK (Pusat Pembinaan Profesi Keuangan)** - 재무부 산하 금융전문가 육성센터

- 2019년부터 세무 컨설턴트 감독 및 지도 담당
- 기존 DJP에서 이관

### 5.2 면허 등급 (Izin Praktik)

| 등급 | 자격 요건 | 서비스 범위 |
|------|----------|------------|
| **A** | USKP A 합격, A급 인증서 | 개인 납세자 (조세조약국 거주자 제외) |
| **B** | USKP B 합격, B급 인증서 | 개인 + 법인 (PMA, BUT, 조세조약국 제외) |
| **C** | USKP C 합격, C급 인증서 | 모든 납세자 |

### 5.3 면허 신청 요건

#### 필수 서류

1. **신청서**: SIKoP 또는 PMK 175/2022 별첨 I 양식
2. **이력서**: 경력 및 학력 포함
3. **세무 컨설턴트 인증서**: PPSKP 공증 사본
4. **경찰 신원조회서 (SKCK)**: 최소 Polres 급 발급
5. **최근 사진**: 흰색 배경, 2×3cm
6. **KTP 및 NPWP**: 스캔 사본
7. **고용 비관계 확인서**: 정부/국영기업 근무 아님 확인 (인지 첨부)
8. **협회 가입 결정서**: 협회장 공증 사본

### 5.4 협회 가입 의무

세무 컨설턴트 등록을 위해 재무부 사무총장에 등록된 세무 컨설턴트 협회 가입 필수

**주요 협회**: IKPI (Ikatan Konsultan Pajak Indonesia)

### 5.5 USKP (세무 컨설턴트 자격시험)

#### 시험 정보
- **주관**: PPSKP (Panitia Penyelenggara Sertifikasi Konsultan Pajak)
- **시험료**: 2023년 말 PPSKP 신설 이후 무료화 (2024년 12월까지)
- **등급**: A, B, C (각 등급별 별도 시험)

### 5.6 전자 면허증 (KIP 전자화)

**근거**: PENG-12/PPPK/2023

- 2023년 10월 30일부터 온라인 발급 시작
- **2024년 1월 1일부터**: 실물 카드 발급 중단, 전자 KIP만 발급

### 5.7 세무법원 대리인 (Kuasa Hukum)

#### 추가 요건
- 세무법원장에게 신청서 제출
- **2024년 4월 12일부터**: IKH Online 시스템 통해 온라인 신청 필수
- **근거**: PMK 184/2017, PER-01/PP/2024

### 5.8 향후 변경 예정

- 사무소 면허(Izin Kantor) 의무화 예정
- 사무소를 통해 서비스 제공 시 별도 면허 필요
- 개인 컨설턴트는 기존대로 개인 면허만 필요

### 5.9 AI Pajak 시사점

**Jakarta Tax Consulting 요건**:
1. B급 또는 C급 면허 보유 컨설턴트 확보
2. PPPK 등록 및 협회 가입 확인
3. 고객별 Surat Kuasa Khusus 관리 시스템
4. 전자 KIP 유효성 검증 프로세스

---

## 6. 위임장 요건 (Power of Attorney Requirements)

### 6.1 Surat Kuasa Khusus (특별 위임장)

세금 권리 및 의무 이행을 대리인에게 위임할 때 필요한 법적 문서입니다.

#### 대리인 유형

| 유형 | 자격 요건 |
|------|----------|
| **세무 컨설턴트** | 유효한 Izin Praktik 보유 |
| **납세자 직원** | 세무 자격 증명 (Brevet, 학위, 또는 컨설턴트 인증서) |

### 6.2 세무 컨설턴트 대리인 요건

1. DJP 또는 지정 관리가 발급한 **Izin Praktik (면허증)** 보유
2. **세무 컨설턴트 확인서** 제출
3. **최근 SPT Tahunan PPh** 신고 완료 (신고 의무가 있는 경우)
4. **조세 범죄 유죄 판결 이력 없음**

### 6.3 직원 대리인 요건

세금 법령에 대한 숙달 증명:
- **Brevet 인증서**: 세무 교육 기관 발급
- **세무학 학위**: 최소 Diploma III (A등급 인가 대학)
- **세무 컨설턴트 인증서**: PPSKP 발급

### 6.4 Surat Kuasa Khusus 필수 기재사항

| 항목 | 내용 |
|------|------|
| **위임인 정보** | 성명, 주소, 서명 (인지), NPWP |
| **대리인 정보** | 성명, 주소, 서명, NPWP |
| **위임 범위** | 세금 목적, 세목, 과세기간/연도 특정 |

**중요**: 1건의 Surat Kuasa Khusus는 1명의 대리인, 1건의 특정 세금 권리/의무에만 유효

### 6.5 필수 첨부 서류

대리인이 납세자를 대리할 때 다음 서류 첨부 필수:

1. Brevet 인증서, 세무학 학위, 또는 세무 컨설턴트 인증서 사본
2. 최근 SPT Tahunan 제출 영수증 (신고 의무가 있는 대리인)
3. PPh21 신고된 정규직 목록 사본

### 6.6 Coretax 시스템 연동

- **Surat Kuasa Khusus**: 관할 KPP (세무서)에 직접 제출
- **Coretax 계정 접근**: 위임인이 대리인의 계정 접근 요청 승인 필요

### 6.7 무효 조건

필수 서류 미제출 시 대리인 자격 불인정

### 6.8 AI Pajak 구현 요구사항

1. **Surat Kuasa Khusus 템플릿 관리**
2. **대리인 자격 검증 시스템** (면허 유효성 확인)
3. **문서 만료 알림** (갱신 필요 시)
4. **Coretax 접근 권한 요청/승인 워크플로우**
5. **감사 추적** (법적 요건 충족)

---

## 7. AI Pajak 컴플라이언스 고려사항 (Compliance Considerations)

### 7.1 법적 구조 준수

#### 현행 법적 구조
- **AI Pajak (Platform)**: Mono Flip Global 운영
- **세금 신고 서비스**: Jakarta Tax Consulting 독점 제공
- **플랫폼**: 세금 신고 서비스 직접 제공 불가

#### 준수 요구사항

| 영역 | 요구사항 | 구현 방안 |
|------|----------|----------|
| **서비스 제공 주체** | 세금 신고는 JTC만 수행 | 모든 DJP 신고는 JTC 명의 |
| **UI 메시징** | "AI Pajak가 세금을 신고합니다" 금지 | "세무 컨설턴트와 연결" 문구 사용 |
| **데이터 접근** | Platform Admin은 고객 세금 데이터 접근 불가 | 역할 기반 접근 제어 (RBAC) |
| **감사 로그** | 모든 DJP 신고는 JTC 조치로 기록 | AuditLog 엔터티 활용 |

### 7.2 사용자 역할별 권한

| 역할 | 세금 계산 | 세금 신고 | 고객 데이터 접근 |
|------|----------|----------|-----------------|
| CUSTOMER | X | X | 본인만 |
| CONSULTANT_JTC | O | X | 담당 고객 |
| TAX_ADVISOR_JTC | O | O (POA 필수) | 담당 고객 |
| PLATFORM_ADMIN | X | X | X |
| SYSTEM | X | X | 청구 정보만 |

### 7.3 기술적 컴플라이언스

#### Coretax 통합
1. **PJAP 파트너십** 또는 **기존 PJAP 활용**
2. **API 연동**: e-Invoice, e-Bupot, e-Billing
3. **Host-to-Host e-Faktur** (월 10,000건 이상 시)

#### 데이터 보호
1. **암호화**: 저장 및 전송 시 암호화
2. **접근 제어**: 역할 기반 세분화된 권한
3. **감사 추적**: 모든 데이터 접근/변경 기록

#### 워크플로우 상태 관리
```
UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED

- AI_ANALYZED까지: 플랫폼 자동화 가능
- HUMAN_REVIEW: JTC 컨설턴트 검토 필수
- APPROVED/FILED: TAX_ADVISOR_JTC만 진행 가능 (POA 확인 후)
```

### 7.4 문서 관리

#### 필수 보관 문서
1. Surat Kuasa Khusus (고객별)
2. 세무 컨설턴트 면허증 (KIP)
3. SPT 제출 영수증 (BPE)
4. e-Bupot (원천징수 증명서)
5. e-Faktur (세금계산서)

#### 보관 기간
- 최소 **10년** (세금 관련 문서 법정 보관 기간)

---

## 8. 핵심 발견사항 및 권고사항 (Key Findings and Recommendations)

### 8.1 핵심 발견사항

#### 시스템 전환
1. **Coretax 도입**: 2025년 1월부터 인도네시아 세금 시스템의 근본적 변화
2. **PJAP 통합 가능**: 제3자 애플리케이션으로 Coretax 연동 지원
3. **이중 시스템 운영**: 2024년분은 DJP Online, 2025년분부터 Coretax

#### 세금 계산
4. **TER 시스템 정착**: PPh21 월별 원천징수 단순화, 12월 정산 필수
5. **VAT 11% 유지**: 2025년 12% 명목 세율이지만 실효세율 11% 적용
6. **Nil Filing 의무**: 거래 없어도 월별 PPh21/23 신고 필수

#### 라이센싱
7. **PPPK 감독**: 세무 컨설턴트 관리 기관 변경 (DJP → PPPK)
8. **3단계 면허**: A, B, C 등급별 서비스 범위 제한
9. **전자 KIP**: 2024년부터 실물 카드 없이 전자 면허만 발급

#### 위임 요건
10. **Surat Kuasa Khusus 필수**: 대리 신고 시 반드시 필요
11. **1대1 원칙**: 1건의 위임장은 1명의 대리인, 1건의 특정 업무에만 유효

### 8.2 AI Pajak 권고사항

#### 단기 (0-6개월)

| 우선순위 | 권고사항 | 근거 |
|----------|----------|------|
| **높음** | Coretax PJAP 통합 계획 수립 | 2025년 1월 필수 적용 |
| **높음** | TER 계산 엔진 개발 | 125개 세율, 카테고리별 분류 |
| **높음** | Surat Kuasa 관리 모듈 구축 | 모든 대리 신고 필수 요건 |
| **중간** | Jakarta Tax Consulting 면허 검증 | B급/C급 면허 필요 |

#### 중기 (6-12개월)

| 우선순위 | 권고사항 | 근거 |
|----------|----------|------|
| **높음** | e-Faktur Host-to-Host 구현 | 확장성, 대용량 처리 |
| **중간** | VAT 세율 조정 로직 | 사치품/비사치품 구분 |
| **중간** | 12월 PPh21 정산 자동화 | Article 17 세율 적용 |
| **낮음** | 세금 캘린더 알림 시스템 | 마감일 관리 자동화 |

#### 장기 (12개월+)

| 우선순위 | 권고사항 | 근거 |
|----------|----------|------|
| **중간** | AI 기반 세금 최적화 제안 | 고객 가치 제공 |
| **중간** | 다중 과세연도 분석 | 트렌드 분석, 예측 |
| **낮음** | 세무 감사 대응 지원 | 문서 관리 자동화 |

### 8.3 리스크 및 완화 방안

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| Coretax 시스템 불안정 | 신고 지연 | 대체 채널 (PJAP, e-Faktur Desktop) 준비 |
| 면허 만료 | 서비스 중단 | 자동 갱신 알림, 복수 컨설턴트 확보 |
| POA 미비 | 대리 신고 불가 | 고객 온보딩 시 필수 수집 |
| 규정 변경 | 시스템 수정 필요 | DJP 공지 모니터링, 분기별 규정 검토 |

---

## 9. 출처 (Sources)

### 공식 정부 출처

1. **DJP (Direktorat Jenderal Pajak)** - https://www.pajak.go.id/en
   - Core System of Tax Administration
   - Electronic Filing
   - Kuasa Wajib Pajak

2. **Kemenkeu (Ministry of Finance)** - https://jdih.kemenkeu.go.id
   - PMK 81/2024 (Coretax)
   - PMK 175/2022 (Tax Consultants)
   - PMK 111/2014 (Tax Consultants - Original)

3. **PPPK (Pusat Pembinaan Profesi Keuangan)** - https://pppk.kemenkeu.go.id
   - Permohonan Izin Praktik Konsultan Pajak

### 법률/규정

4. **PP 58/2023** - TER 도입 정부 규정
5. **PMK 168/2023** - PPh21 TER 시행 가이드라인
6. **PMK 131/2024** - VAT 2025년 시행 가이드라인
7. **UU No. 7/2021 (UU HPP)** - 세제 조화법

### 업계 분석 자료

8. **Seven Stones Indonesia** - https://sevenstonesindonesia.com
   - Indonesia's Tax Report Transition: DJP Online to Coretax
   - Indonesia's 2025 Core Tax System

9. **Cekindo** - https://www.cekindo.com
   - Core Tax Administration System: Key Changes
   - Corporate Annual Tax Return

10. **Let's Move Indonesia** - https://www.letsmoveindonesia.com
    - Corporate Annual Tax Return Filing
    - Coretax System Implementation

11. **JCSS Indonesia** - https://jcss.co.id
    - SPT Tahunan for Indonesian SMEs
    - Indonesia Tax Compliance Calendar 2025

12. **Legal Indonesia** - https://legalindonesia.id
    - PPh21 TER Changes in 2024
    - VAT in Indonesia

13. **PWC Tax Summaries** - https://taxsummaries.pwc.com
    - Indonesia Corporate Withholding Taxes

14. **EY Indonesia** - https://www.ey.com/en_id
    - PMK 131: New calculation of VAT payable

15. **MUC Consulting** - https://muc.co.id
    - Income Tax Article 21 December Calculation

16. **Pajakku** - https://artikel.pajakku.com
    - DJP Online e-Filing
    - Izin Praktik Konsultan Pajak

17. **IKPI (Ikatan Konsultan Pajak Indonesia)** - https://ikpi.or.id
    - DJP Online/Coretax SPT Reporting
    - Coretax Kuasa Wajib Pajak Registration

18. **DDTC News** - https://news.ddtc.co.id
    - PMK Konsultan Pajak Revision

### API 및 기술 문서

19. **Klikpajak Public API** - https://documenter.getpostman.com
    - API Documentation for Tax Integration

---

## 부록 (Appendix)

### A. TER 세율표 요약 (Monthly TER Rate Summary)

*참고: 전체 125개 세율은 PMK 168/2023 별첨 참조*

#### Category A (TK/0, TK/1, K/0)

| 월 총소득 (IDR) | TER 세율 |
|----------------|---------|
| ≤ 5,400,000 | 0% |
| 5,400,001 - 5,650,000 | 0.25% |
| 5,650,001 - 5,950,000 | 0.50% |
| ... | ... |
| > 1,400,000,000 | 34% |

### B. 주요 용어 정리

| 용어 | 설명 |
|------|------|
| DJP | Direktorat Jenderal Pajak (국세청) |
| NPWP | Nomor Pokok Wajib Pajak (납세자등록번호) |
| SPT | Surat Pemberitahuan (세금신고서) |
| PKP | Pengusaha Kena Pajak (과세사업자) |
| PTKP | Penghasilan Tidak Kena Pajak (비과세소득한도) |
| TER | Tarif Efektif Rata-rata (평균유효세율) |
| EFIN | Electronic Filing Identification Number |
| PJAP | Penyedia Jasa Aplikasi Perpajakan (세무앱서비스제공자) |
| KPP | Kantor Pelayanan Pajak (세무서) |
| USKP | Ujian Sertifikasi Konsultan Pajak (세무사자격시험) |

### C. 연락처

| 기관 | 연락처 |
|------|--------|
| DJP Call Center | 1500200 |
| Kring Pajak | kring@pajak.go.id |
| PPPK | pppk@kemenkeu.go.id |

---

*본 문서는 2026년 1월 3일 기준으로 작성되었으며, 최신 규정 변경 사항은 공식 DJP 웹사이트에서 확인하시기 바랍니다.*
