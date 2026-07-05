# Research: AI Pajak MVP Initial Setup

**Branch**: `001-initial-setup` | **Date**: 2025-12-28
**Purpose**: Resolve all technical decisions and unknowns before implementation

---

## 1. Technology Stack Decisions

### 1.1 Frontend Framework

**Decision**: Next.js 15 (App Router)

**Rationale**:
- Constitution 명시 요구사항
- Server Components로 초기 로드 성능 최적화
- App Router의 nested layouts으로 복잡한 대시보드 구조 지원
- Vercel 배포 최적화

**Alternatives Considered**:
- Remix: SSR 우수하나 Supabase 통합 문서 부족
- Nuxt 3: Vue 생태계, React 19 요구사항 불일치
- SvelteKit: 팀 학습 곡선

### 1.2 UI Component Library

**Decision**: shadcn/ui + Tailwind CSS 4

**Rationale**:
- Copy-paste 방식으로 번들 크기 최적화
- Radix UI 기반 접근성 우수
- Tailwind CSS 4 호환
- 커스터마이징 용이

**Alternatives Considered**:
- Chakra UI: 번들 크기 큼
- MUI: React 19 완전 호환 미확인
- Ant Design: 중국어 중심 문서

### 1.3 State Management

**Decision**: Zustand + React Query (TanStack Query)

**Rationale**:
- Zustand: 클라이언트 상태 (UI, 세션)
- React Query: 서버 상태 (API 캐싱, 동기화)
- 경량, TypeScript 우수

**Alternatives Considered**:
- Redux Toolkit: 보일러플레이트 과다
- Jotai: 원자적 상태에 적합하나 복잡한 상태 관리 어려움
- Recoil: Meta 지원 중단 우려

### 1.4 Form Management

**Decision**: React Hook Form + Zod

**Rationale**:
- 성능 최적화 (비제어 컴포넌트)
- Zod 스키마로 타입 안전 검증
- shadcn/ui Form 컴포넌트와 통합

**Alternatives Considered**:
- Formik: 리렌더링 이슈
- Final Form: 유지보수 불활성

### 1.5 Internationalization

**Decision**: next-intl

**Rationale**:
- Next.js App Router 완벽 지원
- Server Components 호환
- Type-safe 메시지 키

**Alternatives Considered**:
- react-i18next: Server Components 지원 제한
- next-translate: 업데이트 불규칙

---

## 2. Backend Decisions

### 2.1 Database

**Decision**: Supabase PostgreSQL + RLS

**Rationale**:
- Constitution 명시 요구사항
- Row Level Security로 멀티테넌시 구현
- 실시간 구독 지원
- Edge Functions 지원

**Alternatives Considered**:
- PlanetScale: MySQL 기반, RLS 미지원
- Neon: 신규 서비스, 안정성 미검증
- Self-hosted PostgreSQL: 운영 오버헤드

### 2.2 Authentication

**Decision**: Supabase Auth

**Rationale**:
- Constitution 명시 요구사항
- 이메일/소셜 로그인 지원
- JWT 기반, RLS와 통합
- 무료 티어 충분

**Alternatives Considered**:
- Auth0: 비용 (MAU 기반)
- Clerk: Supabase RLS 통합 복잡
- NextAuth.js: 자체 구현 필요

### 2.3 File Storage

**Decision**: Supabase Storage

**Rationale**:
- RLS와 통합
- CDN 내장
- 50GB 무료

**Alternatives Considered**:
- AWS S3: 별도 IAM 관리
- Cloudflare R2: Supabase RLS 통합 불가

### 2.4 API Design

**Decision**: Next.js API Routes (REST)

**Rationale**:
- 별도 백엔드 서버 불필요
- Edge Runtime 지원
- 모노레포 단순성

**Alternatives Considered**:
- tRPC: 외부 API 공개 어려움
- GraphQL: 학습 곡선, 복잡성
- Separate Express/Fastify: 배포 복잡성

---

## 3. Integration Decisions

### 3.1 OCR Engine

**Decision**: OpenAI Vision API (GPT-4o)

**Rationale**:
- 인도네시아어 문서 인식 우수
- 구조화된 JSON 출력 지원
- 95%+ 정확도 목표 달성 가능

**Configuration**:
```typescript
{
  model: "gpt-4o",
  max_tokens: 4096,
  response_format: { type: "json_object" }
}
```

**Alternatives Considered**:
- Google Document AI: 가격 경쟁력 낮음
- AWS Textract: 인도네시아어 지원 제한
- 자체 훈련 모델: 리소스/시간 부족

### 3.2 Payment Gateway

**Decision**: Midtrans

**Rationale**:
- 인도네시아 시장 점유율 1위
- 다양한 결제 수단 (VA, e-wallet, CC)
- Snap API로 빠른 통합

**Configuration**:
```typescript
{
  environment: "production",
  paymentMethods: ["bank_transfer", "gopay", "shopeepay", "credit_card"]
}
```

**Alternatives Considered**:
- Stripe: 인도네시아 미지원
- Xendit: Midtrans 대비 수수료 높음

### 3.3 DJP Integration

**Decision**: DJP e-Filing & e-Billing API

**Rationale**:
- 공식 API 사용
- Jakarta Tax Consulting의 PJAP 라이선스 필요
- 모든 신고는 JTC 명의로 제출

**Configuration**:
```typescript
{
  endpoint: "https://djponline.pajak.go.id/api",
  authMethod: "certificate",
  certificateOwner: "Jakarta Tax Consulting"
}
```

**Risk Mitigation**:
- 재시도 로직 (exponential backoff)
- 큐 시스템 (Supabase Edge Functions + pg_cron)
- 실패 시 수동 제출 폴백

---

## 4. Security Decisions

### 4.1 Authentication Flow

**Decision**: JWT + Refresh Token (Supabase default)

**Configuration**:
```typescript
{
  accessTokenExpiry: "1h",
  refreshTokenExpiry: "7d",
  refreshTokenRotation: true
}
```

### 4.2 API Security Middleware

**Decision**: Layered middleware stack

```typescript
// Tax data endpoints
app.use(
  requireAuth,
  blockPlatformAdmin,  // Constitution III
  requireRole(['CUSTOMER', 'CONSULTANT', 'TAX_ADVISOR']),
  withAudit
);

// Tax filing endpoints (additional)
app.use(requireValidPOA);  // Constitution II
```

### 4.3 Data Encryption

**Decision**:
- At rest: Supabase default (AES-256)
- In transit: TLS 1.3
- NPWP 마스킹: 표시 시 `**.***.***.X-XXX.XXX`

### 4.4 Audit Logging

**Decision**: Immutable audit_log table

```sql
CREATE TABLE audit_log (
  -- ...
);

-- No DELETE policy
CREATE POLICY "audit_log_no_delete" ON audit_log
  FOR DELETE USING (false);
```

**Retention**: 10 years (UU KUP 요구사항)

---

## 5. Performance Decisions

### 5.1 Caching Strategy

**Decision**: Multi-layer caching

| Layer | Technology | TTL | Use Case |
|-------|-----------|-----|----------|
| CDN | Vercel Edge | 1h | Static assets |
| API | React Query | 5m | List data |
| DB | Supabase | - | Connection pooling |

### 5.2 Database Optimization

**Indexes** (pre-defined in docs/ERD):
```sql
CREATE INDEX idx_tax_documents_company_period
  ON tax_documents(company_id, period_year, period_month);
```

**Connection Pooling**: Supabase Supavisor (default)

### 5.3 Image Optimization

**Decision**: Next.js Image component + Supabase CDN

```typescript
<Image
  src={supabaseUrl}
  placeholder="blur"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

## 6. Deployment Decisions

### 6.1 Hosting

**Decision**: Vercel (Frontend + API) + Supabase (Backend)

**Rationale**:
- Next.js 공식 플랫폼
- Edge Functions 지원
- 자동 스케일링

### 6.2 Environments

| Environment | URL | Supabase Project |
|------------|-----|------------------|
| Development | localhost:3000 | ai-pajak-dev |
| Staging | staging.ai-pajak.com | ai-pajak-staging |
| Production | app.ai-pajak.com | ai-pajak-prod |

### 6.3 CI/CD

**Decision**: GitHub Actions

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    - vitest run
    - playwright test
  deploy:
    - vercel deploy
```

---

## 7. Testing Decisions

### 7.1 Testing Framework

**Decision**:
- Unit: Vitest
- Integration: Vitest + MSW
- E2E: Playwright

### 7.2 Test Coverage Requirements

| Category | Minimum | Target |
|----------|---------|--------|
| Unit | 70% | 85% |
| Integration | 50% | 70% |
| E2E Critical Paths | 100% | 100% |

### 7.3 Security Test Cases (Constitution)

```typescript
describe('PLATFORM_ADMIN blocking', () => {
  it('should block access to /api/tax/* endpoints');
  it('should block access to customer tax data');
  it('should log blocked access attempts');
});

describe('POA validation', () => {
  it('should require valid POA for tax filing');
  it('should reject expired POA');
  it('should reject POA for wrong customer');
});
```

---

## 8. Monitoring Decisions

### 8.1 Error Tracking

**Decision**: Sentry

```typescript
Sentry.init({
  dsn: "...",
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV
});
```

### 8.2 Analytics

**Decision**: PostHog (self-hosted option available)

```typescript
posthog.capture('tax_filing_submitted', {
  tax_type: 'PPH_21',
  period: '2025-01'
});
```

### 8.3 Uptime Monitoring

**Decision**: Vercel Analytics + UptimeRobot

---

## 9. Outstanding Questions (Resolved)

| # | Question | Resolution |
|---|----------|------------|
| 1 | DJP API 인증 방식? | Certificate-based (JTC PJAP 라이선스) |
| 2 | OCR 비용 예측? | ~$0.01/page (GPT-4o), 월 $500 예산 |
| 3 | Midtrans 수수료? | 2.9% + IDR 2,500 (CC), 1% (VA) |
| 4 | RLS 성능 영향? | Minimal (<5ms overhead per query) |
| 5 | 다국어 지원 범위? | 인도네시아어 (primary), 영어 (secondary) |

---

## 10. Dependencies Summary

### NPM Packages

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "zustand": "^5.x",
    "@tanstack/react-query": "^5.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "next-intl": "^3.x",
    "openai": "^4.x",
    "midtrans-client": "^1.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@playwright/test": "^1.x",
    "msw": "^2.x"
  }
}
```

### External Services

| Service | Purpose | Account Required |
|---------|---------|-----------------|
| Supabase | Database, Auth, Storage | ✅ |
| OpenAI | OCR (Vision API) | ✅ |
| Midtrans | Payments | ✅ |
| Vercel | Hosting | ✅ |
| Sentry | Error tracking | ✅ |
| PostHog | Analytics | Optional |

---

**Research Completed**: 2025-12-28
**Ready for**: Phase 1 (Design & Contracts)
