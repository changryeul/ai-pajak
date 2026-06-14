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
- **next-intl** for i18n — 5 locales: `id` (default), `en`, `ko`, `ja`, `zh`
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
- Admin-side: `admin/*` — `monitoring` (observability), `master/*` (TAX_OPERATOR_MASTER governance)

**Customer dashboard 진입은 `customer.customer_type`(INDIVIDUAL/COMPANY)에 따라 자동 분기**합니다. 같은 `/dashboard` URL이라도 INDIVIDUAL은 개인 SPT 위주 (1770SS/S/1770), COMPANY는 월 신고/결산 wizard 위주의 화면을 받습니다. 이 분기는 server component에서 customer 행을 읽어 결정합니다.

### Middleware Composition (Critical Pattern)
API routes use `composeMiddleware()` from `src/middleware/compose.ts` to chain middleware left-to-right:

```typescript
composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_ADVISOR_JTC), withAudit('ACTION'))
```

Pre-built stacks in `compose.ts`: `taxDataRead()`, `taxDataWrite(action)`, `taxFilingSubmit(action)`, `billingOperation(action)`, `platformAdminOperation()`, `customerOperation(action?)`.

Available middleware: `requireAuth`, `blockPlatformAdmin`, `requireRole(…roles)`, `withAudit(action)`, `requireValidPOA()`, `rate-limit`, `request-id`.

`composeMiddleware()` automatically measures response time, logs with pino (`method`, `route`, `status`, `duration`, `userId`), adds `Server-Timing` header, and reports 5xx errors to Sentry.

### RBAC & Auth
Roles defined in `src/types/auth.ts`:
- `CUSTOMER` (`customer.customer_type` = `INDIVIDUAL` | `COMPANY`) — tax data access
- `CONSULTANT_JTC`, `TAX_ADVISOR_JTC` — JTC internal AND external tax-firm consultants share these role names; the actual partner is determined by `consultant.tax_partner_id` joined to `tax_partner.partner_type` (`JTC` vs `EXTERNAL`)
- `PLATFORM_ADMIN` — platform management only, **never** tax data
- `TAX_OPERATOR`, `TAX_OPERATOR_LEAD`, `TAX_OPERATOR_SUPERVISOR`, `TAX_OPERATOR_MASTER` — operational roles. MASTER is the top tier (Phase K-1.3): platform-wide stats, custom pricing, special-service quotes
- `SYSTEM` — billing operations only

Organizations: `PLATFORM_OWNER`, `PLATFORM`, `TAX_PARTNER` (`src/types/auth.ts` → `OrganizationType`).

Multi-tenancy: a single `tax_partner` row can be `JTC` (internal, `is_platform_partner=true`) or `EXTERNAL` (independent tax firm, Phase B-1). RLS scopes consultant data via `get_consultant_tax_partner_id()` so external firms only see their own customers, never JTC's. `customer.user_id` is nullable since Phase B-2 to allow consultants to register customers without an auth user.

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
- `pph21-calculator.ts` — employee withholding (개정 2024 brackets)
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
    requireRole(UserRole.TAX_ADVISOR_JTC),
    withAudit('ACTION_NAME')
  )(request as RequestWithSession, handleCreate);
}
```

### Operator Filing Workflow
The `djp_submission_queue` table tracks an 11-state operator workflow extended in `20260401000001_workflow_v2.sql`:

```
PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED → EBILLING_GENERATED
→ PAYMENT_PENDING → PAYMENT_UPLOADED → PAYMENT_VERIFIED → DJP_SUBMITTED
→ BPE_UPLOADED → COMPLETED (or FAILED from any state)
```

Role gating:
- **Operator**: `review`, `request-approval`, `generate-ebilling`, `notify-customer`, `verify-payment`, `submit-djp`, `upload-bpe`, `complete`
- **Supervisor only**: `approve`, `reject` (on `PENDING_APPROVAL`), `reassign`
- **Customer side**: the `PAYMENT_PENDING → PAYMENT_UPLOADED` transition is NOT in the operator API. The customer uploads payment proof via `POST /api/customer/payment-proof` (UI at `/tax/billing`), which is the only state machine transition initiated by a non-operator.

Operator API: `PUT /api/operator/queue` with `{ id, action, ...extra }`. The `extra` payload depends on the action (`ebillingCode`, `bpeNumber`, `bpeDate`, `rejectedReason`, `failedReason`).

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

**Master governance** (`TAX_OPERATOR_MASTER` only): `/admin/master` shows MRR/plan distribution/Pro-exceeding customers; `/admin/master/custom-pricing` issues `custom_pricing_quote` rows for customers that need bespoke pricing (Pro 한도 초과, 세무조사, 이전가격 등).

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
- **2FA (TOTP)**: `/api/auth/mfa` — Supabase MFA enroll/verify/unenroll. Settings page UI.
- **Login History**: `/api/auth/sessions` — audit_log based login/failure history.
- **Password Policy**: 8+ chars, uppercase + lowercase + number + special character required.

### i18n
- Config: `src/config/constants.ts` (LOCALES, DEFAULT_LOCALE)
- Message files: `src/i18n/messages/{ko,en,id,ja,zh}.json` (flat JSON per locale, not nested folders)
- Use `useTranslations()` from `next-intl` in components
- Auto-translate helper: `scripts/i18n-auto-translate.ts` (Anthropic SDK; namespace-scoped, dry-run by default)

### Consultant ERP (P0~P6 완료)
세무 사무소 직원(컨설턴트·수퍼바이저) 전용 ERP. PDF 35p 와이어프레임 기반의 5단계 워크플로우 + 공동 거래처 DB + 리갈리티 자료 보관함. 상세 계획서: `docs/01-plan/features/consultant-erp.md`

- **데이터 모델**: 10 테이블 (`consultant_session` + 5 자식 / `counterparty_master` + 2 자식 / `legality_document`) + 5 ENUM. 마이그레이션 2종:
  - `20260516000001_consultant_erp.sql` — 테이블 + RLS
  - `20260516000002_consultant_erp_storage.sql` — bucket `consultant-erp-docs` (20MB private) + storage RLS
- **미들웨어**: `requireConsultantOrSupervisor` — CONSULTANT_JTC / TAX_ADVISOR_JTC / TAX_OPERATOR_SUPERVISOR 만 통과, 그 외 403.
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
- `src/data/landing/` — types, modules (6), pricing (10), and `auto-translated.json` (5 locales, one bundle each)
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
3. **Tax Filing Actor ≠ Platform** — only `TAX_ADVISOR_JTC` can submit filings (Phase B-2.1 relaxed this to "any active consultant from any tax_partner" so external firms can also file for their own customers)
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
| CONSULTANT_JTC (JTC 내부) | — | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC (JTC 내부) | — | advisor.test@jakartatax.co.id | TestPassword123! |
| CONSULTANT_JTC (EXTERNAL — PT Mitra Pajak Sentosa) | — | external.consultant@mitrapajak.com | TestPassword123! |
| TAX_OPERATOR | — | operator.test@aipajak.com | TestPassword123! |
| TAX_OPERATOR_SUPERVISOR | — | supervisor.test@aipajak.com | TestPassword123! |
| TAX_OPERATOR_MASTER | — | master.test@aipajak.com | TestPassword123! |
| PLATFORM_ADMIN | — | admin.test@aipajak.com | TestPassword123! |

Seed scripts:
- `npm run db:seed-test-users` — JTC customers + consultants + admin
- `SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts` — Operator team + EXTERNAL tax_partner + its consultant
- `SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts` — patches `company.test@example.com` to a COMPANY customer (works around `listUsers` pagination on populated DBs)
- `SEED_TARGET=prod npx tsx scripts/seed-individual-billing.ts` — seeds two approved ID Billing rows (PPh21 5M / PPh23 2M) in `EBILLING_GENERATED` for the INDIVIDUAL test customer so `/tax/billing` shows the design-spec demo

Landing / i18n maintenance scripts:
- `npx tsx scripts/translate-landing.ts` — regenerate `src/data/landing/auto-translated.json` (en/id/zh/ja) via Anthropic SDK. Disk cache at `scripts/.translate-cache/` so re-runs only re-call failed parts.
- `npx tsx scripts/sync-individual-pricing-labels.ts` — push the landing's `pricing.typeLabel/description` into the `pricingPlans.SPT_1770*` i18n namespace (5 locales). Re-run whenever individual pricing copy changes.

Verification / regression scripts (회귀 검증):

**Integrated runner** (use this first — covers everything below + roll-up):
- `npm run test:smoke:prod` — runs **~30 steps** in sequence (`scripts/test-smoke-all.ts` is the authoritative list), single PASS/FAIL summary. Coverage families: supervisor ERP (P1 + settings + 6-month trend), invoice lines (Phase 1 read + Phase 2 parser + upload autoParse + line review PATCH), tenant isolation (RLS + external consultant), operator queue 11-state, billing 3-endpoint + monitoring, Track B/D governance (Tax Code Rule + Coretax toggle + luxury classifications + customer-ai templates), customer-ai inbox, importers (pph23/ppn/pph26/wht onesheet/pph21 JTC template), inline-edit PUT contracts (pph23/ppn), invoice photo traceability (pph23 attach + closing pph23 photo status), SPT Masa PPN split, closing credit auto-fill, and `prod schema drift audit` (catches columns silently missing from prod). Steps marked `optional: true` (RLS, billing, monitoring, BINTANG JAYA importer e2e) skip-with-exit-0 when fixtures or env vars are absent — failures there do NOT block the runner.
- `npm run test:smoke` — same against local Supabase (requires `supabase start`).
- `.github/workflows/smoke.yml` — runs `npm run test:smoke:prod` on `workflow_dispatch` and daily at 23:00 UTC (06:00 WIB). Catches drift that lands WITHOUT a commit (rotated API keys, RLS edits in Supabase UI, expired Vercel env vars).
- `.github/workflows/drift-after-deploy.yml` — runs the schema drift audit on every push, waits 90s for Vercel to settle, then probes the prod DB. Complements the daily smoke by catching broken migration pushes within minutes instead of up to 24h.
- Both workflows require repo secrets `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` (optional `E2E_BASE_URL`).

**Individual scripts** (if you need to focus on one area):
- `SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts` — JTC ↔ EXTERNAL tenant isolation
- `SEED_TARGET=prod npx tsx scripts/test-external-consultant-isolation.ts` — external consultant이 JTC 데이터를 절대 못 보는지 end-to-end
- `SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts` — 3 billing endpoints smoke test, graceful-degrade 허용
- `SEED_TARGET=prod npx tsx scripts/test-custom-pricing-flow.ts` — Master custom pricing quote 발행 → 고객 수락 흐름
- `SEED_TARGET=prod npx tsx scripts/test-operator-queue-flow.ts` — 운영팀 11-state 워크플로우 전체 전이
- `SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts` — 결산 wizard ↔ operator queue ↔ BPE 동기화
- `SEED_TARGET=prod npx tsx scripts/test-onboarding-flow.ts` — 신규 가입 → 첫 신고까지 골든 패스
- `SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts` — supervisor → operator 배정/평가 흐름
- `SEED_TARGET=prod npx tsx scripts/test-monitoring-flow.ts` — Sentry / circuit breaker / monitoring dashboard 신호
- `npx tsx scripts/test-advisory-flow.ts` — `/api/customer/advisory` PKP/UMKM/Tax Treaty 응답 shape + INDIVIDUAL/COMPANY/unauth 3-way 검증
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
- `SEED_TARGET=prod npx tsx scripts/validate-pph23-e2e.ts` — PPh23 wholesale importer → POST → DB → cleanup (BINTANG JAYA real xlsx; auto-skip if file absent)
- `SEED_TARGET=prod npx tsx scripts/verify-pph21-strict-template.ts` — PPh21 strict 34-col app template generated in-memory → multipart POST → DB read-back (HR fields preserved) → cleanup. `[STRICT-PPH21-E2E]` sentinel prefix. No fixture dependency (2026-06-14 JTC 양식 retirement)
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
