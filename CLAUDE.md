# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

사용자와의 대화는 항상 **한국어**로 응답한다. 코드, 변수명, 커밋 메시지는 영어를 유지한다.

## What This Is

AI Pajak — Indonesian tax filing automation platform for Jakarta Tax Consulting (JTC). Supports SPT forms 1770SS, 1770S, 1770, 1771. Written in Korean (README/docs) but the code is in English.

## Commands

```bash
npm run dev                # Dev server (Turbopack — Next.js 16 default)
npm run build              # Production build
npm run lint               # ESLint
npm test                   # Vitest unit tests
npm run test:watch         # Vitest watch mode
npm run test:coverage      # Vitest with coverage

# Single test file
npx vitest run src/lib/tax/spt-1770ss/calculator.test.ts

# E2E (requires running dev server + Supabase)
npm run test:e2e                    # All Playwright tests

# Single spec against prod (accounts pre-seeded; skips local seeding)
E2E_SKIP_GLOBAL_SETUP=1 BASE_URL=https://ai-pajak.vercel.app npx playwright test firm-admin.spec.ts
npm run test:e2e:customer           # Customer role only
npm run test:e2e:consultant         # Consultant role only
npm run test:e2e:tax-advisor        # Tax advisor role only
npm run test:e2e:platform-admin     # Platform admin role only
npm run test:e2e:system             # System role only
npm run test:e2e:audit              # Audit trail tests
npm run test:e2e:operator           # Operator workflow tests

# Smoke regression (prod or local Supabase) — see "Verification / regression scripts" section below
npm run test:smoke                  # local Supabase
npm run test:smoke:prod             # .env.production.local (default first command for verification)

# Database
supabase start             # Local Supabase
supabase migration up      # Apply migrations
supabase db reset          # Reset & re-seed
npm run db:seed-test-users # Seed test users via tsx
```

Unit tests match: `src/lib/**/*.test.{ts,tsx}` and `src/middleware/**/*.test.{ts,tsx}`.
E2E tests live in `src/tests/e2e/` (Playwright, 60s timeout, 2 workers locally).

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + **TypeScript** strict + **React 19**
- **Supabase** (PostgreSQL + Auth + RLS) — `@supabase/ssr` for cookie-based sessions
- **shadcn/ui** + **Tailwind CSS 4** + **Radix UI** primitives
- **next-intl** for i18n — 3 locales: `id` (default), `en`, `ko` (2026-07-23 ja/zh 제거)
- **Midtrans** for payments, **Resend** for email
- **Anthropic SDK + OpenAI** for AI features (OCR, document processing)
- **Sentry** for error monitoring (API error capture, circuit breaker alerts, Web Vitals), **pino** for structured logging (all server code)
- **Zod 4** for validation, **React Hook Form** + **@hookform/resolvers** for forms
- **@tanstack/react-query** for data fetching, **zustand** for client state

### Next.js Root Middleware
`src/middleware.ts` handles i18n (next-intl), Supabase session refresh, rate limiting (skipped for `/api/health`), security headers (CSP, HSTS, X-Frame-Options), and request ID generation. Protected routes redirect unauthenticated users; auth routes redirect authenticated users to dashboard.

### Path Alias
`@/*` → `src/*` (tsconfig)

### Routing
All pages are under `src/app/[locale]/` with route groups:
- `(auth)/` — login, register, forgot-password (redirect to dashboard if authenticated)
- `(dashboard)/` — see below
- `(public)/` — public pages

API routes live at `src/app/api/` (not locale-prefixed).

**Dashboard surfaces** (under `(dashboard)/`) split by audience:
- Customer-side: `dashboard`, `tax` (filings/intake), `filings`, `submissions`, `billing`, `documents`, `invoice-capture` (OCR), `assets`, `counterparties`, `company-profile`, `my-profile`, `poa`, `reports`, `chat` (AI 챗봇), `news`, `marketplace`, `referral`, `notifications`, `settings`, `help`
- Consultant-side: `customers`, `customers/[id]`
- Operator-side: `operator/*` — 운영팀 큐 UI (review/approval/ebilling/payment/DJP/BPE)
- Admin-side: `admin/*` — `monitoring` (observability), `master/*` (master governance — 신고운영은 TAX_OPERATOR_MASTER, 사업운영 통계·커스텀 가격은 PLATFORM_MASTER 도 허용)
- Firm-admin-side (P6.2): `consultant-erp/firm-admin/*` — `staff`/`clients`/`billing` (FIRM_ADMIN 전용, EXTERNAL 세무컨설팅 법인 관리자 스캐폴딩)

**Customer dashboard 진입은 `customer.customer_type`(INDIVIDUAL/COMPANY)에 따라 자동 분기**합니다. 같은 `/dashboard` URL이라도 INDIVIDUAL은 개인 SPT 위주 (1770SS/S/1770), COMPANY는 월 신고/결산 wizard 위주의 화면을 받습니다. 이 분기는 server component에서 customer 행을 읽어 결정합니다.

### Middleware Composition (Critical Pattern)
API routes use `composeMiddleware()` from `src/middleware/compose.ts` to chain middleware left-to-right:

```typescript
composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_ADVISOR), withAudit('ACTION'))
```

Pre-built stacks in `compose.ts`: `taxDataRead()`, `taxDataWrite(action)`, `taxFilingSubmit(action)`, `billingOperation(action)`, `platformAdminOperation()`, `customerOperation(action?)`.

Available middleware: `requireAuth`, `blockPlatformAdmin`, `requireRole(…roles)`, `withAudit(action)`, `requireValidPOA()`, `rate-limit`, `request-id`.

`composeMiddleware()` automatically measures response time, logs with pino (`method`, `route`, `status`, `duration`, `userId`), adds `Server-Timing` header, and reports 5xx errors to Sentry.

### RBAC & Auth
Roles defined in `src/types/auth.ts`:
- `CUSTOMER` (`customer.customer_type` = `INDIVIDUAL` | `COMPANY`) — tax data access
- `CONSULTANT`, `TAX_ADVISOR` — JTC internal AND external tax-firm consultants share these role names; the actual partner is determined by `consultant.tax_partner_id` joined to `tax_partner.partner_type` (`JTC` vs `EXTERNAL`)
- `PLATFORM_ADMIN` — platform **technical** management only (dev/server/logs/webhooks), **never** tax data
- `PLATFORM_MASTER` (P6.1, 2026-07-07) — MonoFlip **business** master: platform-wide stats, pricing/plans, custom pricing, EXTERNAL firm onboarding. Never tax filing operations.
- `TAX_OPERATOR`, `TAX_OPERATOR_LEAD`, `TAX_OPERATOR_SUPERVISOR`, `TAX_OPERATOR_MASTER` — JTC 신고운영 roles. MASTER is the filing-operations top tier (P6.3 narrowed): Coretax toggle, Tax Code Rule, luxury classifications. 요금·상품·계약은 PLATFORM_MASTER 소관.
- `FIRM_ADMIN` (P6.2, 2026-07-07) — EXTERNAL 세무컨설팅 법인 관리자: 자기 tenant 안에서 직원 초대·비활성화, TAX_ADVISOR 임명, 클라이언트 배정, 청구·구독 관리. `requireFirmAdmin` 미들웨어 (FIRM_ADMIN role + active consultant row + EXTERNAL partner 3중 검증).
- `SYSTEM` — billing operations only

**MonoFlip/JTC 분리 (P6, 2026-07-07)**: MonoFlip = 플랫폼 운영사 (PLATFORM_MASTER/PLATFORM_ADMIN), JTC = 세무신고 대행 실무 주체 (CONSULTANT/TAX_ADVISOR/TAX_OPERATOR_*). 상담원은 JTC 직원이지 MonoFlip 직원이 아님 — UI 카피도 "JTC 소속 신고 상담원" 으로 표기. 상세: `docs/guides/domain-model-corrections-20260707.md`, `docs/guides/roles.md`.

Organizations: `PLATFORM_OWNER`, `PLATFORM`, `TAX_PARTNER` (`src/types/auth.ts` → `OrganizationType`).

Multi-tenancy: a single `tax_partner` row can be `JTC` (default filing partner, `is_default_filing_partner=true` — P6.3 renamed from `is_platform_partner`) or `EXTERNAL` (independent tax firm, Phase B-1). RLS scopes consultant data via `get_consultant_tax_partner_id()` so external firms only see their own customers, never JTC's. `customer.user_id` is nullable since Phase B-2 to allow consultants to register customers without an auth user.

Auth enforced at **two levels**: API middleware (first gate) + Supabase RLS (final gate).

### Tax Calculation Modules
The platform calculates **annual SPT, monthly SPT Masa, and annual closing** under `src/lib/tax/`.

Annual SPT (개인/법인 연간):
- `spt-1770ss/` — simple employee form
- `spt-1770s/` — mixed income
- `spt-1770/` — business income
- `spt-1771/` — corporate (UI is currently disabled in favor of monthly filing — calculator kept)

Monthly SPT Masa (월 신고) and withholding:
- `spt-masa/`, `spt-masa-calculator.ts` — monthly SPT Masa generation + PDF
- `pph21-calculator.ts` — employee withholding (개정 2024 brackets). PTKP/누진 브래킷/무-NPWP 20% 가산은 `rate-provider.ts` 를 통해 resolve — 하드코딩 TS 상수가 항상 fallback, `tax_rate_config` DB row 가 override (60s cache, sane-range 검증 실패 시 TS 상수로 자동 복귀). MASTER 가 `/admin/tax-rates` 에서 편집하면 배포 없이 ~60초 내 반영. 계산 전 `loadRateOverrides()` warm, 편집 후 `invalidateRateCache()`. TER 125구간은 하드코딩 유지.
- `rate-provider.ts` — 위 DB-override loader (resolvePTKP / resolveBrackets / resolveNpwpSurcharge)
- `pph22-calculator.ts` — import withholding
- `pph23-calculator.ts` — service withholding
- `pph26-calculator.ts` — non-resident withholding
- `pph15-calculator.ts` — sector-specific (shipping/airline)
- `pph-final-calculator.ts` — final tax (PPh Final 0.5% UMKM 등)
- `ppn-calculator.ts` — VAT (PPN)
- `ebupot/`, `bpe/` — e-Bupot 전자증빙 / BPE 전자수령증
- `withholding-helpers.ts`, `grossup-calculator.ts`, `annual-regime.ts`

Annual closing (연간 결산):
- `closing-statements/` — closing PDF (UMKM/PPh25 8-phase wizard, 2026-05 완료). Walks UMKM (PPh Final 0.5%) or PPh25 (정상 법인세) closure end-to-end: ID Billing 발급 → 납부 → DJP 제출 → BPE 수령 → 신고 완료.
- `koreksi-fiskal-engine.ts` — fiscal correction (회계 → 세무 조정)
- `annual-aggregator.ts`, `trend-from-filings.ts` — aggregates monthly filings into annual figures
- `tax-resolution-engine.ts` — resolves which SPT applies given customer profile

Bulk + shared:
- `bulk-import/`, `column-mapper.ts` — CSV/Excel bulk import for transactions/employees
- `shared/` — PTKP rates, tax brackets, common types
- `export/` — exporters for filings

Unit tests colocated: `src/lib/**/*.test.ts`.

### Supabase Client Tiers
Three client types in `src/lib/supabase/`:
- **Browser** (`client.ts`) — `createBrowserClient()` for client components
- **Server** (`server.ts`) — `createServerClient()` with dual-auth: checks `Authorization: Bearer` header first (for API/E2E), falls back to cookies
- **Admin** (`admin.ts`) — `getSupabaseAdmin()` lazy singleton using service role key, bypasses RLS. Only use after middleware auth validation.

### API Route Pattern
Handlers receive `RequestWithSession` (extends `NextRequest` with `.session` and `.audit`). Middleware composition happens at the export level:

```typescript
async function handleCreate(req: RequestWithSession): Promise<Response> { /* ... */ }

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth, blockPlatformAdmin,
    requireRole(UserRole.TAX_ADVISOR),
    withAudit('ACTION_NAME')
  )(request as RequestWithSession, handleCreate);
}
```

### Operator Filing Workflow (Coretax era — 납부 = 신고, 2026-07-23)
현행 Coretax 체계에서는 고객이 ID Billing 을 납부하면 NTPN 이 Coretax 안에서 자동 생성되고 **납부가 신고의 역할까지 수행**한다. 구방식의 납부증빙 업로드 → 운영팀 검증 → DJP 제출 → BPE 수령 4개 상태(`PAYMENT_UPLOADED`/`PAYMENT_VERIFIED`/`DJP_SUBMITTED`/`BPE_UPLOADED`)는 `20260723000001_coretax_payment_is_filing.sql` 에서 제거됐다. `djp_submission_queue` 상태기계:

```
PENDING → (PENDING_DOCS ↔) DATA_REVIEW → PENDING_APPROVAL → APPROVED
→ EBILLING_GENERATED → PAYMENT_PENDING (고객 전송·납부대기 = 실질 종료 상태)
→ COMPLETED (향후 Coretax API 연동의 NTPN 자동수집 전용 — 수동 UI 버튼 없음)
   (or FAILED from any state)
```

Role gating:
- **Operator**: `review`, `request-approval`, `generate-ebilling`, `notify-customer`
- **Supervisor only**: `approve`, `reject` (on `PENDING_APPROVAL`), `reassign`
- **Customer side**: 납부증빙/BPE 업로드 없음. `/api/customer/payment-proof` 및 `/api/customer/bpe-upload` 는 삭제됨. 고객은 `/tax/billing` 에서 ID Billing 확인·출력 후 은행에서 납부하면 끝.
- 결산(연 SPT Tahunan)은 별도: `closing_submission` 테이블은 자체 status enum 으로 BPE 를 계속 추적하며(연 신고는 실제 제출 + BPE 수령 필요), operator coretax `record-completion` 이 queue → COMPLETED + closing_submission BPE 동기화를 수행한다.

Operator API: `PUT /api/operator/queue` with `{ id, action, ...extra }`. The `extra` payload depends on the action (`ebillingCode`, `rejectedReason`, `failedReason`).

### ID Billing 발행 보드 (v19 트랙 2, 2026-07-23)
수퍼바이저 승인완료 건만 발행대상으로 이관되는 발행 보드 — **JTC 운영팀 + 외부 세무법인(ERP) 상담원 공용** (tenant = `tax_partner` 분리, 운영팀은 JTC 기본 파트너 스코프).

- **테이블**: `id_billing_issuance` (발행완료 리스트, `BIL-YYYYMM-NNN` 파트너별 일련번호, ISSUED→SENT→PAID/CANCELLED) + `id_billing_workbook_log` (작성본 생성 이력 + 항목 스냅샷 = **발행 게이트**). 마이그레이션 `20260723000002`.
- **발행 게이트 3중 (백엔드 강제)**: 소스 APPROVED + 작성본 생성 이력 존재 + 미발행. 프론트 플래그는 신뢰하지 않는다.
- **발행대상 소스 2종**: ① `consultant_session` APPROVED + saved calc (calc kind → 세목 매핑은 `src/lib/id-billing/kap-kjs.ts`, CORP_TAX_MONTHLY 는 `basis.selectedCase` 로 PPh25/PPh Final 하나만 표시) ② `djp_submission_queue` APPROVED (발행 시 EBILLING_GENERATED 전이 — 기존 상태기계 재사용).
- **작성본 xlsx**: 빈 양식이 아닌 승인완료 계산값이 채워진 4시트 (README / Coretax_Ready / Company_Summary / Tax_Code_Reference). Tax_Code_Reference 는 Track B `tax_code_rule` DB 우선.
- **API**: `/api/id-billing/{board,workbook,issue,send}` — `requireBillingIssuer` 미들웨어 (CONSULTANT/TAX_ADVISOR/TAX_OPERATOR 4계). send 는 Resend best-effort, 실패 시 미전송 유지(재시도 가능).
- **UI**: 공용 `IdBillingBoard` 컴포넌트 — `/consultant-erp/billing` (상담원) + `/operator/billing-issuance` (운영팀) 두 진입점. 수동 완료처리 버튼 없음 (완료는 향후 Coretax NTPN 자동수집).

### 승인대기 리모델 — 4-값 분리 + 검토요청 (v13 트랙 3, 2026-07-23)
- **4-값 분리 저장** (`consultant_session_calc`, 마이그레이션 `20260723000003`): `customer_input_amount`(고객 입력) / `ai_amount`(AI 계산) / `consultant_amount`(상담원 처리) / `approved_amount`(최종 승인, APPROVE 시 스탬프). 기존 `amount` = **유효값**(consultant ?? ai) 의미 유지 — 발행 보드 등 하위 소비자 변경 없음. 처리값 조정(PATCH `/sessions/[id]/calc`)이나 재계산 시 `approved_amount` 초기화 → 재승인 대상.
- **검토요청** (`consultant_review_request`): 상담원이 확신 없는 항목만 올림 (`POST /sessions/[id]/review-requests`), 수퍼바이저가 의견 작성 (`PATCH /supervisor/review-requests/[id]`, supervisor 전용). **OPEN 요청이 남아 있으면 세션 APPROVE 가 400** (errorKey `openReviewRequests`) — v13의 "의견 작성 → 승인" 순서를 백엔드가 강제.
- UI: supervisor 승인대기 상세에 4-값 비교 테이블 + 검토요청 박스, consultant `CalcCardsPanel` 카드별 처리값 저장/철회 + 검토요청 작성.

### 자동배정 엔진 (v13 트랙 4, 2026-07-24)
신규 고객을 tax_operator 에게 자동 배정하는 스코어링 엔진 (v13 §5 "자동배정 원칙", 미배정 큐는 fallback).
- **순수 엔진** `src/lib/operator/assignment-engine.ts`: 7기준 중 스키마 데이터가 있는 4개만 가중 — sticky(기존이력) 40 / headroom(업무량 여유) 20 / quality(승인통과율·정확도) 25 / specialty(세목 전문성) 15. 언어·위험도는 `unappliedCriteria` 로 명시(no silent caps). eligibility: `status=active` + `auto_assign_enabled` + `work_state≠offline` + `load<max_clients`.
- **실행 헬퍼** `src/lib/operator/assign-customer.ts`: 엔진으로 customer→operator 배정 (`operator_client_assignments`) + 감사(`operator_assignment_log`: method/score/breakdown/미적용기준). 이미 배정된 고객은 idempotent skip, 전원 만석/오프라인이면 overflow.
- **스키마** (마이그레이션 `20260724000001`): `tax_operators.specialties TEXT[]` (세목 전문성 입력) + `operator_assignment_log`.
- `POST /api/operator/auto-assign` (supervisor): 미배정 고객 + 미배정 큐 아이템 둘 다 처리. 세목 전문성/언어/위험도 데이터가 채워지면 엔진 가중치만 확장하면 됨(구조 고정).

### Supervisor: 이관현황 · 평가 실측 · 소속관리 (v13 트랙 5, 2026-07-24)
- **§8 ID Billing 이관현황** (`/consultant-erp/supervisor/billing-handover`, `GET /api/consultant-erp/supervisor/billing-handover`): 발행대상(승인완료 미발행, 승인 수퍼바이저·담당 상담원 표시) + 발행완료(전송·NTPN 상태) read-only 추적. 트랙 2 `id_billing_issuance` 재사용, 발행 액션은 발행 보드에 위임.
- **§7 평가 실측 + 자동 상벌 금지**: `/api/operator/evaluation` 이 담당 케이스의 `rejected_reason` 이력에서 반려율/승인통과율을 실측(`reject_rate`/`approval_pass_rate`, 이력 없으면 시드 폴백). 인센티브는 `suggested_incentive_amount` + `isSuggestionOnly:true` + `disclaimer` (v13 §7 "상벌 자동 결정 안 함"). statistics 페이지에 고지 배너.
- **§6 소속관리** (마이그레이션 `20260724000002`): `tax_operators.supervisor_id`(소속) + `operator_affiliation_transfer`(이동 요청→**받는 쪽 수퍼바이저** 승인→감사, `client_mode` 3옵션 WITH_CLIENTS/OPERATOR_ONLY/REASSIGN_CLIENTS, open-per-operator UNIQUE). `GET/POST /supervisor/affiliation` + `PATCH /supervisor/affiliation/[id]`. REASSIGN_CLIENTS 승인 시 활성 배정 해제 → 다음 auto-assign 재배정 대상. UI `/consultant-erp/supervisor/affiliation`.

### v19 트랙 6 — 원천세 증빙 뷰어 · PPN Coretax 대조 (2026-07-24)
- **§6 원천세 증빙 전용 뷰어**: `GET /api/tax/pph23-transactions/[id]/invoice-photo` 가 서명 URL(5분) 반환, pph23 페이지의 첨부됨(CheckCircle) 클릭 → 이미지/PDF 미리보기 모달 (요청 모달과 분리).
- **§9 PPN Coretax 대조** (마이그레이션 `20260724000003`): `ppn_faktur_monthly` +coretax_dpp/coretax_ppn/recon_status/recon_source. 순수 매칭은 `src/lib/tax/ppn-reconcile.ts` (faktur type+번호, MATCH/DIFF/MISSING_CORETAX/MISSING_CUSTOMER). `POST/GET /api/tax/ppn-reconcile` — Coretax faktur JSON 받아 고객 행에 값+상태 기록 + Coretax 전용은 `recon_source=CORETAX` 행 삽입(재실행 시 선삭제 → drift 0). PPN 페이지 'Coretax 대조' 탭에서 xlsx 업로드→클라 SheetJS 파싱→POST.
- **§9 PPh25/Final 단일표시**: 이미 충족 (`determineRegime` 단일 반환) — 코드 변경 없음.
- **§7 WhatsApp형 메신저 리스킨**: `CustomerAiChat`(고객 FAB) + `CustomerInboxClient`(운영팀 인박스) 양쪽에 날짜 구분선(오늘/어제/날짜) + 내가 보낸 메시지 읽음 ✓✓(상대가 읽으면 파란 CheckCheck, 아니면 회색 Check). 고객측 `operatorReadAt` / 운영팀측 `customerReadAt` 기준 — DTO 기존 필드 재사용, 서버 변경 0.

### Tax Filing UI Wizard (Zustand Store)
`src/stores/tax-filing-store.ts` — persisted zustand store with 5-step wizard:
1. `select-customer` → 2. `income-data` → 3. `deductions` → 4. `documents` → 5. `review`

Navigation via `nextStep()`, `prevStep()`, `canProceed()` (validates prerequisites per step).

### PDF Generation
SPT form PDFs use `@react-pdf/renderer` with `renderToBuffer()` in API routes. PDF component files at `src/lib/tax/{form}/pdf-generator.tsx`. Canvas is externalized in webpack config to avoid native module issues.

### Resilience Patterns
`src/lib/resilience/` provides circuit breaker, timeout with exponential backoff retry, and idempotency key management for external service calls (DJP, Midtrans). Circuit breaker state changes are reported to Sentry automatically.

### Observability
- **Logging**: All server code uses `loggers.*` from `src/lib/logger.ts` (pino). No `console.log` in server code.
- **Sentry**: `src/lib/sentry.ts` provides `captureApiError()`, `captureJobError()`, `captureCircuitBreakerEvent()`, `setSentryUser()`.
- **Web Vitals**: `src/components/analytics/WebVitals.tsx` collects LCP/FID/CLS/FCP/TTFB/INP → Sentry.
- **Monitoring Dashboard**: `/admin/monitoring` — error stats, circuit breakers, memory, activity (API: `/api/admin/monitoring`).

### Customer Management (CRM)
- **Customer Detail Page**: `/customers/[id]` — profile edit, filings tab, POA tab, notes tab, activity tab.
- **Customer Notes**: `customer_note` table + CRUD API (`/api/customers/[id]/notes`). Pin support.
- **Customer List**: Filters (type, POA status), sort (name, date, filings), pagination.
- **Customer Create**: `POST /api/customers` with dialog UI.

### Pricing & Billing (Phase B-3, K-1~K-3, D)
Three pricing surfaces, each with its own config + endpoint + DB table:

| Surface | Config | Endpoint | Table | Order ID prefix |
|---|---|---|---|---|
| Corporate (월 구독, COMPANY) | `src/config/corporate-pricing.ts` (UMKM/Basic/Pro) | `/api/billing/corporate-plan` | `customer_subscription` | `CORP-` |
| External consultant tier (월 구독) | `src/config/consultant-pricing.ts` (Starter/Growth/Enterprise) | `/api/billing/consultant-plan` | `tax_partner_subscription` | `CONS-` |
| Individual SPT (건당, INDIVIDUAL) | `src/config/individual-pricing.ts` (1770SS/1770S/1770) | `/api/billing/individual-spt` | `billing_transaction` | `PAY-` |

All three follow the same **graceful-degrade** pattern: if the Midtrans Snap call fails (or no PG is configured), the PENDING_PAYMENT row is preserved and the response includes `snapToken: null` + `snapError`. The user can retry from the in-app billing page later. The single Midtrans webhook (`/api/webhooks/midtrans`) routes by order ID prefix to the correct table.

**Master governance**: `/admin/master` shows MRR/plan distribution/Pro-exceeding customers; `/admin/master/custom-pricing` issues `custom_pricing_quote` rows for customers that need bespoke pricing (Pro 한도 초과, 세무조사, 이전가격 등). P6.1 부터 사업운영 성격의 `stats`/`custom-pricing` 은 `PLATFORM_MASTER` 도 허용, 신고운영 성격 (Coretax toggle, Tax Code Rule, luxury) 은 `TAX_OPERATOR_MASTER` 전용.

**`MIDTRANS_IS_PRODUCTION`** must be set to `'true'` explicitly to point at the real Midtrans endpoints. Default is sandbox — `NODE_ENV` is intentionally NOT used as the signal because Vercel always sets it to `production`.

### Coretax API (DJP) — Phase D

Three env vars control the operator Coretax automation. Default is **manual mode** (operator types billingId/bpeNumber by hand).

| Var | Required when | Purpose |
|---|---|---|
| ~~`CORETAX_SUBMIT_ENABLED`~~ | **DEPRECATED (Track D, 2026-05-27)** | Moved to `system_setting.coretax.submit_enabled` JSONB row. MASTER toggles via UI at `/operator/settings` §3 Coretax Status card. |
| `CORETAX_API_BASE_URL` | API mode | e.g. `https://api-coretax.pajak.go.id` |
| `CORETAX_API_TOKEN` | API mode | DJP-issued bearer token |
| `CORETAX_API_TIMEOUT_MS` | optional | Per-call timeout (default `15000`) |

When enabled and operator leaves `billingId`/`bpeNumber` blank, the PUT actions call `coretax.issueIdBilling()` / `coretax.submitSpt()` via `src/lib/coretax/client.ts`. The client wraps every call in `CircuitBreaker('coretax')` + `withRetry` (2 retries, exponential backoff). HTTP 4xx/5xx are NOT retried; circuit opens after 5 consecutive failures for 30s. Operator can always override by typing values manually.

Each Coretax invocation is logged step-by-step to `coretax_step_log` (request/response/duration/error) and `case_audit_log` for case-level traceability. The `djp_submission_queue` row is linked to the originating `annual_closing_session` via `djp_queue_closing_link`, so the closing wizard and the operator queue share state — supervisor can reopen a closing case from the operator queue and vice versa.

### Authentication & Security
- **2FA (TOTP)**: `/api/auth/mfa` — Supabase MFA enroll/verify/unenroll. Settings page UI. Login page runs the TOTP challenge when the account has a verified factor (aal1 → aal2).
- **Operator 2FA enforcement**: `system_setting.security.operator_mfa_required` toggle (MASTER card at `/operator/settings`, GET/PATCH `/api/admin/security/operator-mfa`). When on, `src/lib/security/operator-mfa.ts#checkOperatorMfaGate` in operator/admin layouts bounces operator-tier staff: not enrolled → `/settings?mfa=required`, enrolled-but-aal1 → `/login?mfa=challenge`. Middleware lets pending-aal2 sessions stay on `/login`. UI-level gate only (Bearer-token API calls are not aal-gated) — e2e/smoke keep working; don't turn it on before enrolling the operator test accounts if browser e2e must pass.
- **Login History**: `/api/auth/sessions` — audit_log based login/failure history.
- **Password Policy**: 8+ chars, uppercase + lowercase + number + special character required.

### i18n
- Config: `src/config/constants.ts` (LOCALES, DEFAULT_LOCALE)
- Message files: `src/i18n/messages/{ko,en,id}.json` (flat JSON per locale, not nested folders)
- Use `useTranslations()` from `next-intl` in components
- Auto-translate helper: `scripts/i18n-auto-translate.ts` (Anthropic SDK; namespace-scoped, dry-run by default)

### Consultant ERP (P0~P6 완료)
세무 사무소 직원(컨설턴트·수퍼바이저) 전용 ERP. PDF 35p 와이어프레임 기반의 5단계 워크플로우 + 공동 거래처 DB + 리갈리티 자료 보관함. 상세 계획서: `docs/01-plan/features/consultant-erp.md`

- **데이터 모델**: 10 테이블 (`consultant_session` + 5 자식 / `counterparty_master` + 2 자식 / `legality_document`) + 5 ENUM. 마이그레이션 2종:
  - `20260516000001_consultant_erp.sql` — 테이블 + RLS
  - `20260516000002_consultant_erp_storage.sql` — bucket `consultant-erp-docs` (20MB private) + storage RLS
- **미들웨어**: `requireConsultantOrSupervisor` — CONSULTANT / TAX_ADVISOR / TAX_OPERATOR_SUPERVISOR 만 통과, 그 외 403.
- **API** (`/api/consultant-erp/`, 13+ endpoint):
  - `sessions/board` · `sessions` · `sessions/[id]` · `sessions/[id]/documents` · `sessions/[id]/documents/upload` (multipart) · `sessions/[id]/parsing` · `sessions/[id]/parse-rows` · `sessions/[id]/parse-rows/message` · `sessions/[id]/calc` · `sessions/[id]/approval` · `sessions/[id]/coretax-record`
  - `counterparty` · `counterparty/[id]` · `counterparty/match` · `counterparty/[id]/candidates`
  - `legality` (multipart upload) · `legality/[id]` · `legality/[id]/download` (signed URL 5분)
- **AI 파싱**: `src/lib/consultant-erp/claude-parser.ts` — Anthropic SDK (Claude Sonnet 4.6 streaming, 20MB까지 PDF/이미지/Excel/CSV 지원). API key 미설정 / storage miss / JSON parse 실패 시 6단계 graceful fallback → mock 결과로 복구 (`mock-parser.ts`).
- **룰 엔진**: `src/lib/consultant-erp/parse-row-rules.ts` — slot별 critical/warning/info 룰. `client-message-builder.ts` 가 ko/id markdown 으로 고객 확인요청 메시지를 모아 생성.
- **자동계산**: `src/lib/consultant-erp/calc-engine.ts` — PPH21_TER / WITHHOLDING / CORP_TAX_MONTHLY (PPh Final ↔ PPh25 듀얼 케이스) / PPN_NET / BANK_RECON.
- **공동 거래처 DB**: cross-tenant 공유 (`counterparty_master_read` 정책으로 모든 active consultant read, 등록·갱신은 consultant 행 필요). `counterparty-matcher.ts` 의 `matchByNpwp()` 가 NPWP exact 매칭으로 suggested PPh + trust score 반환.
- **운영팀 큐 / 결산 wizard 와 책임 분리**: ERP 세션은 자체 완결 (Coretax 외부 처리 후 수기 기록), `djp_submission_queue` 와 별도 트리거.
- **인보이스 라인 파싱 (2단계)**: `WITHHOLDING_INVOICE` / `VAT_IN_OUT` 슬롯 문서에서 line-item을 추출해 `consultant_session_invoice_line` 에 적재.
  - **Phase 1 (read path)**: 마이그레이션 `20260518000001_consultant_session_invoice_line.sql` — 21컬럼, `(document_id, line_no)` UNIQUE, session 단위 RLS. `/api/consultant-erp/sessions/[id]` 응답에 `invoiceLines` (≤500) 포함.
  - **Phase 2 (AI 파서)**: `src/lib/consultant-erp/invoice-line-parser.ts` — Claude Sonnet 4.6 vision, `claude-parser.ts` 와 동일한 6단계 graceful-fallback. `POST /api/consultant-erp/sessions/[id]/parse-invoice` (auth=consultantOrSupervisor + audit + slot 가드 + 재실행시 lines 삭제 후 insert → drift 0). UI는 직원용 `ErpWorkflow` slot 카드 + 봉인 `SupervisorApprovalDetail` 양쪽 모두 노출.
  - **자동 트리거 (autoParse)**: `/sessions/[id]/documents/upload` 가 새 form field `autoParse=true` 를 받으면 invoice 슬롯 업로드 직후 `parseInvoiceLines` 를 sync 실행. 실패는 업로드를 rollback 하지 않고 응답 `data.parse.{inserted, mode, confidence, reason}` 으로 보고. `ErpWorkflow` 가 invoice 슬롯에 자동으로 `autoParse=true` 부여 — 직원은 "업로드 + 파싱"이 한 클릭.
  - **라인별 검토 토글**: `PATCH /api/consultant-erp/sessions/[id]/invoice-lines/[lineId]` (body `{is_reviewed?, reviewer_note?}`, refine 으로 둘 다 비면 400, reviewer_note 500자 cap). 두 화면(`SupervisorApprovalDetail` + `ErpWorkflow`)에서 ✓ 컬럼 + emerald row tint + "N 검토완료" 카운트 badge + description 셀 옆 ✎/+ 노트 인라인 편집 (`window.prompt`)을 공유. note 가 있으면 italic emerald "📝 …" 로 description 아래 표시. 헤더 우측 "전체 ✓ / 전체 해제" 버튼이 `Promise.allSettled` 로 PATCH 병렬 + no-op skip (이미 원하는 상태인 라인은 건너뜀 → audit log 깨끗) — 큰 invoice 일괄 처리.
- **회귀**: `npx tsx scripts/test-consultant-erp-flow.ts` — 세션 생성 → 자료 → 결재 → Coretax → 거래처 + 리갈리티 list 까지 끝-끝. e2e: `consultant-erp.spec.ts` 9 tests (4 페이지 접근 + content + 3 access control).

### Supervisor ERP (팀장용 — PDF 11/11 메뉴)
세무 사무소 팀장(supervisor) 전용 ERP. 직원용 ERP 위에 read-only 집계 + 1~2개 write endpoint 만 얹은 구조 — 새 DB 0개. 사이드바에서 supervisor 에게만 노출되는 9 링크 + Dashboard role-aware 분기. 상세 메모리: `2026-05-17 Supervisor ERP 완료`.

- **라우팅**: 모두 `/consultant-erp/supervisor/*` — `approval` (+ `[sessionId]` 케이스 상세) · `team` · `customers` · `revisions` · `legality` · `calendar` · `coretax` · `quality` · `settings`.
- **API**: `/api/consultant-erp/supervisor/{approval/[id], team, team-members, team/reassign, customers, revisions, calendar, legality, coretax, quality, settings}` — 핸들러 첫 줄에서 `req.session.role !== TAX_OPERATOR_SUPERVISOR → 403` 강제 (consultant 도 `requireConsultantOrSupervisor` 는 통과하지만 supervisor only).
- **데이터 helper**: `src/lib/consultant-erp/supervisor-views.ts` — 모든 supervisor 집계 함수 한 파일. Risk score 0..50 휴리스틱 (status 기본점 + 미충족 필수 슬롯 ×2 + 마감 임박 가산). MONTHLY 마감=다음달 20일, ANNUAL=다음해 4/30.
- **승인 케이스 상세 (PDF p.2-5)**: `GET /supervisor/approval/[sessionId]` 가 `{session, customer, consultant, documents, calcs, parseRows, parseCounts, approvals, coretax, trend, invoiceLines}` 통합 반환. MONTHLY 세션은 6개월 트렌드 (`buildCustomerTrend`) 포함.
- **설정 persistence**: `tax_partner.settings JSONB` (마이그레이션 `20260517000001_tax_partner_settings.sql`) — GET은 stored ⊕ `DEFAULT_APPROVAL`/`DEFAULT_CHANNELS` 머지, PATCH은 sibling 키 보존 partial-merge.
- **재배정**: `POST /supervisor/team/reassign` — 활성 + 같은 tax_partner + COMPLETED 아님 검증 후 `consultant_session.consultant_id` 갱신 + `WITHDRAW` 감사 row.
- **회귀**: 통합 runner `npm run test:smoke:prod` 안에 supervisor P1 (`test-supervisor-erp-p1.ts` 11 endpoint × 2 role) + settings round-trip + 6-month trend seed+verify + invoice lines Phase 1 + invoice parser Phase 2 가 모두 포함.
- **e2e**: `src/tests/e2e/supervisor-erp.spec.ts` — 9 페이지 렌더 + 9 endpoint × 3 role 접근 게이트 + reassign 2 + approval 2 + settings 2 + parse-invoice contract 4 + line-review contract 5 = **54 cases**.

### Landing Page (public `/`)
The marketing landing at `/[locale]` is a Server Component (`src/app/[locale]/page.tsx`) that delegates to a single client component (`src/components/landing/LandingPage.tsx`) wired to a separate data layer:
- `src/data/landing/` — types, modules (6), pricing (10), and `auto-translated.json` (3 locales, one bundle each)
- `getLandingContent(locale)` in `translations.ts` returns a fully-resolved `LandingContent` per locale, falling back to ko
- Translation pipeline: `scripts/translate-landing.ts` (Anthropic SDK streaming, disk cache at `scripts/.translate-cache/`, sanitize + 3-retry) regenerates `auto-translated.json` whenever the ko source data changes
- `scripts/sync-individual-pricing-labels.ts` mirrors the landing's `pricing.typeLabel/description` into the `pricingPlans.SPT_1770SS / SPT_1770S / SPT_1770` i18n namespace so the landing and `/pricing` show the same plan names ("Personal Simple/Standard/Complex"). Internal plan ids stay `SPT_1770SS/S/1770` for DB/Midtrans compatibility.
- `generateMetadata` in `page.tsx` produces locale-specific `<title>`, `<meta description>`, `og:locale`, and alternate-language links. OG image at `public/og-image.svg` (slate-950 + emerald tone, 1200×630).
- `LandingContent` includes hero (heroTop/heroMain/heroSub/heroDesc), Trust Indicators 5-card strip (`trustBaseTitle`/`trustBaseDesc` + `trustIndicators[4]`), and 4-column footer (`footer.{brand,tagline,jtcNote,company×3,contact×3,legal×3,copyright}`) per the 2026-05-19 PDF spec. `translate-landing.ts` is the source-of-truth for the ko bundle; running it regenerates all 4 non-ko locales with disk cache reuse for unchanged parts.

### Webpack / Next.js Config Notes
- `canvas` is externalized in `next.config.ts` to avoid native module issues with `@react-pdf/renderer`
- Server actions body size limit: 10mb
- Optimized package imports: `lucide-react`, `recharts`, `date-fns`, Radix UI components

## Security Rules (5 Hard Rules — Non-Negotiable)

1. **PLATFORM_ADMIN cannot access customer tax data** — enforced by `blockPlatformAdmin` middleware + RLS
2. **Consultant must belong to a registered tax_partner** — FK constraint + RLS scoped via `get_consultant_tax_partner_id()`. JTC and EXTERNAL partners are isolated from each other (Phase B-1, never cross-tenant).
3. **Tax Filing Actor ≠ Platform** — only `TAX_ADVISOR` can submit filings (Phase B-2.1 relaxed this to "any active consultant from any tax_partner" so external firms can also file for their own customers)
4. **Billing Collector ≠ Service Provider** — `SYSTEM` role only for billing ops
5. **Audit Trail Required** — `withAudit` middleware on all write operations

## Code Conventions

- Prefer **server components**; use `'use client'` only when needed
- API routes must use `composeMiddleware()` — never skip auth/RBAC
- All tax data endpoints must include `blockPlatformAdmin`
- Database migrations in `supabase/migrations/` (sequential numbered SQL files)
- Structured logging via `pino` (`loggers.*`) — never `console.log` in server code
- Use `captureApiError()` from `src/lib/sentry.ts` for Sentry error reporting in API routes

## Test Accounts

| Role | Type | Email | Password |
|------|------|-------|----------|
| CUSTOMER | INDIVIDUAL (개인) | customer.test@example.com | TestPassword123! |
| CUSTOMER | COMPANY (법인) | company.test@example.com | TestPassword123! |
| CONSULTANT (JTC 내부) | — | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR (JTC 내부) | — | advisor.test@jakartatax.co.id | TestPassword123! |
| CONSULTANT (EXTERNAL — PT Mitra Pajak Sentosa) | — | external.consultant@mitrapajak.com | TestPassword123! |
| FIRM_ADMIN (EXTERNAL — PT Mitra Pajak Sentosa) | — | firmadmin.test@mitrapajak.com | TestPassword123! |
| TAX_OPERATOR | — | operator.test@aipajak.com | TestPassword123! |
| TAX_OPERATOR_SUPERVISOR | — | supervisor.test@aipajak.com | TestPassword123! |
| TAX_OPERATOR_MASTER + PLATFORM_MASTER (겸직) | — | master.test@aipajak.com | TestPassword123! |
| PLATFORM_ADMIN | — | admin.test@aipajak.com | TestPassword123! |

Seed scripts:
- `npm run db:seed-test-users` — JTC customers + consultants + admin
- `SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts` — Operator team (master.test 겸직 포함) + EXTERNAL tax_partner + its consultant + FIRM_ADMIN
- `SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts` — patches `company.test@example.com` to a COMPANY customer (works around `listUsers` pagination on populated DBs)
- `SEED_TARGET=prod npx tsx scripts/seed-individual-billing.ts` — seeds two approved ID Billing rows (PPh21 5M / PPh23 2M) in `EBILLING_GENERATED` for the INDIVIDUAL test customer so `/tax/billing` shows the design-spec demo

Landing / i18n maintenance scripts:
- `npx tsx scripts/translate-landing.ts` — regenerate `src/data/landing/auto-translated.json` (en/id) via Anthropic SDK. Disk cache at `scripts/.translate-cache/` so re-runs only re-call failed parts.
- `npx tsx scripts/sync-individual-pricing-labels.ts` — push the landing's `pricing.typeLabel/description` into the `pricingPlans.SPT_1770*` i18n namespace (3 locales). Re-run whenever individual pricing copy changes.

Verification / regression scripts (회귀 검증):

**Integrated runner** (use this first — covers everything below + roll-up):
- `npm run test:smoke:prod` — runs **~50 steps** in sequence (`scripts/test-smoke-all.ts` is the authoritative list), single PASS/FAIL summary. Coverage families: supervisor ERP (P1 + settings + 6-month trend), invoice lines (Phase 1 read + Phase 2 parser + upload autoParse + line review PATCH), tenant isolation (RLS + external consultant), firm-admin + firm signup bootstrap + master tenants (P6), unassigned customers queue, operator queue (Coretax 납부=신고 8-state + legacy 액션 400 계약), billing 3-endpoint + monitoring, Track B/D governance (Tax Code Rule + Coretax toggle + operator MFA toggle + luxury classifications + customer-ai templates), customer-ai inbox, importers (pph23/ppn/pph26/wht onesheet/pph21 strict template), inline-edit PUT contracts (pph23/ppn), invoice photo traceability (pph23 attach + closing pph23 photo status), PPh4(2) partial view + SPT Masa 요청 (옵션 B) + operator quick-create, SPT Masa PPN split, closing credit auto-fill, company signup e2e, PPN luxury toggle, 신규고객 배정 라이프사이클, PPh21 payslip 무-NPWP 가산 회귀, tax rate provider override round-trip, and `prod schema drift audit` (catches columns silently missing from prod). Steps marked `optional: true` (RLS, billing, monitoring, BINTANG JAYA importer e2e) skip-with-exit-0 when fixtures or env vars are absent — failures there do NOT block the runner.
- `npm run test:smoke` — same against local Supabase (requires `supabase start`).
- `.github/workflows/smoke.yml` — runs `npm run test:smoke:prod` on `workflow_dispatch` and daily at 23:00 UTC (06:00 WIB). Catches drift that lands WITHOUT a commit (rotated API keys, RLS edits in Supabase UI, expired Vercel env vars).
- `.github/workflows/drift-after-deploy.yml` — runs the schema drift audit on every push, waits 90s for Vercel to settle, then probes the prod DB. Complements the daily smoke by catching broken migration pushes within minutes instead of up to 24h.
- Both workflows require repo secrets `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` (optional `E2E_BASE_URL`).

**Individual scripts** (if you need to focus on one area):
- `SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts` — JTC ↔ EXTERNAL tenant isolation
- `SEED_TARGET=prod npx tsx scripts/test-external-consultant-isolation.ts` — external consultant이 JTC 데이터를 절대 못 보는지 end-to-end
- `SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts` — 3 billing endpoints smoke test, graceful-degrade 허용
- `SEED_TARGET=prod npx tsx scripts/test-custom-pricing-flow.ts` — Master custom pricing quote 발행 → 고객 수락 흐름
- `SEED_TARGET=prod npx tsx scripts/test-operator-queue-flow.ts` — 운영팀 워크플로우 전이 (Coretax 8-state) + legacy 액션 400 거부 계약
- `SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts` — 결산 wizard ↔ operator queue ↔ BPE 동기화
- `SEED_TARGET=prod npx tsx scripts/test-onboarding-flow.ts` — 신규 가입 → 첫 신고까지 골든 패스
- `SEED_TARGET=prod npx tsx scripts/test-new-customer-assignment.ts` — 신규고객 생성 → 미배정 큐 등장 → supervisor 배정 → 큐 제거 → DB edge active 라이프사이클 (prod sentinel, 자동 cleanup)
- `SEED_TARGET=prod npx tsx scripts/test-id-billing-flow.ts` — ID Billing 발행 보드 계약 (RBAC 403/200 + 작성본 게이트 400 + xlsx 4시트 파싱 검증 + BIL- 일련번호 + 중복 404 + 큐 EBILLING_GENERATED 전이 + tenant 분리, 11 asserts, `[IDBILL-E2E]` sentinel)
- `SEED_TARGET=prod npx tsx scripts/test-approval-remodel.ts` — 승인대기 리모델 계약 (4-값 분리 + 처리값 PATCH + OPEN 검토요청 APPROVE 400 게이트 + 의견 PATCH RBAC + approved_amount 스탬프 + detail 4-값 포함, 10 asserts, `[APPRV-E2E]` sentinel)
- `SEED_TARGET=prod npx tsx scripts/test-auto-assignment.ts` — 자동배정 엔진 계약 (RBAC 403/200 + 스코어 배정 or overflow + operator_assignment_log 감사 + unappliedCriteria[language,risk] + idempotent 재실행, `[AUTOASSIGN-E2E]` sentinel). 순수 엔진 유닛은 `assignment-engine.test.ts` 12 cases.
- `SEED_TARGET=prod npx tsx scripts/test-supervisor-handover-eval.ts` — 트랙 5 A+B (이관현황 supervisor 200/consultant 403 + 평가 isSuggestionOnly·disclaimer·suggested_incentive_amount·reject_rate 필드)
- `SEED_TARGET=prod npx tsx scripts/test-operator-affiliation.ts` — 소속관리 이동 워크플로우 (GET RBAC + 요청/중복409 + 비수신자 403 + 승인 시 supervisor_id 변경, `[AFFIL-E2E]` sentinel)
- `SEED_TARGET=prod npx tsx scripts/test-ppn-coretax-recon.ts` — PPN Coretax 대조 (POST 대조 → MATCH/DIFF/MISSING 집계 + Coretax 전용행 + GET 반영 + idempotent, `[PPNRECON-E2E]` sentinel, period 2026-99). 순수 매칭 유닛은 `ppn-reconcile.test.ts` 7 cases.
- `SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts` — supervisor → operator 배정/평가 흐름
- `SEED_TARGET=prod npx tsx scripts/test-monitoring-flow.ts` — Sentry / circuit breaker / monitoring dashboard 신호
- `npx tsx scripts/test-advisory-flow.ts` — `/api/customer/advisory` PKP/UMKM/Tax Treaty 응답 shape + INDIVIDUAL/COMPANY/unauth 3-way 검증
- `SEED_TARGET=prod npx tsx scripts/test-firm-admin-flow.ts` — FIRM_ADMIN staff/clients/billing 3 endpoint contract (RBAC 403 + invite lifecycle + reassign round-trip, 14 assertions)
- `SEED_TARGET=prod npx tsx scripts/test-firm-signup-admin-invite.ts` — 세무법인 셀프 가입 → adminEmail 초대 → 수락 → firm-admin 접근 골든패스 (7 assertions, sentinel firm 생성 후 완전 삭제)
- `SEED_TARGET=prod npx tsx scripts/test-master-tenants.ts` — Master ERP 테넌트 관리 GET/PATCH (RBAC + sentinel 테넌트 중지/재개 round-trip + 404/400, 8 assertions)
- `SEED_TARGET=prod npx tsx scripts/test-supervisor-erp-p1.ts` — supervisor 11 endpoint × consultant 403 contract (24 assertions)
- `SEED_TARGET=prod npx tsx scripts/test-supervisor-settings-roundtrip.ts` — `tax_partner.settings` JSONB persist 검증 (flip → restore)
- `SEED_TARGET=prod npx tsx scripts/seed-and-verify-trend.ts` — 2 MONTHLY 세션 seed → 6-point trend → cleanup
- `SEED_TARGET=prod npx tsx scripts/seed-and-verify-invoice-lines.ts` — 3 lines seed → grand total = Rp 16,495,000 검증 → cleanup
- `SEED_TARGET=prod npx tsx scripts/test-invoice-parser-phase2.ts` — invoice 파서 contract (synthetic path → mode=MOCK, slot 가드, consultant 비-5xx)
- `SEED_TARGET=prod npx tsx scripts/test-upload-autoparse.ts` — upload `autoParse=true` 응답 shape (data.parse) + non-invoice 슬롯엔 미부착 검증
- `SEED_TARGET=prod npx tsx scripts/test-invoice-line-review.ts` — PATCH `/invoice-lines/:lineId` is_reviewed flip → GET 반영 → reviewer_note persist → 빈 body 400
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B+C+A Tax Code Rule CRUD + RBAC + audit timeline + access gate (GET 4 roles + PATCH 5 roles + 400/404 + audit-log GET 2 roles, 총 18)
- `SEED_TARGET=prod npx tsx scripts/test-customer-ai-inbox.ts` — Phase 1 Customer ↔ AI 상담원 chat (find-or-create + persona masking + RBAC, 10 assertions)
- `SEED_TARGET=prod npx tsx scripts/test-coretax-toggle.ts` — Track D Coretax 토글 GET/PATCH RBAC + DB round-trip (총 5 assertion)
- `SEED_TARGET=prod npx tsx scripts/test-operator-mfa-toggle.ts` — 운영팀 2FA 강제 토글 GET/PATCH RBAC + DB round-trip (총 6 assertion, flip 후 반드시 revert)
- `SEED_TARGET=prod npx tsx scripts/validate-pph23-e2e.ts` — PPh23 wholesale importer → POST → DB → cleanup (BINTANG JAYA real xlsx; auto-skip if file absent)
- `SEED_TARGET=prod npx tsx scripts/verify-pph21-strict-template.ts` — PPh21 strict 34-col app template generated in-memory → multipart POST → DB read-back (HR fields preserved) → cleanup. `[STRICT-PPH21-E2E]` sentinel prefix. No fixture dependency (2026-06-14 JTC 양식 retirement)
- `SEED_TARGET=prod npx tsx scripts/verify-payslip-npwp-surcharge.ts` — payslip PPh21 무-NPWP 20% 가산 offline 회귀 (computePayslipTotals 에 employee_npwp 배선, 5 asserts)
- `SEED_TARGET=prod npx tsx scripts/verify-rate-provider-overrides.ts` — `tax_rate_config` PTKP override → PPh21 반영 → 복원 round-trip (4 asserts)
- `SEED_TARGET=prod npx tsx scripts/validate-pph23-bintang-jaya.ts [sheet]` — offline PPh23 importer pipeline 검증 (sheet 2601~2604)
- `SEED_TARGET=prod npx tsx scripts/validate-pph21-bintang-jaya.ts` — offline PPh21 parser + auto-mapping 검증 (cleanCell 회귀 확인)
- `SEED_TARGET=prod npx tsx scripts/validate-ppn-e2e.ts` — PPN wholesale (VAT OUT+IN) importer → POST → DB → cleanup
- `SEED_TARGET=prod npx tsx scripts/validate-ppn-bintang-jaya.ts [sheet]` — offline PPN importer 검증 (sheet 2601 = OUT 6 + IN 19)
- `SEED_TARGET=prod npx tsx scripts/verify-pph23-put-contract.ts` — PUT `/api/tax/pph23-transactions` inline-edit contract (description / counterparty / grossAmount-recalc / date / 400, 5 assertion, sentinel period 2026-99)
- `SEED_TARGET=prod npx tsx scripts/verify-ppn-put-contract.ts` — PUT `/api/tax/ppn-faktur-monthly` inline-edit contract (counterparty / faktur no/date / dpp→ppn fallback / dpp→dpp_nilai_lain fallback / explicit-ppn-wins / explicit-dpp_nilai_lain-wins / luxury-no-adjust / 400, 8 assertion)

Use `SEED_TARGET=prod` to run any of these against `.env.production.local`. Default is `.env.local` (local Supabase).

## gstack

Use /browse from gstack for all web browsing.
Never use mcp__claude-in-chrome__* tools.
