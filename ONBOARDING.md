# ONBOARDING — AI Pajak 개발자 온보딩

AI Pajak(인도네시아 세무 신고 SaaS)에 새로 합류한 개발자를 위한 시작 가이드입니다.
아키텍처 상세는 [`CLAUDE.md`](./CLAUDE.md)에, 기능 개요는 [`README.md`](./README.md)에 있습니다.
이 문서는 **셋업 → 안전 규칙 → 워크플로우** 순서로, "오늘 바로 개발을 시작하는 법"에 집중합니다.

> 문서는 한국어, 코드·커밋 메시지·변수명은 영어를 유지합니다.

---

## ⚠️ 가장 먼저 읽을 것 — 프로덕션 사고 방지

이 프로젝트는 **별도 staging 환경이 없고, 지금까지 프로덕션을 테스트 환경처럼 써 왔습니다.**
협업을 시작하면 아래 3가지는 반드시 지켜주세요.

1. **`.env.local`이 프로덕션 DB를 가리킬 수 있습니다.**
   과거 `.env.local`과 `.env.production.local`이 **같은 Supabase(prod)** 를 가리켰습니다.
   → 로컬 개발 전, `.env.local`이 **개발용 DB**(로컬 Supabase 또는 별도 dev 프로젝트)를 향하는지
   **반드시 확인**하세요. 확인 없이 `npm run dev`, seed, `supabase db reset`을 돌리면 **실서비스 데이터가 바뀝니다.**

2. **`main`에 push하면 자동으로 프로덕션에 배포됩니다** (`.github/workflows/ci.yml`).
   → `main`에 직접 push 금지. **feature 브랜치 → PR → 리뷰 → 머지**로만 작업하세요.

3. **DB 마이그레이션은 자동 적용되지 않습니다.**
   배포는 코드만 반영하고, `supabase/migrations/*.sql`은 **사람이 수동으로 prod에 적용**합니다(아래 [마이그레이션](#마이그레이션-db-스키마-변경) 참고).
   → 스키마 변경 시 "누가 언제 prod에 적용했는지" 팀에 공유하세요.

---

## 1. 사전 준비 — 접근 권한 받기

대표(레포 소유자)에게 아래 접근을 요청하세요. 없으면 개발/배포가 막힙니다.

- [ ] **GitHub** — `changryeul/ai-pajak` 저장소 collaborator
- [ ] **Supabase** — 프로젝트 멤버 (개발용 DB 권한; prod는 필요 시 제한적으로)
- [ ] **Vercel** — 팀/프로젝트 멤버 (Preview 배포 확인용)
- [ ] **API 키 묶음** — `.env.example`의 키들. 시크릿 매니저(1Password/Doppler 등)나 안전한 채널로 전달받기
  - 필수(개발): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
  - 결제(sandbox): `MIDTRANS_*` (`MIDTRANS_IS_PRODUCTION`은 반드시 미설정/false)
  - 부가: `RESEND_API_KEY`, `UPSTASH_REDIS_REST_*`, `NEXT_PUBLIC_SENTRY_DSN`
  - 연동(선택): DJP/Coretax, ACCURATE/JURNAL 등 — 해당 기능 작업 시에만

---

## 2. 로컬 셋업

### 요구 사항
- **Node.js 20.x** (CI 기준). 로컬도 20으로 맞추길 권장 — `nvm use 20`
- **npm** (레포는 npm lockfile 사용)
- **Supabase CLI** (로컬 DB로 개발할 경우) — https://supabase.com/docs/guides/cli

### 순서
```bash
git clone https://github.com/changryeul/ai-pajak.git
cd ai-pajak
npm install

# 환경변수 준비 — 예시를 복사해 값 채우기
cp .env.example .env.local
#   ↑ .env.local 의 SUPABASE_URL 을 반드시 '개발용' DB 로 설정할 것 (prod 금지)
```

### DB 선택 (둘 중 하나)
- **A. 로컬 Supabase (권장, 완전 격리)**
  ```bash
  supabase start          # 로컬 Postgres + Auth 기동 (출력된 URL/anon key 를 .env.local 에)
  supabase migration up    # supabase/migrations 전체 적용
  supabase db reset        # 초기화 + seed
  npm run db:seed-test-users
  ```
- **B. 별도 dev Supabase 프로젝트** — 대표가 만든 dev 프로젝트 자격증명을 `.env.local`에.
  마이그레이션은 [아래 방법](#마이그레이션-db-스키마-변경)으로 적용.

### 실행
```bash
npm run dev              # 개발 서버 (http://localhost:3000, Turbopack)
```

---

## 3. 자주 쓰는 명령

```bash
# 개발/빌드
npm run dev                 # 개발 서버
npm run build               # 프로덕션 빌드 (push 전 통과 확인 권장)
npm run lint                # ESLint

# 품질 게이트 (push 전 필수 — CI 와 동일)
npx tsc --noEmit                     # 타입 0에러
npx eslint . --max-warnings 34       # 경고 34개 이하 (CI 게이트)

# 테스트
npm test                    # Vitest 유닛
npx vitest run <path>       # 단일 파일
npm run test:e2e            # Playwright (dev 서버 + Supabase 필요)

# 회귀 스모크 (~65 스텝, 단일 PASS/FAIL)
npm run test:smoke          # 로컬 Supabase 대상
npm run test:smoke:prod     # .env.production.local 대상 (prod 검증)

# DB
supabase migration up       # 마이그레이션 적용 (로컬)
supabase db reset           # 초기화 + 재seed (로컬)
npm run db:seed-test-users  # 테스트 계정 seed
```

---

## 4. 개발 워크플로우

```
feature 브랜치 생성  →  작업  →  tsc/lint/build 통과  →  push  →  PR 생성
   →  CI(tsc·eslint·vitest·build) 통과 + 리뷰  →  main 머지  →  자동 prod 배포(~3분)
```

- **브랜치**: `main`에 직접 push 금지. `feat/…`, `fix/…` 브랜치에서 작업 후 PR.
- **커밋 전 로컬 검증**: `npx tsc --noEmit`는 **반드시** 0에러.
  (주의: `npm run build`는 `scripts/`를 타입체크에서 건너뛰므로, `tsc --noEmit`가 더 엄격합니다. Vercel 빌드는 `scripts/`까지 검사합니다.)
- **커밋 메시지**: 영어, Conventional Commits 스타일 (`feat(scope): …`, `fix(scope): …`).
- **PR 머지 후**: CI가 Vercel로 자동 배포. 배포 확인은 https://ai-pajak.vercel.app 및 `/api/health`.

### CI 파이프라인 (`.github/workflows/`)
- `ci.yml` — 모든 push/PR: **tsc → eslint(≤34 warn) → vitest → build**, main 머지 시 **prod 배포**
- `smoke.yml` — 매일 + 수동: `test:smoke:prod` (회귀 그물)
- `drift-after-deploy.yml` — push 후 prod 스키마 drift 감지 (마이그레이션 누락 조기 경보)
- `golden-path.yml` — 핵심 사용자 흐름 검증

---

## 5. 마이그레이션 (DB 스키마 변경)

마이그레이션 파일은 `supabase/migrations/`에 순번 SQL로 추가합니다
(예: `20260830000004_payslip_hr_fields.sql`).

- **로컬**: `supabase migration up`
- **프로덕션**: 배포로 자동 적용되지 **않습니다**. Supabase Management API로 수동 적용합니다.
  ```
  POST https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query
  Header: Authorization: Bearer $SUPABASE_ACCESS_TOKEN
  Body:   { "query": "<SQL 내용>" }
  ```
  - `PROJECT_REF`는 Supabase 대시보드 URL에서 확인
  - `SUPABASE_ACCESS_TOKEN`은 Supabase 계정 토큰 (개인 발급, 만료 시 갱신)
  - 적용 후 `drift-after-deploy` / `test:smoke:prod`로 반영 확인
- ⚠️ **규칙**: prod DDL 적용은 팀에 공유하고, 마이그레이션 파일과 실제 prod 상태가 어긋나지 않도록 유지하세요.

---

## 6. 아키텍처 빠른 지도

전체는 [`CLAUDE.md`](./CLAUDE.md)에 있습니다(정독 권장). 핵심만:

- **스택**: Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase(PG+Auth+RLS) · Tailwind/shadcn · next-intl(id/en/ko)
- **두 제품, 한 플랫폼**: ① Assisted DIY(납세자 + JTC 운영팀 검토) ② 세무법인 ERP(EXTERNAL 테넌트, 운영팀 미개입). 상세: `docs/guides/product-identity.md`
- **RBAC**: `src/types/auth.ts`의 role. API는 `composeMiddleware()`로 인증/RBAC/감사 체이닝 (`src/middleware/compose.ts`)
- **2단계 보안**: API 미들웨어(1차) + Supabase RLS(최종). 테넌트 격리는 `get_consultant_tax_partner_id()`
- **세무 계산**: `src/lib/tax/` (PPh21/23/26/Final/PPN, 결산 등). PPh21 요율은 `rate-provider.ts`로 DB override 가능
- **경로 별칭**: `@/*` → `src/*`
- **라우팅**: `src/app/[locale]/(auth|dashboard|public|fullscreen)/`, API는 `src/app/api/`

### 5대 보안 하드룰 (절대 위반 금지)
1. `PLATFORM_ADMIN`은 고객 세무데이터 접근 불가 (`blockPlatformAdmin`)
2. Consultant는 등록된 `tax_partner`에 소속 (RLS, 테넌트 격리)
3. 신고 제출 주체 ≠ 플랫폼
4. 청구 주체(`SYSTEM`) ≠ 서비스 제공자
5. 모든 write에 감사(`withAudit`)

---

## 7. 테스트 계정

`npm run db:seed-test-users` + `scripts/seed-*` 로 생성. 상세 표는 [`CLAUDE.md`](./CLAUDE.md#test-accounts).
공통 비밀번호: `TestPassword123!`

| 역할 | 이메일 |
|---|---|
| 개인 고객 | customer.test@example.com |
| 법인 고객 | company.test@example.com |
| 운영팀 상담원 | operator.test@aipajak.com |
| 운영팀 Supervisor | supervisor.test@aipajak.com |
| 운영팀/사업 Master | master.test@aipajak.com |
| EXTERNAL 컨설턴트 | external.consultant@mitrapajak.com |
| FIRM_ADMIN | firmadmin.test@mitrapajak.com |
| PLATFORM_ADMIN | admin.test@aipajak.com |

---

## 8. 자주 밟는 함정 (미리 알아두면 시간 절약)

- **`.env.local` = prod 함정** — 위 경고 참고. 개발 시작 전 DB 대상 재확인.
- **`tsc --noEmit`이 `npm run build`보다 엄격** — `scripts/` 타입에러는 로컬 build에서 안 잡히고 Vercel에서 터짐. push 전 `tsc --noEmit` 필수.
- **라우트 이동/삭제 후 `.next/types` 스테일** — 타입 꼬이면 `rm -rf .next` 후 재빌드.
- **ESLint 게이트 34** — 미사용 import/변수 정리 습관. 넘으면 CI 실패.
- **`useSearchParams` 사용 시 `<Suspense>` 래핑 필수** (Next.js).
- **운영팀 2FA 토글이 ON이면 브라우저 e2e가 로그인에서 튕김** — e2e 전 확인.
- **워크플로우(`.github/workflows/*`) 파일 push 시** `gh auth refresh -s workflow` 필요할 수 있음.

---

## 9. 협업을 위해 아직 정리하면 좋은 것 (대표 확인 필요)

- [ ] 개발용 DB 완전 분리 + `.env.local` 표준화 (최우선)
- [ ] GitHub `main` 브랜치 보호 (PR 필수 + CI 통과 + 리뷰 1인)
- [ ] Vercel Preview 배포 활성화 (PR별 URL)
- [x] ~~Node 버전 고정~~ — `package.json engines.node: ">=20"` + `.nvmrc`(20) 완료
- [x] ~~README 중복~~ — 실제로는 단일 파일(대소문자 무시 FS 착시), 정리 불필요

---

## 10. 막히면

- 아키텍처/규칙: [`CLAUDE.md`](./CLAUDE.md)
- 기능 개요: [`README.md`](./README.md)
- 도메인/역할: `docs/guides/` (product-identity, roles, domain-model-corrections)
- 회귀 검증: `npm run test:smoke:prod` (개별 스크립트는 CLAUDE.md 하단 목록)
