# AI Pajak Development Guidelines

> Last Updated: 2026-02-14

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5.x (strict mode)
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Auth**: Supabase Auth
- **i18n**: next-intl (ko, en, id, ja, zh)
- **Payment**: Midtrans
- **Testing**: Vitest + Playwright

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── [locale]/        # i18n routes
│   │   ├── (auth)/      # Auth pages
│   │   └── (dashboard)/ # Dashboard pages
│   └── api/             # API routes
├── components/          # React components
├── lib/                 # Business logic
│   ├── tax/             # Tax calculation (SPT 1770SS/S/1770/1771)
│   ├── billing/         # Billing service
│   ├── djp/             # DJP integration
│   └── payment/         # Midtrans
├── middleware/          # API middleware (auth, RBAC, audit)
├── i18n/messages/       # Translations
└── tests/               # Tests
```

## Commands

```bash
# Development
npm run dev              # Start dev server

# Build & Test
npm run build           # Production build
npm test                # Unit tests
npm run lint            # ESLint

# Database
supabase start          # Start local DB
supabase migration up   # Apply migrations
supabase db reset       # Reset & re-seed

# E2E Tests
npm run test:e2e        # Playwright tests
```

## Code Conventions

### API Routes

```typescript
// Use middleware composition
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handler);
}
```

### Components

- Use `'use client'` only when needed
- Prefer server components
- Use `useTranslations()` from next-intl

### Database

- All tax data protected by RLS
- PLATFORM_ADMIN blocked from customer tax data
- Audit trail required for tax operations

## Security Rules (5 Hard Rules)

1. **PLATFORM_ADMIN cannot access customer tax data** - `blockPlatformAdmin` middleware
2. **Consultant must belong to JTC** - FK + RLS
3. **Tax Filing Actor ≠ Platform** - Consultant role check
4. **Billing Collector ≠ Service Provider** - SYSTEM-only billing
5. **Audit Trail Required** - `withAudit` middleware

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| CUSTOMER | customer.test@example.com | TestPassword123! |
| CONSULTANT_JTC | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | TestPassword123! |
| PLATFORM_ADMIN | admin.test@aipajak.com | TestPassword123! |

## Recent Changes

- 2026-02-14: Added NIK column to customer table
- 2026-02-14: Implemented Reports API with real data
- 2026-02-14: Implemented Settings page (profile, password, notifications)
- 2026-02-13: Added DJP integration APIs
- 2026-02-12: Implemented Midtrans payment integration
- 2026-02-11: Added notification system with deadline reminders
- 2026-02-10: Implemented all SPT forms (1770SS, 1770S, 1770, 1771)

## Key Files

| File | Description |
|------|-------------|
| `src/lib/tax/shared/types.ts` | Common tax types |
| `src/lib/tax/shared/constants.ts` | PTKP rates, tax brackets |
| `src/middleware/auth.ts` | Auth middleware |
| `src/middleware/blockPlatformAdmin.ts` | Security middleware |
| `supabase/migrations/` | Database migrations |

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
