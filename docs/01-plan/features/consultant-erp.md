# Consultant ERP — Phase별 상세 설계

> 출처: `Ai Pajak 세무컨설턴트 ERP_직원용.pdf` (35p, 2026-05-16 와이어프레임)
> 5개 확정 결정: MVP=A · AI=Claude Sonnet 4.6 · 결재 1단 · i18n ko+id · 세법룰 DB hybrid

---

## 0. 책임 분리 (기존 시스템과의 경계)

| 시스템 | 사용자 | 데이터 모델 | 책임 |
|---|---|---|---|
| **Consultant ERP (이번 작업)** | EXTERNAL 사무소 컨설턴트 + JTC 컨설턴트 | `consultant_session` 5-step | 고객 자료 수집 → AI 파싱 → 자동계산 → supervisor 결재 → Coretax 수기 기록 |
| **Operator Queue (기존)** | JTC 운영팀 (TAX_OPERATOR*) | `djp_submission_queue` 11-state | 고객이 결제·서명한 신고 패키지를 DJP에 실제 제출 |
| **Customer Portal (기존)** | INDIVIDUAL/COMPANY 고객 | 다양 | 자료 업로드·결제·BPE 확인 |

→ ERP 세션이 완료(supervisor 승인 + Coretax 기록)되면 운영팀 큐에 자동 등록되지 않음. ERP는 자체 완결 흐름이며, 운영팀 큐는 별도 트리거(고객 결제 이후)로 시작.

---

## 1. 데이터베이스 스키마 (P0)

### 1.1 `consultant_session` — 월/연 신고 단위
```sql
CREATE TABLE consultant_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id),
  tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),
  consultant_id UUID NOT NULL REFERENCES consultant(id),  -- 담당자
  supervisor_id UUID REFERENCES consultant(id),           -- 검토자
  filing_kind VARCHAR(10) NOT NULL,  -- MONTHLY | ANNUAL
  tax_period DATE NOT NULL,           -- 월: 1일, 연: 1/1
  current_step SMALLINT NOT NULL DEFAULT 1,  -- 1=고객선택, 5=Coretax기록
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | UPLOADING | PARSING | REVIEWING | PENDING_APPROVAL
    -- | APPROVED | REJECTED | COMPLETED | CANCELLED
  total_estimated_tax NUMERIC(18,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, filing_kind, tax_period)
);

CREATE INDEX idx_consultant_session_consultant ON consultant_session(consultant_id, status);
CREATE INDEX idx_consultant_session_supervisor ON consultant_session(supervisor_id, status) WHERE status = 'PENDING_APPROVAL';
```

RLS:
- consultant 본인 + 같은 tax_partner 의 supervisor 만 read/write
- PLATFORM_ADMIN: 차단

### 1.2 `consultant_session_document` — 6 슬롯 자료
```sql
CREATE TYPE document_slot AS ENUM (
  'PAYROLL', 'WITHHOLDING_INVOICE', 'CORP_TAX_INPUT',
  'VAT_IN_OUT', 'OTHER_REFERENCE', 'BANK_STATEMENT'
);

CREATE TABLE consultant_session_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  slot document_slot NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  version SMALLINT NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  parse_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING | PARSING | PARSED | FAILED
  parse_confidence SMALLINT,  -- 0-100
  ai_model_version TEXT
);

CREATE UNIQUE INDEX idx_doc_session_slot_active
  ON consultant_session_document(session_id, slot, version);
```

### 1.3 `consultant_session_parse_row` — 행 단위 검토
```sql
CREATE TYPE parse_severity AS ENUM ('CRITICAL', 'WARNING', 'INFO', 'OK');

CREATE TABLE consultant_session_parse_row (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES consultant_session_document(id) ON DELETE CASCADE,
  row_index INT NOT NULL,           -- 원본 자료의 행 번호
  entity_label TEXT,                -- e.g. "Minho Kim", "INV-043"
  field_name TEXT NOT NULL,         -- "npwpNik", "ptkp", "bankAccount"
  field_value JSONB,
  severity parse_severity NOT NULL,
  issue_code TEXT,                  -- "PTKP_INVALID", "BPJS_KES_MISSING"
  message_ko TEXT,
  message_id TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  client_message_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_parse_row_doc_severity
  ON consultant_session_parse_row(document_id, severity)
  WHERE is_resolved = FALSE;
```

### 1.4 `consultant_session_calc` — 자동계산 결과
```sql
CREATE TYPE calc_kind AS ENUM (
  'PPH21_TER', 'WITHHOLDING_SUMMARY', 'CORP_TAX_MONTHLY',
  'PPN_NET', 'BANK_RECON'
);

CREATE TABLE consultant_session_calc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  kind calc_kind NOT NULL,
  amount NUMERIC(18,2),
  basis JSONB NOT NULL,                -- 계산 근거 (input + intermediate)
  source_summary TEXT,                  -- e.g. "Gross payroll Rp 94M 기준"
  rationale_summary TEXT,
  confidence SMALLINT,                  -- 0-100
  consultant_memo TEXT,
  is_saved BOOLEAN DEFAULT FALSE,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, kind)
);
```

### 1.5 `consultant_session_approval` — 1단 결재
```sql
CREATE TYPE approval_action AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW');

CREATE TABLE consultant_session_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role VARCHAR(40) NOT NULL,
  comment TEXT,
  snapshot JSONB NOT NULL,             -- 승인 시점의 전체 계산값 + 행수 등 snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_session ON consultant_session_approval(session_id, created_at DESC);
```

### 1.6 `consultant_session_coretax_record` — Coretax 수기 기록
```sql
CREATE TABLE consultant_session_coretax_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES consultant_session(id) ON DELETE CASCADE,
  id_billing TEXT,
  ntpn TEXT,
  bpe_file_path TEXT,
  bpe_uploaded_at TIMESTAMPTZ,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);
```

### 1.7 `counterparty_master` — 공동 거래처 DB
```sql
CREATE TABLE counterparty_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npwp TEXT UNIQUE,                    -- 인도 거래처의 1차 키
  nib TEXT,
  name TEXT NOT NULL,
  aliases TEXT[],
  country VARCHAR(2) NOT NULL DEFAULT 'ID',
  kbli TEXT,
  business_description TEXT,
  pkp_status VARCHAR(20),              -- VERIFIED | UNVERIFIED | NON_RESIDENT
  suggested_pph_type TEXT,             -- "PPh 23", "PPh 4(2) Construction (B)", "PPh 26"
  suggested_tax_rate NUMERIC(5,2),
  evidence_sources JSONB,              -- 출처별 trust score
  overall_trust SMALLINT NOT NULL DEFAULT 50,   -- 0-100
  registered_by UUID REFERENCES consultant(id), -- 최초 등록자
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_counterparty_npwp ON counterparty_master(npwp);
CREATE INDEX idx_counterparty_country ON counterparty_master(country);
```

### 1.8 `counterparty_attribute_trust` — 필드별 신뢰도
```sql
CREATE TABLE counterparty_attribute_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id UUID NOT NULL REFERENCES counterparty_master(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,            -- "kbli", "pkp_status", "suggested_pph_type"
  field_value TEXT,
  trust_score SMALLINT NOT NULL,       -- 0-100
  source TEXT,                          -- "INVOICE_INV-043", "OSS_DB", "AI_INFERENCE"
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (counterparty_id, field_name)
);
```

### 1.9 `counterparty_update_candidate` — 업데이트 후보
```sql
CREATE TABLE counterparty_update_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id UUID REFERENCES counterparty_master(id),  -- 신규 후보면 NULL
  proposed_payload JSONB NOT NULL,     -- {name, npwp, kbli, ...}
  evidence_session_id UUID REFERENCES consultant_session(id),
  evidence_document_id UUID REFERENCES consultant_session_document(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',  -- PROPOSED | APPROVED | REJECTED
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  proposed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.10 `legality_document` — 리갈리티 자료
```sql
CREATE TYPE legality_category AS ENUM (
  'AKTA_PENDIRIAN', 'AKTA_PERUBAHAN', 'NIB_OSS',
  'LICENSE_SBU_SKK', 'COMPANY_NPWP', 'CORETAX_ACCESS'
);

CREATE TABLE legality_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  category legality_category NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  storage_path TEXT,
  original_filename TEXT,
  valid_until DATE,
  note TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  version SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_legality_customer_cat ON legality_document(customer_id, category, version DESC);
```

---

## 2. RBAC 정책

| 행동 | CONSULTANT (자기 고객만) | SUPERVISOR (같은 tax_partner) | TAX_OPERATOR | PLATFORM_ADMIN |
|---|---|---|---|---|
| 세션 생성·자료업로드 | ✓ | ✓ | ✗ | ✗ |
| 파싱·자동계산 | ✓ | ✓ | ✗ | ✗ |
| 결재 제출 (SUBMIT) | ✓ | ✓ | ✗ | ✗ |
| 결재 승인/반려 (APPROVE/REJECT) | ✗ | ✓ (다른 컨설턴트가 만든 세션만) | ✗ | ✗ |
| Coretax 수기 기록 | ✓ (승인 후) | ✓ | ✗ | ✗ |
| 공동 거래처 DB 조회 | ✓ | ✓ | ✓ (조회만) | ✗ |
| 공동 거래처 등록 후보 제출 | ✓ | ✓ | ✗ | ✗ |
| 공동 거래처 master 갱신 | ✗ | ✓ (review) | ✗ | ✗ |
| 리갈리티 자료 read/write | ✓ | ✓ | ✗ | ✗ |

새 middleware: `requireConsultantOrSupervisor()`. tax_partner_id 같은지 RLS 정책으로 추가 검증.

---

## 3. Phase별 산출물 + Wireframe

### Phase 0 — 골격 (0.5일)
- 6 마이그레이션 + RLS
- `(dashboard)/consultant-erp/{dashboard,work,legality,counterparty}/page.tsx` 빈 골격
- 사이드바에 4 메뉴 (CONSULTANT + TAX_OPERATOR_SUPERVISOR 에만 표시)
- `requireConsultantOrSupervisor` 미들웨어

**산출**: 빈 페이지 4개 + DB 마이그레이션 적용. e2e smoke test 1개 (CONSULTANT 로그인 → 4 페이지 모두 200).

### Phase 1 — MVP=A (2~3일)

**1.1 Dashboard 페이지** (`/consultant-erp/dashboard`)
- 4 통계 카드: 전체고객 / 진행고객 / 자료업로드 / 검토완료
- 고객별 업무 현황판: 고객명 · 담당 · 진행업무 · 자료상태(업로드N/파싱N/검토N) · ACTION(고객 열기)
- API: `GET /api/consultant-erp/sessions/board?consultantId=me`

**1.2 업무처리 5-step 페이지** (`/consultant-erp/work`)
- 고객 dropdown + 검색 + 진행상태 표시
- 선택 고객 카드 (담당/수퍼바이저/NPWP)
- 업무 시작 박스: 신고구분 토글(월/연) + 과세월 + "월신고 자료업로드 시작" 버튼
- 5-step navigator (1.고객선택 / 2.자료업로드 / 3.파싱검토·자동계산 / 4.수퍼바이저 승인대기 / 5.Coretax기록)
- 각 step 활성/비활성 + 현재 step 표시

**1.3 Step 2 — 자료 업로드**
- 6 카드 grid (PAYROLL / WITHHOLDING_INVOICE / CORP_TAX_INPUT / VAT_IN_OUT / OTHER_REFERENCE / BANK_STATEMENT)
- 카드별: 슬롯명 + 확장자 안내 + 필수/참고 뱃지 + 업로드/수정본 업로드 버튼 + 버전 이력 (▶ 이력 보기)
- 진행률 바 (필수자료 N/5)
- API: `POST /api/consultant-erp/sessions/:id/documents`, `GET …/documents`, `POST …/documents/:slot/version`

**1.4 Step 4 — 수퍼바이저 승인 (P1 핵심)**
- Snapshot 카드: PPh21 / 원천세 / 법인세 월납부 / NET PPN + 검증 통계 + 상신완성도
- 4 자동계산 카드 (PPH21_TER / WITHHOLDING / CORP_TAX_MONTHLY / PPN_PPnBM): 금액 + 컨설턴트 메모 + 신뢰도
- DECISION 박스: 상태 / 상신차수 / 총 자동계산액 / 담당 / 의견 textarea / [승인] [의견 달고 반려] 두 버튼
- 상신/반려 이력 테이블

**1.5 Step 5 — Coretax 수기 기록**
- 헤더: 고객명/NPWP/기간 + "Manual Coretax Process" 뱃지 + "Coretax 열기" 버튼 (Coretax 외부 URL)
- 폼: ID BILLING / NTPN / BPE 파일명(파일업로드) + 결과 저장 / 업무완료 버튼

**P1 데이터 흐름**:
1. consultant가 세션 생성 → DRAFT
2. 자료 업로드 → UPLOADING → 다 채워지면 자동 PARSING (P1은 가짜 PARSED 처리)
3. supervisor에게 상신 → PENDING_APPROVAL
4. supervisor 승인 → APPROVED
5. consultant가 Coretax 외부에서 처리 후 결과 입력 → COMPLETED

### Phase 2 — 자동계산 wiring (1~2일)

기존 `src/lib/tax/` 모듈을 그대로 사용해 `consultant_session_calc` 자동 채움:
- PPH21_TER: `pph21-calculator.ts` (TER 방식, gross payroll → 월 PPh21)
- WITHHOLDING_SUMMARY: 인보이스 행에서 PPh 유형별 합산
- CORP_TAX_MONTHLY: `annual-regime.ts` `determineAnnualRegime()` + Final/PPh25 듀얼 케이스 UI
- PPN_NET: `ppn-calculator.ts` (Output - Input)
- BANK_RECON: 제출자료 합계 vs 통장 합계 비교

각 카드 컴포넌트:
- 입력값 표시(읽기 전용 source 참조)
- 자동계산값 (확신도 + memo)
- 컨설턴트 수동 override 입력
- "이 자료를 검토완료로" 토글

법인세 듀얼 케이스 UI:
- 좌: PPh Final 케이스 (월매출 입력 → 연환산 → 0.5%)
- 우: PPh25 케이스 (전년 납부세액 입력 → 1/12)
- 케이스별 체크박스 1개만 선택 가능
- 선택 결과 요약 박스 (선택 케이스 + PPh Final 세액 + PPh25 세액)
- "법인세 월납부 판단근거" 영역 (선택값 + NPWP 경과기간 + 신뢰도)

### Phase 3 — AI 파싱 (3~4일)

`scripts/parse-consultant-document.ts` (또는 endpoint) 새로 작성:
- input: `consultant_session_document.id` + storage_path
- model: `claude-sonnet-4-6` streaming (max_tokens 16000)
- slot별 다른 프롬프트:
  - PAYROLL → 직원별 행 + NPWP/NIK/PTKP/BPJS/입사일/세금방식/은행계좌 등 검증
  - WITHHOLDING_INVOICE → 거래처 + DPP/PPN/Gross + WHT base + 추천 PPh 유형
  - VAT_IN_OUT → Faktur Pajak 전체 → Output/Input/DPP/VAT/Status
  - BANK_STATEMENT → 거래 행 → 자료 간 대사용
- output: `consultant_session_parse_row` 다수 행 + `severity` + `issue_code` + `message_*`

행 단위 룰(`lib/consultant-erp/parse-row-rules.ts`):
- `npwpNik=null` → CRITICAL
- `ptkp` 미정의 → CRITICAL
- `bpjsKesEmployee` 누락 → WARNING
- `bankAccount` 누락 → INFO
- `residency='Expat'` + 거주자판정 누락 → CRITICAL

고객 확인요청 메시지(`lib/consultant-erp/client-message-builder.ts`):
- 같은 client_message_sent=false 행을 모아 markdown 생성
- "안녕하세요. 4명의 급여자료를 파싱한 결과 아래 항목의 확인이 필요합니다…"
- "복사" 버튼 / "고객확인 요청" 버튼 (메시지 발송 후 client_message_sent=true)

### Phase 4 — 공동 거래처 DB (2일)

**4.1 매칭 흐름**:
- WITHHOLDING_INVOICE 파싱 시 NPWP로 `counterparty_master` lookup
- 매칭 → `counterparty_attribute_trust.trust_score` 가중 평균 → 전체 신뢰도
- KBLI + 거래유형 → PPh 유형 후보 자동
- DGT Form 필요 여부 자동 감지 (`country != 'ID'` + Treaty 가능성)

**4.2 공동 거래처 DB 페이지** (`/consultant-erp/counterparty`)
- 헤더 4 통계: 등록 거래처 N / 평균 신뢰도 / 검토대기 / 증빙완료(N/M)
- 좌: 검색 input + 회사명/NPWP/NIB/KBLI list
- 우: 선택 거래처 상세
  - 라인: Trust 뱃지 + 고객사 자동등록 · 증빙자료 필요 뱃지
  - 회사명 + NPWP + 국가 / PKP / KBLI / Last verified
  - 원천세 PROFILE: 적용 가능 PPh 유형 + 판단근거
  - QUICK SUMMARY: Aliases + Evidence + 첨부 + 등록 출처
  - 필드별 출처/신뢰도 테이블 (Client Master / NPWP / NIB/OSS / KBLI / License)
- 탭: 거래처 검색 / 업데이트 후보 / 신규업체 등록

### Phase 5 — 리갈리티 자료 (1일)

`/consultant-erp/legality`
- 좌: 고객 검색 + 내 관리 법인고객 dropdown
- 우 통계: 고객사 / NPWP / 담당 / 완성도(%) / 만료관리
- 본문 grid:
  - 좌: 6 카테고리(정관/법인설립 → 사업허가 → 세무등록 → 자격증·라이센스 → …) 카드, 카드별 업로드/추가업로드/미리보기 + 필수 뱃지
  - 우: 선택 문서 미리보기(PDF viewer placeholder) + 그룹/필수/유효기간/만료일 datepicker / 보관메모

### Phase 6 — i18n + e2e (1일)

- `consultantErp` namespace 추가 — 새 키 ~150개
- `scripts/i18n-auto-translate.ts --namespace=consultantErp --apply` (en/id/zh/ja 채우기, 단 메모리 결정상 ko+id 우선이라 id만 검수)
- e2e:
  - `consultant-erp.spec.ts` — 4 페이지 진입 + 5-step 모두 클릭 + 상태 전이
  - `scripts/test-consultant-erp-flow.ts` — 회귀 (세션 생성 → 자료 업로드 → 파싱 → 승인 → Coretax 기록)

---

## 4. API 엔드포인트 정리

```
GET    /api/consultant-erp/sessions/board?consultantId=me
GET    /api/consultant-erp/sessions
POST   /api/consultant-erp/sessions                       { customerId, filingKind, taxPeriod }
GET    /api/consultant-erp/sessions/:id
PATCH  /api/consultant-erp/sessions/:id                   { currentStep?, status? }
POST   /api/consultant-erp/sessions/:id/documents         multipart
GET    /api/consultant-erp/sessions/:id/documents
POST   /api/consultant-erp/sessions/:id/parsing           { documentId? }
GET    /api/consultant-erp/sessions/:id/parse-rows
PATCH  /api/consultant-erp/sessions/:id/parse-rows/:rowId { isResolved, resolutionNote? }
POST   /api/consultant-erp/sessions/:id/calc/:kind        { override? }
GET    /api/consultant-erp/sessions/:id/calc
POST   /api/consultant-erp/sessions/:id/approval          { action, comment? }
POST   /api/consultant-erp/sessions/:id/coretax-record    { idBilling, ntpn, bpeFile }

GET    /api/consultant-erp/counterparty?q=&country=
GET    /api/consultant-erp/counterparty/:id
POST   /api/consultant-erp/counterparty                   { … }
POST   /api/consultant-erp/counterparty/:id/candidates    { proposedPayload, evidence* }
POST   /api/consultant-erp/counterparty/match             { npwp }    → trust + suggested PPh

GET    /api/consultant-erp/legality?customerId=
POST   /api/consultant-erp/legality                       multipart
PATCH  /api/consultant-erp/legality/:id                   { validUntil?, note? }
```

모든 endpoint는 `composeMiddleware(requireAuth, blockPlatformAdmin, requireConsultantOrSupervisor, withAudit('CONSULTANT_ERP_*'))`.

---

## 5. i18n 키 개요 (`consultantErp` namespace, ko 우선)

```
sidebar.dashboard
sidebar.work
sidebar.legality
sidebar.counterparty

board.totalCustomers, board.activeCustomers, board.uploaded, board.reviewed
board.columns.customer, board.columns.consultant, board.columns.task, …

work.headline, work.dropCustomerLabel, work.startMonthlyBtn, work.startAnnualBtn
work.steps.{1..5}

upload.slot.PAYROLL.title / .desc / .accept
upload.slot.WITHHOLDING_INVOICE.{title,desc,accept}
… (6 슬롯)
upload.progressLabel
upload.requiredBadge, upload.optionalBadge

parse.row.severity.CRITICAL/WARNING/INFO
parse.issue.PTKP_INVALID, parse.issue.BPJS_KES_MISSING, …
parse.clientMessage.template

calc.kind.PPH21_TER, calc.kind.WITHHOLDING_SUMMARY, …
calc.dualCase.title, calc.dualCase.pphFinalTitle, calc.dualCase.pph25Title
calc.dualCase.selectFinal, calc.dualCase.selectPph25

approval.snapshotTitle, approval.actionApprove, approval.actionReject
approval.commentPlaceholder, approval.history

coretax.title, coretax.manualBadge, coretax.openBtn
coretax.field.idBilling, coretax.field.ntpn, coretax.field.bpeFile

counterparty.headline, counterparty.searchPlaceholder
counterparty.field.trust, counterparty.field.profile, counterparty.field.lastVerified
counterparty.tabs.search, counterparty.tabs.candidates, counterparty.tabs.register

legality.headline, legality.category.AKTA_PENDIRIAN, …
legality.requiredBadge, legality.optionalBadge, legality.validUntilLabel
```

총 ~150 키 예상.

---

## 6. 위험 & 미결 사항

1. **EXTERNAL 사무소가 등록한 거래처가 JTC에도 보이는지** — PDF상 "공동" 명시이므로 cross-tenant 공유. 다만 `registered_by` 추적 + audit log 필수. 별도 노출 정책(예: 외부 NPWP만 공유)이 필요할지 사용자 확인.
2. **법인세 듀얼 케이스 결정값이 운영팀 큐로 전달되는지** — 책임 분리상 ERP 완결이지만, 결산 wizard와의 연결고리는 별도 작업.
3. **AI 파싱 비용** — 6 슬롯 × 평균 8K 토큰 × 1500원/세션 정도. 월 100 세션 = ~15만원/월. P3 진입 전 cost 가드(파싱 큐 + retry policy + 토큰 사용량 모니터링).
4. **Coretax 외부 처리 결과 검증 자동화** — P1은 수기 기록만. 향후 BPE PDF에서 NTPN OCR → 자동 매칭.
5. **세션 만료/잠금** — 같은 (customer, filing_kind, tax_period)에 두 컨설턴트가 동시 작업 시 충돌. P1은 UNIQUE 제약 + UI에서 다른 사용자 작업 중 표시.

---

## 7. P0 즉시 착수 체크리스트

- [ ] 6 마이그레이션 작성 (`supabase/migrations/20260516_*.sql`)
- [ ] `consultant_session` RLS 정책
- [ ] `(dashboard)/consultant-erp/` 4 페이지 골격
- [ ] `middleware/requireConsultantOrSupervisor.ts`
- [ ] `sidebar.tsx`에 4 메뉴 (CONSULTANT + TAX_OPERATOR_SUPERVISOR 노출)
- [ ] e2e smoke: CONSULTANT 로그인 → 4 페이지 200
- [ ] CLAUDE.md "Consultant ERP" 섹션 추가

→ P0 완료 후 P1 착수.
