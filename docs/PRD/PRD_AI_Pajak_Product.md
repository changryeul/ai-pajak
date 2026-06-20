# AI Pajak — 제품 요구사항 명세서 (PRD)
### 인도네시아 세무 신고 자동화 플랫폼

| 항목 | 내용 |
|---|---|
| 문서 버전 | 1.0 |
| 작성일 | 2026-06-20 |
| 제품명 | AI Pajak |
| 운영 주체 | Mono Flip Global / Jakarta Tax Consulting (JTC) |
| 프로덕션 | https://ai-pajak.vercel.app |
| 문서 성격 | 제품 요구사항 명세 (Product Requirements Document) |

---

## 1. 개요

### 1.1 제품 정의

AI Pajak는 인도네시아 납세자(개인·법인)와 세무사무소가 한 플랫폼에서 세무 신고를 처리하는 **멀티테넌트 세무 SaaS**다. 인도네시아 세법에 따른 월 신고(SPT Masa)·연 신고(SPT Tahunan)·연간 결산을 자동 계산하고, OCR로 증빙을 디지털화하며, 국세청(DJP)의 통합 세정 시스템 Coretax와 연동해 전자납부·제출·접수증 회수까지 처리한다.

### 1.2 핵심 원칙

- **AI Pajak는 기술 플랫폼이며 세무 신고의 법적 주체가 아니다.** 신고의 법적 행위자는 제휴 세무사무소(JTC 및 외부 세무사무소)다.
- **플랫폼 운영 ≠ 세무 서비스 제공 ≠ 결제 수금** — 세 주체를 구조적으로 분리한다.
- **데이터 격리와 감사추적이 모든 기능의 전제**다.

### 1.3 제품 목표 (Product Goals)

1. 비전문가도 정확하게 신고할 수 있을 만큼 세무 계산을 자동화한다.
2. 종이·이미지 기반 증빙을 OCR/AI로 구조화 데이터로 전환한다.
3. 신고 제출~납부~접수의 전 과정을 추적 가능한 워크플로우로 처리한다.
4. 세무사무소(컨설턴트)의 처리 생산성을 높인다.
5. 멀티테넌트 환경에서 사무소 간 데이터를 완전히 격리한다.

### 1.4 비목표 (Non-Goals)

- AI Pajak가 직접 세무 대리인으로서 신고를 "대행 책임"지지 않는다(법적 주체는 세무사무소).
- 회계 장부 전체를 대체하는 ERP는 아니다(세무 신고에 필요한 범위로 한정).
- 본 버전에서 법인 연 신고(1771)의 UI 제출은 비활성(계산 엔진만 보유), 월 신고·결산 흐름으로 대체한다.

---

## 2. 사용자 및 역할 (Personas & Roles)

### 2.1 역할 정의 (RBAC)

| 역할 | 설명 | 데이터 접근 범위 |
|---|---|---|
| `CUSTOMER` (INDIVIDUAL) | 개인 납세자 | 본인 데이터 |
| `CUSTOMER` (COMPANY) | 법인 납세자 | 본인 회사 데이터 |
| `CONSULTANT_JTC` | JTC 또는 외부 사무소 컨설턴트 | 배정된 고객 |
| `TAX_ADVISOR_JTC` | 선임 세무사 | 소속 사무소 고객 + **신고 최종 제출 권한** |
| `TAX_OPERATOR` | 백오피스 운영자 | 처리 큐 |
| `TAX_OPERATOR_SUPERVISOR` | 운영 수퍼바이저 | 승인·배분·통계 |
| `TAX_OPERATOR_MASTER` | 운영 마스터 | 플랫폼 통계·맞춤 가격 |
| `PLATFORM_ADMIN` | 플랫폼 관리자 | 인프라·사용자 (**세무 데이터 접근 불가**) |
| `SYSTEM` | 시스템 계정 | 결제 자동화 전용 |

조직 유형: `PLATFORM_OWNER`, `PLATFORM`, `TAX_PARTNER`(JTC 내부 또는 EXTERNAL 외부 사무소).

### 2.2 대표 페르소나

- **부디 (개인 근로소득자)**: 세법을 모르지만 연 1회 SPT를 정확히 내고 싶다. 1721-A1 원천징수 증빙을 사진으로 올려 자동 신고하길 원한다.
- **시티 (영세 자영업자, COMPANY-UMKM)**: 매달 매출/매입 영수증이 쌓인다. 0.5% 최종세를 자동 계산하고 eBilling으로 바로 납부하고 싶다.
- **PT Mitra (외부 세무사무소 컨설턴트)**: 수십 개 고객사를 관리한다. 자료 입력 시간을 줄이고, 팀장 승인 후 Coretax에 기록하는 흐름을 원한다.
- **운영팀 오퍼레이터**: 고객 제출 건을 검토하고 DJP에 제출, 접수증을 회수해 신고를 완료한다.

### 2.3 고객 유형별 진입 분기

같은 `/dashboard` URL이라도 `customer.customer_type`에 따라 서버 컴포넌트에서 화면을 분기한다.
- **INDIVIDUAL**: 개인 SPT 중심(1770SS / 1770S / 1770)
- **COMPANY**: 월 신고·결산 wizard 중심

---

## 3. 기능 요구사항 (Functional Requirements)

> 표기: FR-{모듈}-{번호}. 각 요구사항은 "사용자가 ~할 수 있다 / 시스템이 ~한다" 형태로 기술한다.

### 3.1 인증·계정 (AUTH)

| ID | 요구사항 |
|---|---|
| FR-AUTH-01 | 사용자는 이메일/비밀번호로 회원가입·로그인·비밀번호 찾기를 할 수 있다. |
| FR-AUTH-02 | 비밀번호 정책: 8자 이상, 대문자·소문자·숫자·특수문자 각 1개 이상. |
| FR-AUTH-03 | 사용자는 TOTP 기반 2단계 인증(2FA)을 등록·검증·해제할 수 있다(운영팀·관리자 권장). |
| FR-AUTH-04 | 시스템은 로그인/실패 이력을 감사 로그 기반으로 제공한다. |
| FR-AUTH-05 | 미인증 사용자가 보호 라우트 접근 시 로그인으로, 인증 사용자가 인증 라우트 접근 시 대시보드로 리다이렉트한다. |
| FR-AUTH-06 | 세션은 쿠키 기반으로 유지되며, API/E2E는 `Authorization: Bearer` 헤더도 허용한다. |

### 3.2 세무 계산 엔진 (CALC)

#### 3.2.1 연 신고 (SPT Tahunan)
| ID | 요구사항 |
|---|---|
| FR-CALC-01 | 시스템은 고객 프로필에 따라 적용 SPT 양식(1770SS/1770S/1770)을 자동 판별한다. |
| FR-CALC-02 | 1770SS(단순 근로소득), 1770S(혼합소득), 1770(사업소득) 계산을 지원한다. |
| FR-CALC-03 | 법인 1771은 계산 엔진을 보유하되 본 버전에서 UI 제출은 비활성한다. |
| FR-CALC-04 | 계산 시 PTKP(기초공제), 누진세율(2024 개정), BPJS를 자동 반영한다. |

#### 3.2.2 월 신고 (SPT Masa) 및 원천징수
| ID | 요구사항 |
|---|---|
| FR-CALC-10 | 원천징수 PPh 21(근로), 22(수입), 23(용역), 26(비거주자), 15(특정업종), 4(2)/Final을 계산한다. |
| FR-CALC-11 | PPh 21은 2024 개정 세율(TER 포함)을 적용한다. |
| FR-CALC-12 | 부가가치세(PPN)를 매출/매입(VAT OUT/IN) 기준으로 계산한다. |
| FR-CALC-13 | 영세사업자 최종세(PPh Final 0.5%, UMKM)를 계산한다. |
| FR-CALC-14 | 그로스업 계산, e-Bupot(전자증빙)·BPE(전자수령증) 처리를 지원한다. |
| FR-CALC-15 | 월별 신고를 집계해 연간 수치로 자동 합산한다(annual-aggregator). |

#### 3.2.3 연간 결산 (Closing)
| ID | 요구사항 |
|---|---|
| FR-CALC-20 | UMKM(PPh Final 0.5%) / PPh25(정상 법인세) 두 케이스의 8단계 결산 wizard를 제공한다. |
| FR-CALC-21 | 결산은 ID Billing 발급 → 납부 → DJP 제출 → BPE 수령 → 완료 순으로 진행한다. |
| FR-CALC-22 | 회계→세무 조정(koreksi fiskal)을 엔진으로 처리한다. |
| FR-CALC-23 | 결산 세션과 운영팀 큐는 링크로 연결되어 상태를 공유한다(상호 재오픈 가능). |

### 3.3 문서·OCR (DOC)

| ID | 요구사항 |
|---|---|
| FR-DOC-01 | 사용자는 Form 1721-A1, 세금계산서(Faktur Pajak), 인보이스를 사진/PDF로 업로드할 수 있다. |
| FR-DOC-02 | 시스템은 업로드 문서에서 항목을 자동 추출(OCR)해 신고 입력값으로 채운다. |
| FR-DOC-03 | 인보이스는 라인 단위(line-item)로 파싱해 저장한다(세션당 최대 500행). |
| FR-DOC-04 | AI 파싱 실패 시 6단계 단계적 대체(graceful fallback)로 mock 결과까지 복구해 흐름이 끊기지 않는다. |
| FR-DOC-05 | 업로드 시 `autoParse=true`면 인보이스 슬롯은 업로드 직후 파싱을 동기 실행하고, 실패해도 업로드는 롤백하지 않는다. |
| FR-DOC-06 | 컨설턴트/수퍼바이저는 라인별 검토 토글(✓)과 검토자 노트(최대 500자)를 기록할 수 있고, "전체 ✓/해제" 일괄 처리를 지원한다. |
| FR-DOC-07 | 문서는 비공개 버킷에 저장하고, 다운로드는 5분 만료 서명 URL로만 제공한다. |

### 3.4 CSV/Excel 대량 입력 (BULK)

| ID | 요구사항 |
|---|---|
| FR-BULK-01 | 사용자는 거래·직원 데이터를 CSV/Excel로 대량 업로드할 수 있다. |
| FR-BULK-02 | 시스템은 컬럼을 자동 매핑(column-mapper)하고, 표준 양식(PPh23/PPN/PPh26/PPh21 등) 임포터를 제공한다. |
| FR-BULK-03 | 임포트된 거래는 인라인 편집(PUT)으로 설명·거래처·금액·일자를 수정할 수 있으며, 금액 변경 시 세액을 재계산한다. |

### 3.5 신고 작성 위저드 (WIZARD)

| ID | 요구사항 |
|---|---|
| FR-WIZ-01 | 신고 작성은 5단계 위저드로 진행한다: 고객선택 → 소득데이터 → 공제 → 문서 → 검토. |
| FR-WIZ-02 | 각 단계는 선행조건 충족 시에만 다음 단계로 진행 가능하다(canProceed 검증). |
| FR-WIZ-03 | 위저드 상태는 클라이언트에 영속(persist)되어 새로고침 후에도 유지된다. |
| FR-WIZ-04 | 검토 단계에서 사용자는 계산 결과와 첨부를 최종 확인 후 제출한다. |

### 3.6 운영팀 신고 처리 워크플로우 (OPS)

11단계 상태머신: `PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED → EBILLING_GENERATED → PAYMENT_PENDING → PAYMENT_UPLOADED → PAYMENT_VERIFIED → DJP_SUBMITTED → BPE_UPLOADED → COMPLETED` (임의 상태에서 `FAILED` 가능).

| ID | 요구사항 |
|---|---|
| FR-OPS-01 | 고객 제출 후 운영자는 데이터 검토·승인요청·eBilling 발급·고객통지·입금확인·DJP 제출·BPE 업로드·완료를 수행한다. |
| FR-OPS-02 | 승인/반려는 수퍼바이저만 가능하며(PENDING_APPROVAL 상태), 재배정도 수퍼바이저 권한이다. |
| FR-OPS-03 | `PAYMENT_PENDING → PAYMENT_UPLOADED` 전이는 운영자 API가 아니라 고객의 입금증 업로드로만 발생한다. |
| FR-OPS-04 | 각 액션은 추가 페이로드(ebillingCode, bpeNumber, bpeDate, rejectedReason, failedReason)를 받는다. |
| FR-OPS-05 | 모든 전이는 감사 로그에 기록된다. |

### 3.7 Coretax / DJP 연동 (DJP)

| ID | 요구사항 |
|---|---|
| FR-DJP-01 | 기본은 수동 모드(운영자가 billingId/bpeNumber 직접 입력). |
| FR-DJP-02 | Coretax 자동 모드 활성 시, 값이 비어 있으면 `issueIdBilling()` / `submitSpt()`를 자동 호출한다. |
| FR-DJP-03 | 모든 Coretax 호출은 Circuit Breaker + 재시도(2회, 지수 백오프)로 감싸고, 4xx/5xx는 재시도하지 않으며 5회 연속 실패 시 30초간 차단한다. |
| FR-DJP-04 | 각 호출은 단계별 로그(요청/응답/소요시간/에러)와 케이스 감사 로그에 기록된다. |
| FR-DJP-05 | 운영자는 자동 모드에서도 값을 수동으로 덮어쓸 수 있다. |
| FR-DJP-06 | Coretax 활성 토글은 마스터가 운영 설정 UI에서 제어한다(DB 설정값 기반). |

### 3.8 멀티테넌트 세무사무소 ERP (ERP)

#### 3.8.1 컨설턴트 ERP (직원용)
| ID | 요구사항 |
|---|---|
| FR-ERP-01 | 컨설턴트는 세션(고객 건)을 보드에서 생성·관리한다(5단계 워크플로우). |
| FR-ERP-02 | 세션에 자료 업로드 → AI 파싱 → 자동 계산(PPh21 TER / 원천징수 / 월 법인세 / PPN / 은행대사) → 결재 → Coretax 기록을 처리한다. |
| FR-ERP-03 | 공동 거래처 DB(counterparty)는 사무소 간 공유 읽기를 허용하되, 등록·갱신은 컨설턴트 권한이 필요하다. |
| FR-ERP-04 | NPWP(납세번호) exact 매칭으로 추천 원천징수율과 신뢰점수를 반환한다. |
| FR-ERP-05 | 리갈리티(법적) 자료 보관함을 제공하고, 다운로드는 서명 URL(5분)로만 한다. |
| FR-ERP-06 | 접근은 `requireConsultantOrSupervisor` 미들웨어로 제한한다(그 외 403). |

#### 3.8.2 수퍼바이저 ERP (팀장용)
| ID | 요구사항 |
|---|---|
| FR-ERP-10 | 수퍼바이저는 승인 보드, 팀 현황, 고객, 수정요청, 리갈리티, 캘린더, Coretax, 품질, 설정 화면을 본다. |
| FR-ERP-11 | 승인 케이스 상세는 세션·고객·컨설턴트·문서·계산·파싱·승인·Coretax·트렌드·인보이스 라인을 통합 제공한다. |
| FR-ERP-12 | 리스크 점수(0~50) 휴리스틱으로 케이스 우선순위를 산정한다. |
| FR-ERP-13 | 마감일은 MONTHLY=다음달 20일, ANNUAL=다음해 4/30로 계산한다. |
| FR-ERP-14 | 재배정은 활성·동일 사무소·미완료 검증 후 처리하고 감사 행을 남긴다. |
| FR-ERP-15 | 사무소 설정은 `tax_partner.settings`(JSONB)에 부분 병합 저장한다(형제 키 보존). |

### 3.9 요금·결제 (BILLING)

3개 결제 surface, 각각 자체 설정·엔드포인트·DB 테이블:

| Surface | 대상 | 요금(IDR) | 주기 | Order ID |
|---|---|---|---|---|
| Corporate | 법인(COMPANY) | UMKM 50만 / Basic 150만 / Pro 300만 | 월 구독 | `CORP-` |
| Consultant tier | 외부 세무사무소 | Starter 100만 / Growth 300만 / Enterprise 800만 | 월 구독 | `CONS-` |
| Individual SPT | 개인(INDIVIDUAL) | 1770SS 10만 / 1770S 20만 / 1770 30만 | 건당 | `PAY-` |

| ID | 요구사항 |
|---|---|
| FR-BILL-01 | VAT 11%는 별도 부과한다. |
| FR-BILL-02 | Midtrans Snap 호출 실패 또는 PG 미연동 시, PENDING_PAYMENT 행을 보존하고 `snapToken: null` + `snapError`를 반환한다(graceful degrade). 사용자는 나중에 재시도 가능. |
| FR-BILL-03 | 단일 Midtrans 웹훅이 Order ID 접두사로 라우팅해 올바른 테이블을 갱신한다. |
| FR-BILL-04 | 실 결제는 `MIDTRANS_IS_PRODUCTION='true'`일 때만 동작하며, 기본은 sandbox(`NODE_ENV`를 신호로 쓰지 않음). |
| FR-BILL-05 | Pro·Enterprise 한도 초과 고객은 마스터가 맞춤 견적(custom pricing quote)을 발행하고, 고객이 수락하는 흐름을 제공한다. |

### 3.10 위임장 (POA)

| ID | 요구사항 |
|---|---|
| FR-POA-01 | 고객은 위임장(Power of Attorney)을 생성·서명하고, 세무사무소가 서명한다. |
| FR-POA-02 | 신고 제출은 유효한 POA 검증을 거친다(`requireValidPOA`). |

### 3.11 CRM·고객관리 (CRM)

| ID | 요구사항 |
|---|---|
| FR-CRM-01 | 컨설턴트는 고객을 생성·조회·수정한다(고객 상세: 프로필/신고/POA/노트/활동 탭). |
| FR-CRM-02 | 고객 노트는 CRUD + 핀(pin)을 지원한다. |
| FR-CRM-03 | 고객 목록은 유형·POA 상태 필터, 이름·날짜·신고수 정렬, 페이지네이션을 지원한다. |
| FR-CRM-04 | `customer.user_id`는 nullable이어서, 컨설턴트가 auth 계정 없이 고객을 등록할 수 있다. |

### 3.12 부가 기능 (MISC)

| ID | 요구사항 |
|---|---|
| FR-MISC-01 | AI 세무 챗봇으로 납세자 질의에 응대한다(`/chat`). |
| FR-MISC-02 | 고객↔AI 상담원 인박스(페르소나 마스킹 포함)를 제공한다. |
| FR-MISC-03 | 자문(advisory) API로 PKP/UMKM/조세조약 관련 응답을 제공한다. |
| FR-MISC-04 | 뉴스, 마켓플레이스, 추천(referral), 알림, 리포트, 자산, 거래처 관리 화면을 제공한다. |
| FR-MISC-05 | 관리자 모니터링 대시보드(에러·서킷브레이커·메모리·활동)를 제공한다. |

---

## 4. 주요 사용자 흐름 (User Flows)

### 4.1 개인 근로소득자 연 신고
1. 로그인 → 대시보드(INDIVIDUAL 분기)
2. 신고 시작 → 시스템이 적용 양식(1770SS) 자동 판별
3. 1721-A1 사진 업로드 → OCR 자동 입력
4. 위저드 5단계(소득→공제→문서→검토) 진행
5. 제출 → 운영팀 큐 진입(PENDING)
6. 운영팀 검토·승인·eBilling 발급
7. 고객 입금 → 입금증 업로드(PAYMENT_UPLOADED)
8. 운영팀 입금확인 → DJP 제출 → BPE 업로드 → 완료
9. 고객은 BPE(전자접수증)로 신고 완료 확인

### 4.2 영세 자영업자 월 신고·결산
1. 매달 매출/매입 영수증 사진 업로드 → OCR
2. PPh Final 0.5% 자동 계산 → eBilling 납부
3. 연말 8단계 결산 wizard로 마감(ID Billing→납부→제출→BPE→완료)

### 4.3 외부 세무사무소 처리
1. 컨설턴트가 ERP 보드에서 세션 생성
2. 자료 업로드 + autoParse로 인보이스 라인 자동 추출
3. 자동 계산 → 라인별 검토(✓)
4. 팀장(수퍼바이저) 승인
5. Coretax 외부 처리 후 수기 기록

---

## 5. 데이터 모델 (핵심 엔티티 개요)

| 그룹 | 주요 테이블/엔티티 |
|---|---|
| 조직 | `platform_owner`, `platform`, `tax_partner`(JTC/EXTERNAL) |
| 인력 | `consultant`, `tax_advisor` |
| 고객 | `customer`(INDIVIDUAL/COMPANY, `user_id` nullable), `customer_note` |
| 신고·문서 | `tax_filing`, `tax_document`, 결산 세션(`annual_closing_session`) |
| 운영 큐 | `djp_submission_queue`(11상태), `coretax_step_log`, `case_audit_log`, `djp_queue_closing_link` |
| ERP | `consultant_session`(+자식), `counterparty_master`(+자식), `legality_document`, `consultant_session_invoice_line` |
| 결제 | `customer_subscription`, `tax_partner_subscription`, `billing_transaction`, `custom_pricing_quote` |
| 거버넌스 | `power_of_attorney`, `audit_log`, `system_setting` |

멀티테넌트 격리: `consultant`는 정확히 하나의 `tax_partner`에 귀속되며, RLS 함수 `get_consultant_tax_partner_id()`로 사무소 간 데이터 교차를 차단한다.

---

## 6. 비기능 요구사항 (Non-Functional Requirements)

### 6.1 보안 (5대 하드룰 — 협상 불가)

| ID | 규칙 | 강제 수단 |
|---|---|---|
| NFR-SEC-01 | PLATFORM_ADMIN은 고객 세무 데이터 접근 불가 | `blockPlatformAdmin` 미들웨어 + RLS |
| NFR-SEC-02 | 컨설턴트는 등록된 tax_partner에만 귀속(교차 금지) | FK + RLS |
| NFR-SEC-03 | 신고 제출 주체 ≠ 플랫폼 관리 주체 | 역할 분리 |
| NFR-SEC-04 | 결제 수금 주체 ≠ 서비스 제공 주체 | `SYSTEM` 역할 전용 |
| NFR-SEC-05 | 모든 쓰기 조치는 감사 로그 기록 | `withAudit` 미들웨어 |

- **2계층 방어**: API 미들웨어(1차 게이트) + Supabase RLS(최종 게이트).
- 감사 로그 7년 보존, 2FA(TOTP), 강력한 비밀번호 정책.

### 6.2 회복력 (Resilience)

| ID | 요구사항 |
|---|---|
| NFR-RES-01 | 외부 API(DJP·Midtrans·AI) 호출은 Circuit Breaker로 장애를 격리한다. |
| NFR-RES-02 | 중복 결제·중복 제출은 Idempotency Key로 방지한다. |
| NFR-RES-03 | 외부 의존 실패 시 Graceful Degrade로 데이터 유실 없이 보류·재개한다. |
| NFR-RES-04 | 타임아웃 + 지수 백오프 재시도를 적용한다. |

### 6.3 관측성 (Observability)

| ID | 요구사항 |
|---|---|
| NFR-OBS-01 | 모든 서버 코드는 pino 구조화 로깅을 사용한다(서버 코드 내 `console.log` 금지). |
| NFR-OBS-02 | API 미들웨어는 응답 시간 측정, 요청 로깅, `Server-Timing` 헤더, 5xx Sentry 보고를 자동 수행한다. |
| NFR-OBS-03 | Web Vitals(LCP/FID/CLS/FCP/TTFB/INP)를 수집해 Sentry로 전송한다. |
| NFR-OBS-04 | Circuit Breaker 상태 변화를 Sentry에 보고한다. |

### 6.4 국제화 (i18n)

| ID | 요구사항 |
|---|---|
| NFR-I18N-01 | 5개 언어를 지원한다: 인도네시아어(기본), 영어, 한국어, 일본어, 중국어. |
| NFR-I18N-02 | 모든 사용자 노출 문자열은 메시지 파일로 분리하고 `useTranslations()`로 렌더한다. |

### 6.5 성능·아키텍처

| ID | 요구사항 |
|---|---|
| NFR-PERF-01 | 가능한 한 서버 컴포넌트를 사용하고, 필요한 경우에만 클라이언트 컴포넌트를 쓴다. |
| NFR-PERF-02 | 서버 액션 바디 한도 10MB, 문서 업로드 한도 20MB(비공개 버킷). |
| NFR-PERF-03 | SPT PDF는 서버에서 `renderToBuffer()`로 생성한다. |

### 6.6 규정·감사

| ID | 요구사항 |
|---|---|
| NFR-COMP-01 | 모든 신고·결제·승인 트랜잭션은 추적 가능해야 한다(감사 로그). |
| NFR-COMP-02 | 인도네시아 세법(세율·공제·양식)의 변경을 계산 엔진에 반영할 수 있어야 한다. |

---

## 7. 기술 스택 (참고)

| 영역 | 기술 |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript strict |
| DB/Auth | Supabase (PostgreSQL + Auth + RLS) |
| UI | shadcn/ui + Tailwind CSS 4 + Radix UI |
| i18n | next-intl (id/en/ko/ja/zh) |
| 결제 | Midtrans Snap |
| 이메일 | Resend |
| AI/OCR | Anthropic SDK + OpenAI |
| PDF | @react-pdf/renderer |
| 상태/데이터 | TanStack Query + Zustand |
| 폼/검증 | React Hook Form + Zod 4 |
| 로깅/모니터링 | pino + Sentry |
| 테스트 | Vitest(단위) + Playwright(E2E) |

---

## 8. 품질·검증 (Acceptance & Testing)

| ID | 요구사항 |
|---|---|
| FR-QA-01 | 단위 테스트는 계산 모듈과 미들웨어에 colocate한다(Vitest). |
| FR-QA-02 | E2E(Playwright)는 역할별 접근 게이트와 핵심 흐름을 검증한다. |
| FR-QA-03 | 통합 스모크 러너로 멀티테넌트 격리, 운영 큐 11상태, 3개 결제 surface, 임포터, 인보이스 파싱, 스키마 드리프트 등을 회귀 검증한다. |
| FR-QA-04 | 모든 세무 데이터 엔드포인트는 `composeMiddleware()`로 인증·RBAC·감사를 강제하며, `blockPlatformAdmin`을 포함해야 한다. |

---

## 9. 용어 (Glossary)

| 용어 | 의미 |
|---|---|
| SPT | 인도네시아 세금 신고서(Surat Pemberitahuan) |
| SPT Masa / Tahunan | 월 신고 / 연 신고 |
| PPh | 소득세(원천징수 포함, 21/22/23/25/26/15/4(2)) |
| PPN | 부가가치세 |
| UMKM | 영세·중소사업자(최종세 0.5% 대상) |
| PTKP | 기초공제 |
| DJP | 인도네시아 국세청 |
| Coretax | DJP 통합 세정 시스템(2025 도입) |
| eBilling / ID Billing | 전자납부 코드 |
| BPE | 전자접수증(Bukti Penerimaan Elektronik) |
| Faktur Pajak | 세금계산서 |
| NPWP | 납세자번호 |
| POA | 위임장(Power of Attorney) |
| RLS | 행 단위 접근제어(Row Level Security) |

---

> 본 문서는 현재 코드베이스(`CLAUDE.md`, `README.md`, `docs/`) 기준의 제품 요구사항 명세이며, 세부 수치·요금·세율은 운영 정책과 인도네시아 세법 개정에 따라 갱신된다.
