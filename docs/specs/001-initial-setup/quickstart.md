# Quickstart Guide: AI Pajak MVP

**Branch**: `001-initial-setup` | **Date**: 2025-12-28

이 가이드는 AI Pajak MVP 개발 환경을 빠르게 설정하는 방법을 설명합니다.

---

## Prerequisites

### Required

- **Node.js**: 20.x LTS
- **pnpm**: 9.x (recommended) or npm 10.x
- **Git**: 2.40+
- **Supabase CLI**: 1.x

### Optional

- **Docker**: 24.x (로컬 Supabase 실행용)
- **VS Code** + Extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Supabase

---

## 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/your-org/ai-pajak.git
cd ai-pajak

# Checkout branch
git checkout 001-initial-setup

# Install dependencies
pnpm install
# or
npm install
```

---

## 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local
```

### .env.local 설정

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# OpenAI (OCR)
OPENAI_API_KEY=sk-...

# Midtrans (Payment)
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase 프로젝트 생성

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. "New Project" 클릭
3. 프로젝트 이름: `ai-pajak-dev`
4. Database Password 설정 (안전하게 보관)
5. Region: `Southeast Asia (Singapore)`
6. 생성 완료 후 API Keys 복사

---

## 3. Database Setup

### Option A: Supabase Cloud

```bash
# Supabase CLI 로그인
npx supabase login

# 프로젝트 연결
npx supabase link --project-ref your-project-ref

# 마이그레이션 실행
npx supabase db push
```

### Option B: Local Supabase (Docker 필요)

```bash
# 로컬 Supabase 시작
npx supabase start

# 마이그레이션 실행
npx supabase db reset
```

### Seed Data (선택사항)

```bash
# TER 세율, KBLI 코드, 조세조약 데이터 삽입
npx supabase db seed
```

---

## 4. Run Development Server

```bash
# 개발 서버 시작
pnpm dev
# or
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 5. Project Structure

```
ai-pajak/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── [locale]/        # i18n routes
│   │   │   ├── (auth)/      # 인증 페이지
│   │   │   └── (dashboard)/ # 대시보드 페이지
│   │   └── api/             # API Routes
│   ├── components/          # React 컴포넌트
│   │   ├── ui/              # shadcn/ui
│   │   └── ...
│   ├── lib/                 # 유틸리티 & 서비스
│   │   ├── supabase/        # Supabase 클라이언트
│   │   └── ...
│   ├── hooks/               # Custom hooks
│   ├── stores/              # Zustand stores
│   └── types/               # TypeScript types
├── supabase/
│   ├── migrations/          # DB 마이그레이션
│   └── config.toml          # Supabase 설정
├── specs/                   # Feature specs
│   └── 001-initial-setup/   # 현재 feature
└── docs/                    # 프로젝트 문서
```

---

## 6. Development Workflow

### 코드 스타일

```bash
# Lint 검사
pnpm lint

# Lint 자동 수정
pnpm lint:fix

# Format
pnpm format
```

### 타입 검사

```bash
pnpm typecheck
```

### 테스트

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:coverage
```

### 빌드

```bash
pnpm build
```

---

## 7. Key Files

### 인증 미들웨어

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Auth 체크
  // Role 체크
  // PLATFORM_ADMIN 세무 데이터 차단
}
```

### Supabase 클라이언트

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### API Route 예시

```typescript
// src/app/api/customers/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // RLS가 자동으로 권한 체크
  const { data, error } = await supabase
    .from('customers')
    .select('*')

  return NextResponse.json({ success: true, data })
}
```

---

## 8. Common Tasks

### 새 컴포넌트 추가 (shadcn/ui)

```bash
npx shadcn@latest add button
npx shadcn@latest add form
npx shadcn@latest add table
```

### 새 마이그레이션 생성

```bash
npx supabase migration new add_new_table
```

### 타입 생성 (Supabase)

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

---

## 9. Troubleshooting

### Supabase 연결 오류

```bash
# 로컬 Supabase 상태 확인
npx supabase status

# 재시작
npx supabase stop
npx supabase start
```

### 타입 오류

```bash
# node_modules 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install

# TypeScript 캐시 클리어
rm -rf .next
pnpm dev
```

### 포트 충돌

```bash
# 3000 포트 사용 중인 프로세스 확인
lsof -i :3000

# 다른 포트로 실행
PORT=3001 pnpm dev
```

---

## 10. Resources

### Documentation

- [spec.md](./spec.md) - 기능 명세
- [plan.md](./plan.md) - 구현 계획
- [data-model.md](./data-model.md) - 데이터 모델
- [contracts/](./contracts/) - OpenAPI 스펙

### External

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

## 11. Next Steps

1. `/speckit.tasks` 실행하여 상세 작업 목록 생성
2. 인증 플로우 구현 시작
3. 대시보드 레이아웃 구현
4. API 엔드포인트 구현

---

**Questions?** 프로젝트 문서(`docs/`)를 참조하거나 팀 Slack 채널에 문의하세요.
