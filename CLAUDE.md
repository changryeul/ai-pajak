# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run test:e2e:platform-admin     # Platform admin role only

# Database
supabase start             # Local Supabase
supabase migration up      # Apply migrations
supabase db reset          # Reset & re-seed
npm run db:seed-test-users # Seed test users via tsx
```

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + **TypeScript** strict + **React 19**
- **Supabase** (PostgreSQL + Auth + RLS) — `@supabase/ssr` for cookie-based sessions
- **shadcn/ui** + **Tailwind CSS 4** + **Radix UI** primitives
- **next-intl** for i18n — 5 locales: `id` (default), `en`, `ko`, `ja`, `zh`
- **Midtrans** for payments, **Resend** for email
- **Anthropic SDK + OpenAI** for AI features (OCR, document processing)
- **Sentry** for error monitoring, **pino** for structured logging
- **Zod 4** for validation, **React Hook Form** + **@hookform/resolvers** for forms
- **@tanstack/react-query** for data fetching, **zustand** for client state

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

### i18n
- Config: `src/config/constants.ts` (LOCALES, DEFAULT_LOCALE)
- Message files: `src/i18n/messages/{locale}/`
- Use `useTranslations()` from `next-intl` in components

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
- Structured logging via `pino` — not `console.log`

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| CUSTOMER | customer.test@example.com | TestPassword123! |
| CONSULTANT_JTC | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | TestPassword123! |
| PLATFORM_ADMIN | admin.test@aipajak.com | TestPassword123! |
