# AI Pajak

인도네시아 세금 신고 자동화 플랫폼 — Jakarta Tax Consulting (JTC) 운영

> 법인·개인 납세자, JTC 내부 세무사, 외부 세무 사무소, 운영팀까지 한 플랫폼에서 다루는 multi-tenant 세무 SaaS.

**프로덕션**: https://ai-pajak.vercel.app

## 핵심 기능

### 세무 신고
- **월 신고 (SPT Masa)** — PPh 21·22·23·25·26·4(2), PPN(부가세)
- **연 신고 (SPT Tahunan)** — 1770SS·1770S·1770(개인), 1771(법인 — 현재 BETA)
- **자동 계산** — PTKP·세율·BPJS·UMKM Final 등 인도네시아 세법 자동 반영
- **OCR** — Form 1721-A1, Faktur Pajak, 인보이스 등 사진/PDF에서 자동 입력 (Anthropic + OpenAI)
- **DJP 연동** — eBilling 발급, Coretax 제출, BPE(전자접수증) 자동 회수

### Multi-tenant 세무 사무소 (Phase B)
- **JTC 내부**: 1차 운영 사무소, 모든 고객 접근 가능
- **EXTERNAL tax_partner**: 외부 사무소가 회원가입하여 본인 고객만 격리된 공간에서 관리
- **RLS 기반 데이터 격리**: `get_consultant_tax_partner_id()` 함수로 cross-tenant 누수 차단
- **외부 사무소 Tier 구독**: Starter / Growth / Enterprise

### 요금제 (Phase K, D)
3개의 결제 surface, 각각 자체 config·엔드포인트·DB 테이블:

| Surface | 대상 | 요금 | 결제 주기 |
|---|---|---|---|
| **Corporate plans** | 법인 고객 (COMPANY) | UMKM 50만 / Basic 150만 / Pro 300만 IDR | 월 구독 |
| **Consultant tier** | 외부 세무 사무소 | Starter 100만 / Growth 300만 / Enterprise 800만 IDR | 월 구독 |
| **Individual SPT** | 개인 고객 (INDIVIDUAL) | 1770SS 10만 / 1770S 20만 / 1770 30만 IDR | 건당 |

VAT 11% 별도. Pro·Enterprise 한도를 초과하는 고객은 **마스터의 맞춤 견적(Custom Pricing Quote)** 으로 별도 산정.

### 운영팀 워크플로우
`djp_submission_queue` 10단계 — 고객의 "제출" 이후 운영팀이 데이터 검토, 승인, eBilling 발급, 입금 확인, DJP 제출, BPE 업로드까지 전 과정을 처리.

### 보안 (Hard Rules)
1. PLATFORM_ADMIN은 고객 세무 데이터 접근 불가
2. Consultant는 등록된 tax_partner에만 속할 수 있음 (cross-tenant 차단)
3. 신고 제출 권한 ≠ 플랫폼 관리 권한
4. 결제 처리 ≠ 서비스 제공 (역할 분리)
5. 모든 쓰기 조치는 감사 로그(`audit_log`) 자동 기록

### Resilience 패턴
- **Circuit Breaker** — DJP·Midtrans·Anthropic 등 외부 API 장애 격리
- **Idempotency Key** — 중복 결제·중복 제출 방지
- **Graceful Degrade** — 결제 게이트웨이 미연동 시에도 PENDING_PAYMENT 행을 보존, PG 도착 후 자동 재개
- **Structured Logging** — pino 기반 JSON 로깅, Sentry로 에러 자동 전송

### 보안·인증
- **2FA (TOTP)** — Supabase MFA 기반, 운영팀·관리자 권장
- **Audit Log** — 모든 쓰기 조치 자동 기록, 7년 보존
- **Role-Based Access Control** — 8개 역할 + 4개 조직 유형
- **Row Level Security** — Postgres RLS로 행 단위 접근 제어

## 역할

| 역할 | 설명 | 비고 |
|---|---|---|
| `CUSTOMER` | 개인(INDIVIDUAL) 또는 법인(COMPANY) 납세자 | 본인 데이터만 |
| `CONSULTANT_JTC` | JTC 또는 EXTERNAL `tax_partner` 소속 일반 컨설턴트 | 배정 고객만 |
| `TAX_ADVISOR_JTC` | 선임 세무사 | 신고 최종 제출 권한 |
| `TAX_OPERATOR` | 백오피스 일반 운영자 | 큐 검토·처리 |
| `TAX_OPERATOR_SUPERVISOR` | 운영 수퍼바이저 | 승인·분배·통계 |
| `TAX_OPERATOR_MASTER` | 운영 마스터 | 플랫폼 통계, 맞춤 가격 발행 |
| `PLATFORM_ADMIN` | 플랫폼 관리자 | 인프라·사용자 관리 (세무 데이터 접근 불가) |
| `SYSTEM` | 시스템 계정 | 결제 자동화 전용 |

## 사용자 매뉴얼

역할별 한국어 시나리오형 매뉴얼:

- [법인 납세자](docs/manuals/01-corporate-customer.md)
- [외부 세무 사무소](docs/manuals/02-external-consultant.md)
- [개인 납세자](docs/manuals/03-individual-customer.md)
- [운영팀](docs/manuals/04-tax-operator.md)
- [JTC 세무사](docs/manuals/05-jtc-consultant.md)
- [플랫폼 관리자](docs/manuals/06-platform-admin.md)
- [인덱스 + 용어 사전](docs/manuals/README.md)

앱 내에서도 `/help/manuals` 경로로 동일한 콘텐츠를 렌더링합니다.

## 시작하기

### 사전 요구사항
- Node.js 20+ (LTS)
- npm 10+ 또는 pnpm
- Supabase CLI
- Docker (로컬 Supabase용)

### 설치

```bash
# 의존성 설치
npm install

# 환경변수 복사 후 값 채우기
cp .env.example .env.local

# 로컬 Supabase 시작
supabase start

# 마이그레이션 적용
supabase migration up

# 테스트 사용자 시드
npm run db:seed-test-users

# 개발 서버
npm run dev
```

http://localhost:3000

### 자주 쓰는 명령어

```bash
npm run dev                # 개발 서버 (Turbopack)
npm run build              # 프로덕션 빌드
npm run lint               # ESLint
npm test                   # Vitest 단위 테스트
npm run test:watch         # Vitest watch 모드
npm run test:coverage      # 커버리지

# E2E (로컬 dev 서버 + Supabase 필요)
npm run test:e2e
npm run test:e2e:customer
npm run test:e2e:consultant
npm run test:e2e:tax-advisor
npm run test:e2e:platform-admin

# 데이터베이스
supabase start                                                # 로컬 시작
supabase migration up                                          # 마이그레이션
supabase db reset                                              # 리셋 + 시드
npm run db:seed-test-users                                     # JTC 측 테스트 사용자

# 추가 시드 (운영팀 · 외부 사무소 · 회사 고객)
SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts
SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts

# 검증 스크립트
SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts       # tenant 격리 검증
SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts          # 3개 결제 엔드포인트 스모크
SEED_TARGET=prod npx tsx scripts/test-custom-pricing-flow.ts   # 맞춤 가격 수락 E2E
SEED_TARGET=prod npx tsx scripts/test-onboarding-flow.ts       # 첫 로그인 흐름
```

`SEED_TARGET=prod` 환경변수를 주면 `.env.production.local` 의 자격증명으로 프로덕션 Supabase에 대해 실행됩니다. 기본은 로컬(`.env.local`).

## 기술 스택

| 영역 | 기술 |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack 기본) |
| **Language** | TypeScript 5.x (strict) + React 19 |
| **DB / Auth** | Supabase (PostgreSQL + Auth + RLS, `@supabase/ssr` 쿠키 세션) |
| **UI** | shadcn/ui + Tailwind CSS 4 + Radix UI |
| **i18n** | next-intl — 5개 locale (id 기본, en, ko, ja, zh) |
| **결제** | Midtrans Snap (sandbox/production 명시 토글) |
| **이메일** | Resend |
| **AI / OCR** | Anthropic SDK + OpenAI (문서 OCR, 챗봇) |
| **PDF** | @react-pdf/renderer |
| **상태관리** | TanStack Query + Zustand |
| **폼·검증** | React Hook Form + Zod 4 |
| **로깅** | pino (JSON 구조화) |
| **모니터링** | Sentry (에러, Web Vitals, Circuit Breaker 이벤트) |
| **결제 회복력** | Circuit Breaker · Idempotency · Graceful Degrade |
| **테스트** | Vitest (단위) + Playwright (E2E) |

## 테스트 계정

전부 비밀번호 `TestPassword123!`

| 역할 | 이메일 | 시드 스크립트 |
|---|---|---|
| CUSTOMER (개인) | customer.test@example.com | seed-test-users |
| CUSTOMER (법인) | company.test@example.com | seed-test-users + seed-company-customer |
| CONSULTANT_JTC (JTC 내부) | consultant.test@jakartatax.co.id | seed-test-users |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | seed-test-users |
| CONSULTANT (외부 — PT Mitra Pajak Sentosa) | external.consultant@mitrapajak.com | seed-master-and-external |
| TAX_OPERATOR | operator.test@aipajak.com | seed-master-and-external |
| TAX_OPERATOR_SUPERVISOR | supervisor.test@aipajak.com | seed-master-and-external |
| TAX_OPERATOR_MASTER | master.test@aipajak.com | seed-master-and-external |
| PLATFORM_ADMIN | admin.test@aipajak.com | seed-test-users |

## 환경 변수

`.env.example`을 `.env.local` 로 복사한 뒤 값 채우기. 핵심 키:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payment Gateway (Midtrans). 비워두면 graceful degrade — 결제 트랜잭션 행은
# PENDING으로 보존되고 사용자가 나중에 재시도 가능
MIDTRANS_SERVER_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_MERCHANT_ID=
# 'true'일 때만 실 Midtrans 엔드포인트 사용. 기본 sandbox.
# Vercel NODE_ENV=production 만으로 실금액 결제가 트리거되는 사고 방지.
MIDTRANS_IS_PRODUCTION=false

# Email
RESEND_API_KEY=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=

# DJP (인도네시아 세무청)
DJP_API_URL=
DJP_API_KEY=
```

전체 목록은 `.env.example` 참고.

## 아키텍처

```
                         Vercel (Next.js 16 + Turbopack)
                         ─────────────────────────────────
        ┌────────────┐   ┌────────────┐   ┌─────────────────┐
        │ App Router │   │ API Routes │   │ Vercel Cron Jobs│
        │  (RSC)     │   │ + Middleware│   │                 │
        └─────┬──────┘   └──────┬─────┘   └────────┬────────┘
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
        ┌─────────────────── Resilience Layer ─────────────────┐
        │  Circuit Breaker │ Idempotency │ Graceful Degrade   │
        │  Structured Logging (pino) │ Sentry Capture          │
        └────────────────────────┬─────────────────────────────┘
                                 │
        ┌────────────┬───────────┼────────────┬──────────────┐
        ▼            ▼           ▼            ▼              ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐
   │Supabase │ │ Midtrans │ │ Resend  │ │Anthropic │ │ DJP/Coretax│
   │PG + RLS │ │ Payment  │ │ Email   │ │+ OpenAI  │ │ Tax API    │
   │+ Auth   │ │ Gateway  │ │         │ │ (OCR/AI) │ │            │
   └─────────┘ └──────────┘ └─────────┘ └──────────┘ └────────────┘
```

**Multi-tenant 모델**: 한 `tax_partner` 는 `JTC` 또는 `EXTERNAL`. consultant는 정확히 하나의 partner에 귀속되며, 그 partner의 customer만 RLS로 노출됨. 신고·문서·결제 데이터 모두 같은 격리 원칙 적용.

## 프로젝트 구조

```
ai-pajak/
├── src/
│   ├── app/[locale]/                    # 다국어 라우팅
│   │   ├── (auth)/                      # login/register/forgot-password
│   │   ├── (dashboard)/                 # 인증 후 메인 라우트
│   │   │   ├── admin/master/            # Master 대시보드 + 맞춤 가격
│   │   │   ├── billing/                 # 결제·구독
│   │   │   ├── customers/               # CRM
│   │   │   ├── documents/               # 문서·OCR
│   │   │   ├── filings/                 # 신고 이력
│   │   │   ├── help/manuals/            # 앱 내 매뉴얼 렌더링
│   │   │   ├── operator/                # 운영팀 큐·승인·통계
│   │   │   ├── settings/                # 설정·2FA·통합
│   │   │   └── tax/                     # 세금 계산·신고 wizard
│   │   ├── (public)/pricing/            # 요금제 페이지
│   │   └── api/                         # API Routes
│   │       ├── admin/master/            # Master 전용 (custom-pricing 등)
│   │       ├── auth/                    # 가입·로그인·MFA
│   │       ├── billing/                 # 3개 결제 surface + custom-pricing
│   │       ├── operator/                # 운영팀 큐 액션
│   │       ├── tax/                     # 세금 계산·신고 API
│   │       └── webhooks/                # Midtrans, DJP
│   ├── components/
│   │   ├── dashboard/                   # 위젯 (CurrentPlan, ConsultantTier, CustomPricing 등)
│   │   ├── layout/                      # Sidebar (역할+customerType 필터)
│   │   ├── tax-filing/                  # SPT 작성 wizard
│   │   └── ui/                          # shadcn/ui
│   ├── config/                          # 정적 설정
│   │   ├── corporate-pricing.ts         # UMKM/Basic/Pro
│   │   ├── consultant-pricing.ts        # Starter/Growth/Enterprise
│   │   └── individual-pricing.ts        # 1770SS/1770S/1770
│   ├── lib/
│   │   ├── auth/                        # 권한 해석
│   │   ├── billing/                     # 플랜 추천 엔진, 사용량 집계
│   │   ├── payment/midtrans.ts          # Midtrans SDK 래퍼
│   │   ├── resilience/                  # Circuit breaker · idempotency
│   │   ├── supabase/                    # client / server / admin (3-tier)
│   │   └── tax/                         # SPT 양식별 계산 모듈
│   ├── middleware/                      # composeMiddleware + 가드들
│   ├── i18n/messages/                   # ko/en/id/ja/zh
│   └── tests/e2e/                       # Playwright
├── docs/
│   ├── manuals/                         # 역할별 사용자 매뉴얼
│   ├── API/                             # API 명세
│   ├── ERD/                             # DB 설계
│   └── PRD/                             # 요구사항
├── scripts/                             # 시드·검증 스크립트
└── supabase/migrations/                 # 순차 SQL 마이그레이션
```

## 문서

- [CLAUDE.md](CLAUDE.md) — 아키텍처 / 보안 규칙 / 코드 컨벤션 (Claude Code 작업 지침)
- [docs/manuals/](docs/manuals/) — 역할별 사용자 매뉴얼
- [docs/manuals/screenshots-checklist.md](docs/manuals/screenshots-checklist.md) — 매뉴얼 스크린샷 수집 가이드
- [docs/API/](docs/API/) — API 명세
- [docs/ERD/](docs/ERD/) — 데이터베이스 설계
- [Resilience 패턴](docs/guides/resilience-patterns.md)
- [Supabase 가이드](supabase/README.md)

## 라이선스

Proprietary — All rights reserved
