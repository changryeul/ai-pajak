# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

사용자와의 대화는 항상 **한국어**로 응답한다. 코드, 변수명, 커밋 메시지는 영어를 유지한다.

## What This Is

AI Pajak — Indonesian tax filing automation platform for Jakarta Tax Consulting (JTC). Supports SPT forms 1770SS, 1770S, 1770, 1771. Written in Korean (README/docs) but the code is in English.

## Commands

```bash
npm run dev                # Dev server (Turbopack)
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
- `(dashboard)/` — billing, customers, documents, filings, poa, reports, settings, tax
- `(public)/` — public pages

API routes live at `src/app/api/` (not locale-prefixed).

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
Each SPT form has its own directory under `src/lib/tax/`:
- `spt-1770ss/` — simple employee form
- `spt-1770s/` — mixed income
- `spt-1770/` — business income
- `spt-1771/` — corporate

Shared types/constants in `src/lib/tax/shared/` (PTKP rates, tax brackets, common types).
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

### Authentication & Security
- **2FA (TOTP)**: `/api/auth/mfa` — Supabase MFA enroll/verify/unenroll. Settings page UI.
- **Login History**: `/api/auth/sessions` — audit_log based login/failure history.
- **Password Policy**: 8+ chars, uppercase + lowercase + number + special character required.

### i18n
- Config: `src/config/constants.ts` (LOCALES, DEFAULT_LOCALE)
- Message files: `src/i18n/messages/{locale}/`
- Use `useTranslations()` from `next-intl` in components

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
- `SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts` — verifies JTC ↔ EXTERNAL tenant isolation
- `SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts` — smoke test for the 3 billing endpoints, tolerates graceful-degrade responses

Use `SEED_TARGET=prod` to run any of these against `.env.production.local`. Default is `.env.local` (local Supabase).
##gstack 
Use /browse from gstack for all web browsing.
Never use mcp__claude-in-chrome__* tools.
