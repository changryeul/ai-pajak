# Implementation Plan: AI Pajak MVP Initial Setup

**Branch**: `001-initial-setup` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-initial-setup/spec.md`

---

## Summary

AI Pajak MVP 초기 설정 - 인도네시아 세무 신고 자동화 플랫폼의 Next.js 15 + Supabase 기반 풀스택 애플리케이션 구축. 3자 법적 구조(Mono Flip Global, AI Pajak, Jakarta Tax Consulting)를 준수하는 RBAC 기반 멀티테넌트 시스템 구현.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**:
- Next.js 15 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (Auth, PostgreSQL, Storage)
- OpenAI API (Vision for OCR)
- Midtrans (Payment Gateway)

**Storage**: Supabase PostgreSQL (RLS enabled) + Supabase Storage (documents)
**Testing**: Playwright (E2E), Vitest (Unit), MSW (API mocking)
**Target Platform**: Web (responsive), Server: Vercel Edge
**Project Type**: Web application (Next.js monolith with API routes)
**Performance Goals**:
- API response time: <500ms (p95)
- OCR processing: <10s per document
- System uptime: ≥99.5%

**Constraints**:
- PLATFORM_ADMIN cannot access customer tax data
- All DJP filings must be attributed to Jakarta Tax Consulting
- POA required for any tax filing operation
- 10-year audit log retention (Indonesian tax law)

**Scale/Scope**:
- Initial: 3,400 users (200 consultants, 2000 UMKM, 1000 individuals, 200 corporates)
- Database: 67 tables, 1.8M rows/year projected
- Documents: ~50,000 OCR documents/year

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. 법적 주체 분리 (절대 원칙) ✅
- **요구사항**: AI Pajak은 세무 서비스 제공자가 아님
- **구현**: UI에서 "Jakarta Tax Consulting이 세무 서비스 제공" 명시, 모든 신고는 JTC 귀속
- **위반 여부**: ✅ 준수

### II. 이중 계약 요건 (절대 원칙) ✅
- **요구사항**: 플랫폼 ToS + 세무 서비스 계약(POA) 필수
- **구현**: `power_of_attorney` 테이블, `requireValidPOA` 미들웨어
- **위반 여부**: ✅ 준수

### III. PLATFORM_ADMIN 데이터 격리 (절대 원칙) ✅
- **요구사항**: Platform admin은 고객 세무 데이터 접근 불가
- **구현**: `blockPlatformAdmin` 미들웨어, RLS 정책
- **위반 여부**: ✅ 준수

### IV. 2단계 권한 부여 ✅
- **요구사항**: API 계층 + DB 계층 이중 보안
- **구현**: 미들웨어 스택 + RLS 정책
- **위반 여부**: ✅ 준수

### V. 불변 감사 추적 ✅
- **요구사항**: 모든 세무 활동 로깅, 10년 보존
- **구현**: `audit_log` 테이블 (DELETE 권한 없음)
- **위반 여부**: ✅ 준수

### VI. 역할 기반 세무 신고 권한 ✅
- **요구사항**: TAX_ADVISOR만 신고 가능 (POA 필수)
- **구현**: 5개 역할 ENUM, `can_file_tax` 플래그
- **위반 여부**: ✅ 준수

### 기술 스택 요구사항 ✅
- **요구사항**: Next.js + React 19 + Tailwind CSS 4 + Supabase
- **구현**: 명시된 스택 그대로 사용
- **위반 여부**: ✅ 준수

### Gate Result: ✅ PASS
모든 헌법 원칙 준수. Phase 0 진행 가능.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-initial-setup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── auth.yaml
│   ├── customers.yaml
│   ├── tax-filing.yaml
│   └── billing.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── tax/
│   │   │   │   ├── pph21/
│   │   │   │   ├── pph23/
│   │   │   │   ├── ppn/
│   │   │   │   └── spt-tahunan/
│   │   │   ├── documents/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   └── subscription/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   ├── tax/
│   │   ├── ocr/
│   │   ├── payment/
│   │   └── djp/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── forms/              # Form components
│   ├── layout/             # Layout components
│   ├── dashboard/          # Dashboard widgets
│   ├── tax/                # Tax-specific components
│   └── ocr/                # OCR components
├── lib/
│   ├── supabase/           # Supabase client
│   ├── ai/                 # OpenAI integration
│   ├── tax/                # Tax calculation logic
│   ├── payment/            # Midtrans integration
│   ├── djp/                # DJP API integration
│   └── utils/              # Utility functions
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── types/                  # TypeScript types
├── i18n/
│   └── messages/           # i18n translations (id, en)
├── config/                 # App configuration
└── middleware.ts           # Next.js middleware

supabase/
├── migrations/             # Database migrations
├── functions/              # Edge functions
└── config.toml             # Supabase config

tests/
├── e2e/                    # Playwright E2E tests
├── integration/            # Integration tests
└── unit/                   # Unit tests
```

**Structure Decision**: Next.js App Router monolith with API routes. Supabase handles auth, database, and file storage. No separate backend needed.

---

## Complexity Tracking

> No Constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Implementation Phases

### Phase 0: Research (Complete)
- [x] Technology stack confirmation
- [x] Legal structure validation
- [x] Database schema review (67 tables documented)
- [x] API design patterns established

### Phase 1: Foundation (Current)
1. **Project Setup**
   - Next.js 15 + TypeScript + Tailwind CSS 4
   - Supabase project connection
   - shadcn/ui component library
   - ESLint + Prettier configuration

2. **Database**
   - Run migrations (67 tables)
   - RLS policies
   - Seed data (TER rates, KBLI codes, tax treaties)

3. **Authentication**
   - Supabase Auth integration
   - RBAC middleware
   - Role-based route protection

4. **Core API**
   - Auth endpoints
   - Customer CRUD
   - Tax document management

### Phase 2: Features
1. **Tax Filing Module**
   - PPh 21 form
   - PPh 23 form
   - SPT Tahunan form
   - DJP integration

2. **OCR Module**
   - File upload
   - OpenAI Vision integration
   - Data extraction

3. **Billing Module**
   - Subscription management
   - Midtrans integration
   - Invoice generation

### Phase 3: Polish
1. **Testing**
   - E2E tests (5 roles)
   - Security tests (PLATFORM_ADMIN blocking)
   - POA validation tests

2. **Optimization**
   - Performance tuning
   - Caching strategy
   - Error handling

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| DJP API instability | Retry logic, queue system | Planned |
| OCR accuracy <95% | Fallback to manual correction UI | Planned |
| Low consultant adoption | Free 6-month pilot program | In progress |
| Tax law changes | Quarterly regulatory review | Ongoing |

---

## Next Steps

1. Run `/speckit.tasks` to generate detailed task list
2. Set up development environment
3. Initialize Next.js project with configured stack
4. Run database migrations
5. Implement authentication flow

---

**Generated by**: /speckit.plan
**Date**: 2025-12-28
