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
- `CUSTOMER`, `CONSULTANT_JTC`, `TAX_ADVISOR_JTC` — tax data access
- `PLATFORM_ADMIN` — platform management only, **never** tax data
- `TAX_OPERATOR`, `TAX_OPERATOR_LEAD`, `TAX_OPERATOR_SUPERVISOR` — operational roles
- `SYSTEM` — billing operations only

Organizations: `PLATFORM_OWNER`, `PLATFORM`, `TAX_PARTNER` (`src/types/auth.ts` → `OrganizationType`).

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
The `djp_submission_queue` table tracks a multi-step operator workflow:

```
PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED → EBILLING_GENERATED
→ PAYMENT_PENDING → PAYMENT_UPLOADED → PAYMENT_VERIFIED → DJP_SUBMITTED
→ BPE_UPLOADED → COMPLETED (or FAILED from any state)
```

State transitions are role-gated: supervisor-only actions (`approve`/`reject` on `PENDING_APPROVAL`), operator actions for everything else. API: `PUT /api/operator/queue` with `action` + `itemId`.

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
2. **Consultant must belong to JTC** — FK constraint + RLS
3. **Tax Filing Actor ≠ Platform** — only `TAX_ADVISOR_JTC` can submit filings
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
| CONSULTANT_JTC | — | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC | — | advisor.test@jakartatax.co.id | TestPassword123! |
| PLATFORM_ADMIN | — | admin.test@aipajak.com | TestPassword123! |
