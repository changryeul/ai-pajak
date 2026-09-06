# DEPLOYMENT — 프로덕션 배포 핸드오프 (AWS Singapore)

AI Pajak를 **AWS(싱가폴)** 프로덕션으로 배포·운영하기 위한 인수인계 문서입니다.
운영 담당자(AWS 서버 운영)가 이 문서만 보고 배포·운영할 수 있도록 작성했습니다.

- 개발 온보딩: [`ONBOARDING.md`](./ONBOARDING.md)
- 아키텍처 상세: [`CLAUDE.md`](./CLAUDE.md)
- 문서: 한국어 / 코드·설정: 영어

---

## 0. 아키텍처 한눈에

```
[사용자] ──HTTPS──▶ [Next.js 16 웹앱 (AWS)] ──▶ [Supabase Cloud (PG+Auth+RLS)]
                          │                         (DB는 AWS 자체호스팅 아님. 매니지드 유지)
                          ├──▶ Anthropic / OpenAI (AI·OCR)
                          ├──▶ Midtrans (결제)
                          ├──▶ Resend (이메일) · Upstash (rate limit) · Sentry (에러)
                          └──▶ DJP/Coretax (세무당국, 선택)
```

- **웹 티어만 AWS에서 실행**하고, **DB는 Supabase Cloud를 그대로 사용**합니다 (Supabase 자체호스팅 불필요).
- Next.js는 **SSR 서버앱**입니다 (정적 사이트 아님). Node 20 런타임에서 `next build` → `next start`.

---

## 1. 배포 방식 — 권장: AWS Amplify Hosting

Vercel과 가장 유사해 이전 부담이 가장 적습니다. (컨테이너/EC2 대안은 §6)

### 1-1. Amplify 앱 생성
1. AWS Console → **Amplify** → **Host web app** → GitHub 연결 → `changryeul/ai-pajak` · 브랜치 `main`
2. 리전: **ap-southeast-1 (Singapore)**
3. 빌드 설정: 저장소 루트의 [`amplify.yml`](./amplify.yml) 자동 인식 (Next.js SSR 자동 감지)
4. **환경변수**(§3)를 Amplify → App settings → Environment variables 에 등록
5. 서비스 역할(IAM)은 Amplify 기본 SSR 역할 사용

### 1-2. 빌드 사양
- Node **20** (Amplify build image에서 `nvm use 20` 또는 `amplify.yml`의 명시 버전)
- `npm ci && npm run build` / 산출물: `.next`
- `amplify.yml`에 포함됨

---

## 2. 프로덕션 Supabase (신규 프로젝트 권장)

현재 앱은 개발/스테이징 Supabase(`hqcjeenfhlaxwteqzzcf`)를 써 왔습니다.
**프로덕션은 깨끗한 새 프로젝트로 분리**하는 것을 권장합니다.

1. supabase.com → **New project** (조직/리전 **Singapore**, 강력한 DB 비밀번호)
2. 마이그레이션 전체 적용 — 두 방법 중 하나:
   - **CLI**: `supabase link --project-ref <PROD_REF>` → `supabase db push`
   - **Management API**(현재 방식): 각 `supabase/migrations/*.sql`을 순서대로
     `POST https://api.supabase.com/v1/projects/<PROD_REF>/database/query` (헤더 `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`)
     ※ 레이트리밋 있으니 요청 사이 지연 필요
3. 시드(운영 계정/기준데이터) — 필요한 것만. 테스트 계정은 프로덕션에 넣지 말 것.
4. **Auth 설정** (Supabase 대시보드 → Authentication → URL Configuration):
   - **Site URL** = 새 프로덕션 도메인 (§5)
   - **Redirect URLs** 허용목록에 새 도메인 추가
5. 새 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL` / `anon` / `service_role` 를 §3 환경변수에 반영

> ⚠️ 마이그레이션 파일과 실제 prod 스키마가 어긋나지 않게 유지. 배포 후 `npm run test:smoke:prod`(대상 env를 prod로)로 drift 확인.

---

## 3. 환경변수 (프로덕션)

`.env.example` 이 전체 키의 소스입니다. 프로덕션에서 채워야 할 핵심:

**필수 (앱 구동)**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — 신규 prod Supabase
- `NEXT_PUBLIC_APP_URL` — **새 프로덕션 도메인** (예: `https://app.example.com`) — 이메일/알림/콜백 링크의 기준
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — AI·OCR
- `TWO_FACTOR_ENCRYPTION_KEY`(`openssl rand -base64 32`), `SESSION_SECRET`, `CRON_SECRET`(`openssl rand -hex 32`)

**결제 (실서비스 전환 시 필수)**
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_MERCHANT_ID`
- `MIDTRANS_IS_PRODUCTION=true` ← **실결제 켜는 스위치. 이 값이 'true'일 때만 실제 과금.**

**부가 (없어도 graceful-degrade)**
- `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_SUPPORT` — 이메일
- `UPSTASH_REDIS_REST_URL` / `_TOKEN` — rate limit (없으면 인메모리 폴백)
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_*` — 에러 추적
- `DJP_API_*`, `ACCURATE_*` / `JURNAL_*` (회계연동, redirect URI는 §5), `SUPABASE_ACCESS_TOKEN`(마이그레이션용, 안전 보관)

> 시크릿 전달은 **평문 금지**. 1Password/Doppler/AWS Secrets Manager 등으로. Amplify는 env를 자체 암호화 저장.

---

## 4. 배포 파이프라인 / 마이그레이션 규칙

- **코드 배포**: `main` 머지 → Amplify 자동 빌드/배포. (GitHub 브랜치 보호로 PR+CI 통과 필요 — 이미 설정됨)
- **DB 마이그레이션은 배포로 자동 적용되지 않음** — 스키마 변경 시 사람이 prod Supabase에 §2-2 방법으로 적용. "누가 언제 적용했는지" 팀 공유.
- **CI**: `.github/workflows/ci.yml`(tsc·eslint·vitest·build) — Amplify로 옮기면 CI의 Vercel 배포 스텝은 제거/무시.
- **회귀 검증**: `npm run test:smoke:prod` (대상 env를 새 prod로) — ~65 스텝.

---

## 5. 도메인/URL 변경 (AWS 이전과 함께 처리 권장)

새 도메인은 **AWS(Amplify) 배포에 연결**합니다 (기존 Vercel에 붙였다 다시 옮기면 이중 작업).

1. Amplify → Domain management → 커스텀 도메인 추가 (ACM 인증서 자동 발급) 또는 Route53 연결
2. `NEXT_PUBLIC_APP_URL` = 새 도메인 으로 설정 → 이메일/알림/콜백 링크 대부분 자동 반영
3. **Supabase Auth**: Site URL + Redirect URLs 허용목록에 새 도메인 (§2-4)
4. **결제/연동 콜백** 재등록:
   - Midtrans 대시보드 finish/callback URL
   - 회계연동(Accurate/Mekari/Jurnal) redirect URI — 제공사 콘솔에 새 도메인으로 등록
5. **코드 내 하드코딩 잔재** (env 미설정 시 폴백 값) — 새 도메인으로 정리 권장:
   - `src/app/api/notifications/deadline-reminder/route.ts` — 하드코딩 URL(폴백 아님) 있음
   - `src/app/[locale]/(dashboard)/settings/accurate/page.tsx` — 안내 문구의 redirect URI 표기
   - 그 외 다수 파일이 `process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'` 패턴 → env만 세팅하면 동작하나, 폴백 문자열도 정리하면 깔끔

> **URL 변경은 AWS 이전과 논리적으로 분리 가능하지만, 함께 처리하는 게 맞습니다.** Supabase Auth 리다이렉트·결제/연동 콜백·`NEXT_PUBLIC_APP_URL`이 한꺼번에 새 도메인으로 맞춰져야 로그인·결제·이메일이 정상 동작하기 때문입니다.

---

## 6. 대안 배포 방식 (Amplify 대신)

컨테이너를 선호하면 (ECS/Fargate·App Runner):
- `next.config.ts` 에 `output: 'standalone'` 추가 → 경량 이미지
- `Dockerfile`(멀티스테이지: deps → build → runner, `node:20-alpine`, `next start`) 필요
- ECR 푸시 → ECS/Fargate 또는 App Runner. ALB + ACM(SSL) + Route53.
- 환경변수는 Task Definition/Secrets Manager로 주입.

> 이 방식으로 갈 경우 Dockerfile·standalone 설정을 추가해 드릴 수 있습니다(현재는 Amplify 기준이라 미포함).

EC2 직접 운영: `npm ci && npm run build` → `pm2 start "npm start"` → nginx 리버스 프록시 + certbot. 가장 수동적.

---

## 7. Go-Live 체크리스트

- [ ] 새 prod Supabase 생성 + 마이그레이션 전체 적용 + drift 0 확인
- [ ] Amplify 앱 생성 + GitHub 연결 + `amplify.yml` 빌드 성공
- [ ] 환경변수 전부 등록 (특히 `NEXT_PUBLIC_APP_URL` = 새 도메인)
- [ ] 커스텀 도메인 연결 + SSL(ACM) 발급
- [ ] Supabase Auth Site URL/Redirect URLs = 새 도메인
- [ ] **`MIDTRANS_IS_PRODUCTION=true`** + Midtrans 실키 + 콜백 URL (실결제 시)
- [ ] 회계연동 redirect URI 재등록 (사용 시)
- [ ] 운영팀 2FA 정책(`system_setting.security.operator_mfa_required`) 확인
- [ ] `npm run test:smoke:prod`(새 prod 대상) 통과
- [ ] 로그인 → 개인/법인/운영팀 각 1건 스모크 (브라우저)
- [ ] Sentry 에러 수집 확인

---

## 8. 운영 담당자에게 넘길 접근권한

- [ ] GitHub `changryeul/ai-pajak` collaborator (또는 소유권 이전)
- [ ] 새 prod Supabase 프로젝트 소유권/멤버
- [ ] AWS 계정 내 Amplify/Route53/ACM 권한 (담당자 계정)
- [ ] 프로덕션 시크릿 (안전 채널)
- [ ] 외부 서비스 콘솔 (Midtrans/Resend/Sentry/Anthropic/OpenAI) 접근 또는 키
