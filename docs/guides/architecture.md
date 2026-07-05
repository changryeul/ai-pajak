# AI PAJAK Architecture

> 시스템 아키텍처 및 기술 설계 문서

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Web Browser   │  │   Mobile Web    │  │   Tax Advisor Portal    │  │
│  │   (Next.js)     │  │   (Responsive)  │  │                         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
└───────────┼─────────────────────┼───────────────────────┼───────────────┘
            │                     │                       │
            └─────────────────────┼───────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                         Application Layer                                │
│  ┌──────────────────────────────┼──────────────────────────────────┐   │
│  │                        Vercel Edge                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │  Middleware │  │   Static    │  │      API Routes         │  │   │
│  │  │  - Auth     │  │   Assets    │  │  - /api/tax/*           │  │   │
│  │  │  - i18n     │  │   - CSS     │  │  - /api/billing/*       │  │   │
│  │  │  - Rate     │  │   - JS      │  │  - /api/poa/*           │  │   │
│  │  │    Limit    │  │   - Fonts   │  │  - /api/documents/*     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Resilience Layer                             │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐  │   │
│  │  │ Circuit      │ │ Timeout +    │ │ Idempotency  │ │Logging │  │   │
│  │  │ Breaker      │ │ Retry        │ │ Manager      │ │(Pino)  │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                         Service Layer                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Supabase   │  │   Midtrans   │  │    Resend    │  │     DJP     │  │
│  │  - Database  │  │  - Snap      │  │  - SMTP      │  │  - Submit   │  │
│  │  - Auth      │  │  - Webhook   │  │  - Templates │  │  - Status   │  │
│  │  - Storage   │  │              │  │              │  │  - BPE      │  │
│  │  - RLS       │  │              │  │              │  │             │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Next.js App Router)

```
src/app/
├── [locale]/                    # i18n 라우팅
│   ├── (auth)/                  # 인증 페이지 그룹
│   │   ├── login/
│   │   └── register/
│   └── (dashboard)/             # 대시보드 페이지 그룹
│       ├── layout.tsx           # 공통 레이아웃 (Sidebar, Header)
│       ├── dashboard/           # 메인 대시보드
│       ├── tax/                 # 세금 신고
│       ├── billing/             # 결제 관리
│       ├── customers/           # 고객 관리
│       ├── documents/           # 문서 관리
│       ├── poa/                 # 위임장
│       ├── reports/             # 리포트
│       ├── settings/            # 설정
│       └── admin/               # 관리자
│           └── monitoring/      # 시스템 모니터링
└── api/                         # API 라우트
    ├── auth/
    ├── tax/
    ├── billing/
    ├── webhooks/
    └── admin/
```

### API Layer

```
src/app/api/
├── auth/                   # 인증 API
│   └── me/                 # 현재 사용자 정보
├── tax/                    # 세금 API
│   ├── calculate/          # 세금 계산
│   ├── file/               # 세금 신고
│   ├── filings/            # 신고 목록/상세
│   └── spt/                # SPT 양식 생성
│       ├── 1770ss/
│       ├── 1770s/
│       ├── 1770/
│       └── 1771/
├── billing/                # 결제 API
│   ├── invoices/
│   ├── subscription/
│   └── usage/
├── payment/                # 결제 처리
│   └── initiate/
├── webhooks/               # 외부 웹훅
│   ├── midtrans/
│   └── djp/
├── admin/                  # 관리자 API
│   ├── dashboard/
│   └── system-status/
└── health/                 # 헬스체크
```

### Business Logic Layer

```
src/lib/
├── auth/                   # 인증 로직
│   └── session.ts
├── tax/                    # 세금 계산 로직
│   ├── shared/             # 공통 타입/유틸
│   ├── spt-1770ss/
│   ├── spt-1770s/
│   ├── spt-1770/
│   ├── spt-1771/
│   └── bpe/                # BPE 생성
├── billing/                # 결제 서비스
│   └── billing-service.ts
├── payment/                # Midtrans 연동
│   └── midtrans.ts
├── djp/                    # DJP 세무청 연동
│   └── djp-service.ts
├── notifications/          # 알림 서비스
│   ├── email-service.ts
│   └── deadline-reminder.ts
├── resilience/             # 장애 복원력
│   ├── circuit-breaker.ts
│   ├── timeout.ts
│   └── idempotency.ts
├── supabase/               # DB 클라이언트
│   ├── client.ts
│   ├── server.ts
│   └── middleware.ts
├── logger.ts               # 로깅
└── request-context.ts      # 요청 컨텍스트
```

---

## Data Flow

### Tax Filing Flow

```
Customer                Tax Advisor                 System
   │                        │                          │
   │  1. Upload Documents   │                          │
   │───────────────────────>│                          │
   │                        │  2. OCR Processing       │
   │                        │─────────────────────────>│
   │                        │  3. Data Extraction      │
   │                        │<─────────────────────────│
   │                        │                          │
   │                        │  4. Tax Calculation      │
   │                        │─────────────────────────>│
   │                        │  5. Tax Result           │
   │                        │<─────────────────────────│
   │                        │                          │
   │                        │  6. Submit to DJP        │
   │                        │─────────────────────────>│
   │                        │                          │  ┌─────────┐
   │                        │                          │──│   DJP   │
   │                        │                          │  │  Server │
   │                        │                          │<─│         │
   │                        │  7. BPE Generated        │  └─────────┘
   │                        │<─────────────────────────│
   │  8. Notification       │                          │
   │<───────────────────────│                          │
```

### Payment Flow

```
Customer                   System                    Midtrans
   │                         │                          │
   │  1. Initiate Payment    │                          │
   │────────────────────────>│                          │
   │                         │  2. Create Snap Token    │
   │                         │─────────────────────────>│
   │                         │  3. Token + URL          │
   │                         │<─────────────────────────│
   │  4. Redirect to Snap    │                          │
   │<────────────────────────│                          │
   │                         │                          │
   │  5. Complete Payment    │                          │
   │─────────────────────────────────────────────────>│
   │                         │  6. Webhook Notification │
   │                         │<─────────────────────────│
   │                         │  7. Update Status        │
   │                         │  8. Send Email           │
   │  9. Payment Confirmed   │                          │
   │<────────────────────────│                          │
```

---

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Auth                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Sign Up    │  │   Sign In    │  │   Session Mgmt   │  │
│  │  - Email     │  │  - Email/PW  │  │  - JWT Tokens    │  │
│  │  - Password  │  │  - OAuth     │  │  - Refresh       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Middleware Stack                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Rate Limit  │─>│   Auth       │─>│   RBAC           │  │
│  │  (Upstash)   │  │  (Session)   │  │  (Role Check)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Row Level Security                        │
│  - Customer can only access their own data                  │
│  - Tax Advisor needs active POA                             │
│  - Platform Admin has no access to tax data                 │
└─────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

| Role | Tax Data | Customer Data | Billing | Admin |
|------|----------|---------------|---------|-------|
| CUSTOMER | Own only | Own only | Own only | ❌ |
| CONSULTANT | Calculate only | With POA | ❌ | ❌ |
| TAX_ADVISOR | Full (with POA) | With POA | ❌ | ❌ |
| PLATFORM_ADMIN | ❌ | ❌ (aggregated only) | View | ✅ |
| SYSTEM | ❌ | ❌ | Create | ✅ |

---

## Resilience Patterns

### Circuit Breaker States

```
         failures >= threshold
    ┌────────────────────────────┐
    │                            │
    ▼                            │
┌────────┐   success    ┌────────┴───┐   resetTimeout   ┌───────────┐
│ CLOSED │<─────────────│ HALF_OPEN  │<─────────────────│   OPEN    │
└────────┘              └────────────┘                  └───────────┘
    │                         │                              ▲
    │                         │ failure                      │
    │                         └──────────────────────────────┘
    │                                                        │
    └────────────────────────────────────────────────────────┘
                     failures >= threshold
```

### Service Configuration

| Service | Failure Threshold | Reset Timeout | Retry Count |
|---------|-------------------|---------------|-------------|
| DJP | 3 | 60s | 2 |
| Midtrans | 5 | 30s | 2 |
| Email | 3 | 60s | 2 |
| OCR | 3 | 30s | 2 |

---

## Deployment Architecture

### Vercel Deployment

```
┌──────────────────────────────────────────────────────────┐
│                    Vercel Platform                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │                  Edge Network                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  CDN     │  │Middleware│  │  Edge Functions  │  │  │
│  │  │ (Static) │  │(Rate Lim)│  │                  │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Serverless Functions                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ API      │  │ Cron     │  │  Webhook         │  │  │
│  │  │ Routes   │  │ Jobs     │  │  Handlers        │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Region: sin1 (Singapore)                                │
└──────────────────────────────────────────────────────────┘
```

### Environment Configuration

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Production | app.aipajak.com | Supabase Prod | Live users |
| Preview | pr-*.vercel.app | Supabase Dev | PR testing |
| Development | localhost:3000 | Supabase Local | Development |

---

## Monitoring & Observability

### Health Checks

```
/api/health          - Basic health (200/503)
/api/admin/system-status - Detailed status (auth required)
```

### Metrics Collected

| Category | Metrics |
|----------|---------|
| System | Uptime, Memory, CPU |
| Database | Connection status, Latency |
| Services | Circuit breaker state, Failure count |
| API | Request count, Error rate, Latency |

### Logging

```json
{
  "level": "info",
  "time": "2026-02-14T10:00:00Z",
  "requestId": "uuid",
  "userId": "uuid",
  "module": "payment",
  "msg": "Payment initiated",
  "transactionId": "uuid",
  "amount": 555000
}
```

---

**Last Updated**: 2026-02-14
