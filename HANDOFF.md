# HANDOFF — AI Pajak 운영 인수인계 (프로덕션 이관)

AI Pajak를 **AWS(싱가폴) 프로덕션으로 이관·운영**할 담당자를 위한 최상위 인수인계 문서입니다.
이 문서 하나로 큰 그림·순서·책임을 파악하고, 세부는 아래 문서로 연결됩니다.

| 문서 | 용도 |
|---|---|
| **HANDOFF.md** (이 문서) | 인수인계 큰 그림 · 순서 · 접근권한 · 운영 책임 |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | AWS 배포 상세 절차 · 환경변수 · go-live |
| [`ONBOARDING.md`](./ONBOARDING.md) | 개발자 로컬 셋업 · 개발 워크플로우 |
| [`CLAUDE.md`](./CLAUDE.md) | 아키텍처 · 도메인 모델 상세 |

> 문서=한국어 / 코드·커밋·변수명=영어. 기준 커밋: 태그 **`v1.0.0`** (프로덕션 baseline).

---

## 1. 제품 개요

**AI Pajak** — 인도네시아 세무 신고 자동화 SaaS. 두 제품이 하나의 공통 플랫폼(로그인·AI·결제·OCR·세무 계산 엔진) 위에 올라간 구조:
- **Assisted DIY** — 개인/법인 납세자가 자료를 올리면 **JTC 운영팀**이 검토·승인·발행
- **세무법인 ERP** — 외부 세무법인(EXTERNAL tenant)이 자기 고객을 처리 (운영팀 미개입, RLS 격리)

세목: 개인소득세(PPh21)·원천세(PPh23)·부가세(PPN)·PPh4(2)·월 선납법인세(UMKM/PPh25)·연 신고(SPT Tahunan). 4개 주요 세목은 **최종 제출 + 필수항목 팝업 + 엑셀 다운로드** UX 통일 완료.

**언어 정책**: 개인/법인 고객 = 5개(ko/en/id/zh/ja), 상담사·어드바이저·마스터·운영팀 = 3개(ko/en/id).

---

## 2. 기술 스택 / 아키텍처

```
[사용자] ─HTTPS─▶ [Next.js 16 웹앱 (AWS Amplify)] ─▶ [Supabase Cloud (PG+Auth+RLS)]
                        │                              (DB는 AWS 자체호스팅 아님. 매니지드)
                        ├─▶ Anthropic / OpenAI  (AI·OCR)
                        ├─▶ Midtrans           (결제)
                        ├─▶ Resend             (이메일)
                        ├─▶ Upstash Redis      (rate limit)
                        ├─▶ Sentry             (에러 추적)
                        └─▶ DJP / Coretax      (세무당국, 선택)
```

- **Next.js 16** (App Router) + TypeScript strict + React 19 · **Node 20**
- **Supabase** (PostgreSQL + Auth + RLS) — 웹만 AWS, **DB는 Supabase Cloud 유지** (자체호스팅 불필요)
- Tailwind 4 + shadcn/ui · next-intl(5로케일) · Midtrans · Resend · Anthropic/OpenAI · Sentry
- **SSR 서버앱** (정적 아님) — `next build` → `next start`

보안 5대 하드룰(절대 위반 금지)은 [`CLAUDE.md`](./CLAUDE.md) 참고 (PLATFORM_ADMIN은 세무데이터 접근 불가 / consultant는 tax_partner 소속 / 신고 주체≠플랫폼 / 청구≠서비스 / 모든 write 감사).

---

## 3. 현재 상태 (이관 시점)

- **저장소**: `github.com/changryeul/ai-pajak` (개인 계정, public) — **조직 이전 예정** (§4)
- **임시 운영**: Vercel `lcr123s-projects/ai-pajak` (`ai-pajak.vercel.app`) — **개발/스테이징 성격**. 실프로덕션은 AWS로 신규.
- **DB**:
  - `hqcjeenfhlaxwteqzzcf` — 지금까지 "prod/staging" 겸용 (⚠️ 실운영 DB로 재사용 대신 **신규 prod 권장**)
  - `cfjpbwnpmhpuihhqygzg` (**ai-pajak-dev**) — 개발/프리뷰용 (스키마=prod 동일, 테스트 계정 seed됨)
- **CI**: `.github/workflows/` — ci(tsc·eslint·vitest·build)·smoke·drift·golden-path
- **기준 태그**: `v1.0.0`

---

## 4. 저장소 이관 & 접근권한

### 4-1. GitHub 조직 이전 (권장)
실서비스는 개인 계정 의존을 피하고 **회사/운영자 조직**으로 옮깁니다.
1. **소유·결제 주체(운영자)가 조직 생성**: github.com → `+` → New organization (Free 가능)
2. 운영자가 조직에 **`changryeul` 초대** (이전하려면 멤버 필요)
3. **`changryeul`이 repo 이전**: repo → Settings → Danger Zone → Transfer → 조직명 입력
   - 이슈·PR·태그·히스토리 보존, 기존 URL 자동 리다이렉트, 브랜치 보호 유지
4. 조직에서 역할 부여 + **결제는 조직 Settings → Billing**
5. ⚠️ **`changryeul`도 조직 Owner로 유지** (최종 안전망)

### 4-2. 현재 collaborator (이전 후 조직 팀/멤버로 재정리)
- `chriskr7` (write) · `Tommylee66` (write) · `changryeul` (admin)
- "모든 것 관리"하려면 **Admin/Owner** 필요 (Write는 코드·PR·머지만; 설정·시크릿·초대 불가)

### 4-3. 넘겨야 할 접근 (GitHub 밖 — 별도)
- [ ] AWS 계정(Amplify/Route53/ACM)
- [ ] 프로덕션 Supabase 프로젝트 소유권
- [ ] 외부 서비스 콘솔/키: Midtrans · Resend · Sentry · Anthropic · OpenAI · Upstash · (DJP/Coretax)
- [ ] 프로덕션 시크릿 (안전 채널: 1Password/Doppler/AWS Secrets Manager, **평문 금지**)

---

## 5. 환경 3단계 (역할 분리)

| 환경 | 어디서 | DB | 담당 |
|---|---|---|---|
| **개발** | 개발자 노트북 `npm run dev` | 로컬 Supabase 또는 ai-pajak-dev | 개발자 |
| **미리보기(Preview)** | PR별 자동 URL (Amplify 브랜치 또는 Vercel) | ai-pajak-dev | 검토 |
| **프로덕션** | **AWS Amplify** | **신규 prod Supabase** | 운영자 |

- **개발환경을 AWS에 다시 만들 필요 없음.** AWS는 프로덕션 웹 호스팅 전용.
- 로컬 셋업은 [`ONBOARDING.md`](./ONBOARDING.md), 개발용 키 최소화는 [`.env.local.example`](./.env.local.example).

---

## 6. 프로덕션 배포 (AWS Amplify 권장)

상세: [`DEPLOYMENT.md`](./DEPLOYMENT.md). 요약:
1. Amplify → Host web app → GitHub(조직 repo) 연결 → 브랜치 `main`, 리전 **ap-southeast-1**
2. 빌드 스펙 [`amplify.yml`](./amplify.yml) 자동 인식 (Node 20, `npm ci && npm run build`)
3. 환경변수(§8) 전부 등록
4. 커스텀 도메인 + SSL(ACM)

대안: 컨테이너(ECS/Fargate·App Runner — Dockerfile+`output: standalone` 필요) / EC2(수동). 컨테이너 원하면 관리자에게 요청 시 Dockerfile 추가 제공.

---

## 7. 프로덕션 Supabase (신규 생성 권장)

1. supabase.com → New project (Singapore, 강력한 DB 비번)
2. 마이그레이션 전체 적용:
   - CLI: `supabase link --project-ref <REF>` → `supabase db push`, 또는
   - Management API: `supabase/migrations/*.sql` 순서대로 `POST /v1/projects/<REF>/database/query` (레이트리밋 → 요청 간 지연)
3. **Auth → URL Configuration**: Site URL + Redirect URLs = 새 도메인
4. 시드: 운영 기준데이터만. **테스트 계정은 프로덕션에 넣지 말 것.**
5. 배포 후 `npm run test:smoke:prod`(대상=신규 prod)로 **schema drift 0** 확인

> ⚠️ 마이그레이션은 배포로 자동 적용되지 않음 — 스키마 변경 시 사람이 수동 적용 + 팀 공유. (drift 감사가 CI에 있음)

---

## 8. 환경변수 (프로덕션)

전체 키: [`.env.example`](./.env.example). 핵심:

**필수**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (신규 prod)
- `NEXT_PUBLIC_APP_URL` = **새 프로덕션 도메인** (모든 링크의 기준 — §9)
- `ANTHROPIC_API_KEY` · `OPENAI_API_KEY`
- `TWO_FACTOR_ENCRYPTION_KEY`(`openssl rand -base64 32`) · `SESSION_SECRET` · `CRON_SECRET`(`openssl rand -hex 32`)

**결제 (실서비스 전환 시)**
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` · `MIDTRANS_SERVER_KEY` · `MIDTRANS_MERCHANT_ID`
- `MIDTRANS_IS_PRODUCTION=true` ← **실결제 스위치. 'true'일 때만 실제 과금.**

**부가 (없으면 graceful-degrade)**
- `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_SUPPORT` · `UPSTASH_REDIS_REST_URL`/`_TOKEN` · `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_*`
- `DJP_API_*` · `ACCURATE_*`/`JURNAL_*` (redirect URI는 §9) · `SUPABASE_ACCESS_TOKEN`(마이그레이션용)

---

## 9. 도메인 / URL 전환

앱 URL은 **`getAppUrl()`**(`src/lib/app-url.ts`) 단일 소스로 통일됨. **도메인 변경 = `NEXT_PUBLIC_APP_URL` 하나만 바꾸면 대부분 반영.**
함께 맞출 것:
1. `NEXT_PUBLIC_APP_URL` = 새 도메인 (각 환경)
2. **Supabase Auth** Site URL + Redirect 허용목록 (안 하면 로그인 깨짐)
3. **Midtrans 콜백** + **회계연동(Accurate/Mekari/Jurnal) redirect URI** 재등록
4. (선택) 폴백 상수 `DEFAULT_APP_URL` 한 줄 갱신
> `sitemap.ts`/`layout.tsx`의 `aipajak.com`은 SEO canonical(마케팅 도메인) — 앱 도메인과 다르면 별도 결정.

---

## 10. Go-Live 체크리스트

- [ ] 조직 이전 + 접근권한 인계 (§4)
- [ ] 신규 prod Supabase + 마이그레이션 + drift 0 + Auth URL
- [ ] Amplify 앱 + `amplify.yml` 빌드 성공 + 환경변수 전부
- [ ] 커스텀 도메인 + SSL + `NEXT_PUBLIC_APP_URL`
- [ ] Supabase Auth redirect = 새 도메인
- [ ] **`MIDTRANS_IS_PRODUCTION=true`** + 실키 + 콜백 (실결제 시)
- [ ] 회계연동 redirect URI 재등록 (사용 시)
- [ ] 운영팀 2FA 정책(`system_setting.security.operator_mfa_required`) 확인
- [ ] `npm run test:smoke:prod`(신규 prod) 통과
- [ ] 브라우저 스모크: 개인/법인/운영팀 각 1건
- [ ] Sentry 에러 수집 확인
- [ ] DNS 컷오버(→ Amplify) → 기존 Vercel 정리(또는 프리뷰 전용)

---

## 11. 개발 · 협업 워크플로우

- **로컬**: `nvm use`(Node 20) → `npm install` → `.env.local`(로컬/dev Supabase) → `npm run dev`
- **브랜치 보호**: `main` 직접 push 금지 → **feature 브랜치 → PR → 리뷰+CI 통과 → 머지 → 자동 배포**
- **커밋 전 필수**: `npx tsc --noEmit` 0에러 (Vercel/Amplify 빌드는 scripts/까지 타입체크) + `eslint --max-warnings 34`
- **회귀 검증**: `npm run test:smoke:prod` (~65 스텝) + 개별 스크립트(CLAUDE.md 하단)
- 상세: [`ONBOARDING.md`](./ONBOARDING.md)

---

## 12. 운영 시 알아둘 함정

- **마이그레이션 수동 적용** — 배포로 자동 안 됨. prod DDL은 Management API/CLI로 사람이 적용 + drift 감사 확인.
- **`MIDTRANS_IS_PRODUCTION`** — `NODE_ENV`가 아니라 이 값이 실결제 스위치. 기본 sandbox.
- **운영팀 2FA 토글** — ON이면 운영팀 브라우저 e2e/로그인 흐름 영향. 켜기 전 계정 enroll 확인.
- **`tsc --noEmit`가 `npm run build`보다 엄격** — scripts/ 타입에러는 로컬 build에서 안 잡히고 배포에서 터짐.
- **테스트 계정을 프로덕션에 seed 금지.**
- **prod=staging 관행 종료** — 지금까지 prod를 테스트로 썼으나, 실런칭 후엔 dev Supabase에서 개발/검증.

---

## 13. 테스트 계정 (dev/스테이징 전용, 공통 pw `TestPassword123!`)

개인 `customer.test@example.com` · 법인 `company.test@example.com` · 상담원 `operator.test@aipajak.com` · 수퍼바이저 `supervisor.test@aipajak.com` · 마스터 `master.test@aipajak.com` · EXTERNAL 컨설턴트 `external.consultant@mitrapajak.com` · FIRM_ADMIN `firmadmin.test@mitrapajak.com` · PLATFORM_ADMIN `admin.test@aipajak.com`

---

## 14. 즉시 할 다음 액션 (순서)

1. **조직 이전 + 접근권한** (§4) — 당신 + 운영자
2. **신규 prod Supabase** (§7)
3. **시크릿 준비** (§8)
4. **Amplify 앱 + env** (§6)
5. **도메인 + URL** (§9)
6. **Go-Live 검증** (§10) → **컷오버**

막히면 각 단계별로 지원 가능 (마이그레이션 적용, 도메인 확정 후 코드 URL 정리, 컨테이너 배포용 Dockerfile 등).

---

## 15. 거버넌스 — 역할과 책임 (R&R)

세 주체: **조직**(repo 소유·결제·거버넌스) · **운영자**(AWS 프로덕션 운영) · **개발자**(코드·제품).

### 책임 매트릭스 (● 주관 · ○ 지원/협의)

| 영역 | 조직 | 운영자 | 개발자 |
|---|:--:|:--:|:--:|
| repo 소유 · 멤버권한 · 결제 | ● | ○ | |
| 거버넌스 (삭제/이전, 보호정책) | ● | ○ | |
| 기능 개발 · 버그 · 코드품질 | | | ● |
| PR 생성 · 코드리뷰 | | ○ | ● |
| main 머지 승인 | | ● | ○ |
| AWS 인프라 (Amplify·DNS·SSL) | | ● | |
| 프로덕션 배포 · 컷오버 · 롤백 | | ● | ○ |
| 모니터링 · 장애대응 (Sentry) | | ● | ○ |
| 프로덕션 시크릿 관리 | ○ | ● | |
| dev 시크릿 (본인 발급 키) | | | ● |
| 마이그레이션 파일 작성 | | | ● |
| 마이그레이션 prod 적용 | | ● | ○ |
| 외부서비스 설정 (Midtrans 실키·콜백·Resend) | ○ | ● | ○ |
| dev/스테이징 Supabase | | ○ | ● |
| 제품 · 세무 도메인 결정 | ○ | | ● |
| 문서 · 릴리스 노트 | | ○ | ● |

### 주체별 요약
- **조직** = 소유 · 결제 · 최종 통제. "누가 무엇을 할 수 있나"를 정하는 주체 (권한·거버넌스, 실작업 아님).
- **운영자** = 프로덕션 그 자체. AWS · 도메인 · prod Supabase · 시크릿 · 배포 · 모니터링 · prod 마이그레이션 적용. main 머지 게이트 담당 가능.
- **개발자** = 코드 + 제품. 기능/수정/마이그레이션 파일 작성 → PR. 제품·세법 요구사항 반영. dev 환경 관리.

### 경계선 (헷갈리기 쉬운 3가지)
1. **마이그레이션** — 개발자가 SQL 파일 작성 → PR. **운영자가 prod에 적용**. (배포로 자동 적용 안 됨 → 한쪽이 "적용" 책임)
2. **시크릿** — 개발자는 dev 키만(본인 발급). prod 키는 운영자가 관리, 개발자는 몰라도 됨.
3. **배포 경계** — 개발자는 **main 머지까지**. 이후(빌드·prod 반영·컷오버·롤백·모니터링)는 **운영자**.

### 흐름
```
개발자: feature 브랜치 → PR (마이그레이션 포함 시 명시)
      → 리뷰 → 머지
운영자: Amplify 자동배포 확인 + (마이그레이션 있으면) prod DB 적용 + 모니터링
조직:   접근권한 · 결제 · 거버넌스 상시 관리
```

### 권한 매핑 (GitHub 기준)
- **조직 Owner**: 조직 대표 (안전망으로 복수 Owner 권장)
- **repo Admin**: 운영자 (설정·시크릿·머지 관리)
- **Write**: 개발자 (코드·PR·머지)

> 참고: 한 사람이 여러 역할을 겸할 수 있음 (예: 대표가 제품 결정 + 개발 겸직). 인력이 늘면 이 표의 행 단위로 분리하면 된다.
