# AI Pajak

인도네시아 세금 신고 자동화 플랫폼

## 주요 기능

### 구현 완료
- **세금 신고** - SPT 1770SS, 1770S, 1770, 1771 양식 지원
- **문서 관리** - OCR 기반 Form 1721-A1 자동 인식
- **고객 관리** - NPWP/NIK 기반 고객 프로필
- **위임장 (POA)** - 디지털 서명 및 QR 코드
- **결제** - Midtrans 연동 (멱등성 지원)
- **DJP 연동** - 인도네시아 세무청 API 연동
- **리포트** - 세금 요약, 신고 이력, 결제 내역
- **알림** - 마감일 알림, 결제 알림
- **다국어** - 한국어, 영어, 인도네시아어, 일본어, 중국어
- **모니터링** - 시스템 상태 대시보드

### Resilience 패턴
- **Circuit Breaker** - 외부 서비스 장애 전파 방지
- **Timeout + Retry** - 지수 백오프 재시도
- **Idempotency** - 중복 결제 방지
- **Structured Logging** - JSON 기반 구조화 로깅

### 준비 중
- **2FA** - 2단계 인증

## 프로젝트 구조

```
ai-pajak/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # 다국어 라우팅 (ko/en/id/ja/zh)
│   │   │   ├── (auth)/         # 인증 페이지
│   │   │   └── (dashboard)/    # 대시보드
│   │   │       ├── billing/    # 결제 관리
│   │   │       ├── customers/  # 고객 관리
│   │   │       ├── documents/  # 문서 관리
│   │   │       ├── filings/    # 세금 신고
│   │   │       ├── poa/        # 위임장
│   │   │       ├── reports/    # 리포트
│   │   │       ├── settings/   # 설정
│   │   │       └── tax/        # 세금 계산
│   │   └── api/                # API 라우트
│   │       ├── auth/           # 인증 API
│   │       ├── billing/        # 결제 API
│   │       ├── customers/      # 고객 API
│   │       ├── djp/            # DJP 연동 API
│   │       ├── documents/      # 문서 API
│   │       ├── notifications/  # 알림 API
│   │       ├── poa/            # 위임장 API
│   │       ├── reports/        # 리포트 API
│   │       ├── settings/       # 설정 API
│   │       ├── tax/            # 세금 API
│   │       └── webhooks/       # 웹훅 API
│   ├── components/             # React 컴포넌트
│   │   ├── ui/                 # shadcn/ui 컴포넌트
│   │   ├── layout/             # 레이아웃
│   │   ├── dashboard/          # 대시보드 위젯
│   │   ├── documents/          # 문서 컴포넌트
│   │   └── spt/                # SPT 양식 컴포넌트
│   ├── lib/                    # 유틸리티 라이브러리
│   │   ├── auth/               # 인증
│   │   ├── ai/                 # AI 기능
│   │   ├── billing/            # 결제 서비스
│   │   ├── djp/                # DJP 연동
│   │   ├── notifications/      # 알림 서비스
│   │   ├── ocr/                # OCR 처리
│   │   ├── payment/            # 결제 (Midtrans)
│   │   ├── supabase/           # DB 클라이언트
│   │   └── tax/                # 세금 계산
│   │       ├── shared/         # 공통 타입/유틸
│   │       ├── spt-1770ss/     # SPT 1770 SS
│   │       ├── spt-1770s/      # SPT 1770 S
│   │       ├── spt-1770/       # SPT 1770
│   │       ├── spt-1771/       # SPT 1771
│   │       └── bpe/            # BPE 생성
│   ├── types/                  # TypeScript 타입
│   ├── i18n/                   # 다국어 설정
│   │   └── messages/           # 번역 파일 (ko/en/id/ja/zh)
│   ├── middleware/             # API 미들웨어
│   └── tests/                  # 테스트
│       └── e2e/                # E2E 테스트
├── docs/                       # 문서
│   ├── API/                    # API 명세
│   ├── ERD/                    # 데이터베이스 설계
│   ├── PRD/                    # 요구사항 문서
│   ├── UI/                     # UI/UX 설계
│   └── guides/                 # 가이드
├── supabase/                   # Supabase 설정
│   └── migrations/             # DB 마이그레이션
└── public/                     # 정적 파일
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm 9+
- Supabase CLI

### 설치

```bash
# 의존성 설치
npm install

# Supabase 시작 (로컬)
supabase start

# 마이그레이션 적용
supabase migration up

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 확인

### 명령어

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 테스트
npm test

# 린트
npm run lint

# E2E 테스트
npm run test:e2e
```

## 기술 스택

| 카테고리 | 기술 |
|---------|------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5.x (strict mode) |
| **Database** | Supabase (PostgreSQL) |
| **UI** | shadcn/ui + Tailwind CSS 4 |
| **Auth** | Supabase Auth |
| **i18n** | next-intl |
| **Payment** | Midtrans |
| **PDF** | @react-pdf/renderer |
| **OCR** | Google Cloud Vision |
| **Testing** | Vitest + Playwright |

## 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|-----|--------|---------|
| CUSTOMER | customer.test@example.com | TestPassword123! |
| CONSULTANT_JTC | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | TestPassword123! |
| PLATFORM_ADMIN | admin.test@aipajak.com | TestPassword123! |

## 환경 변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Midtrans
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-client-key

# Google Cloud Vision (OCR)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CREDENTIALS=your-credentials
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                           Vercel                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │   Next.js     │  │    API        │  │     Cron Jobs     │   │
│  │   App Router  │  │   Routes      │  │  (Vercel Cron)    │   │
│  │   + Turbopack │  │   + Middleware│  │                   │   │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘   │
│          │                  │                    │              │
│          └──────────────────┼────────────────────┘              │
│                             │                                   │
│  ┌──────────────────────────┼──────────────────────────────┐   │
│  │              Resilience Layer                            │   │
│  │  Circuit Breaker │ Timeout/Retry │ Idempotency │ Logging │   │
│  └──────────────────────────┼──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ Supabase │         │ Midtrans │         │  Resend  │
  │ Database │         │ Payment  │         │  Email   │
  │ + Auth   │         │          │         │          │
  └──────────┘         └──────────┘         └──────────┘
        │
        ▼
  ┌──────────┐
  │   DJP    │
  │ Tax API  │
  └──────────┘
```

## 문서

### 개발 가이드
- [Resilience 패턴](docs/guides/resilience-patterns.md)
- [API 레퍼런스](docs/API/api-reference.md)
- [배포 가이드](DEPLOYMENT.md)

### 설계 문서
- [API 구현 상태](docs/API/implementation-status.md)
- [데이터베이스 설계](docs/ERD/README.md)
- [MVP 범위](docs/PRD/mvp-scope.md)
- [Supabase 가이드](supabase/README.md)

## 라이선스

Proprietary - All rights reserved
