# Tax Code Rule — Access Gate Narrowing (Track A)

- **Date**: 2026-05-27
- **PDF source**: 수퍼바이저 화면 메신저 포함 20260525, p.26-27 "Admin / Tax Engine"
- **Track**: A (of B/C/A/D sequence; B/C complete 2026-05-27)
- **Status**: Design approved, ready for implementation plan

## 1. Context

`/operator/settings` 는 `src/app/[locale]/(dashboard)/operator/layout.tsx` 의 root gate 에 의해 operator-tier 4 role (TAX_OPERATOR / LEAD / SUPERVISOR / MASTER) 모두 진입 가능. 그러나 PDF p.26-27 "Admin / Tax Engine" 의 governance scope 는 더 좁다 — Track B 가 편집을 MASTER 한정으로, Track C 가 audit timeline 을 oversight 자료로 추가했지만, 페이지 자체 진입 게이트는 그대로 4 role 이라 LEAD/OPERATOR 가 들어와도 손댈 게 없는 어색한 상태.

API GET endpoint 2개 (`tax-code-rule`, `tax-code-rule/audit-log`) 도 현재 PLATFORM_ADMIN 만 차단하고 모든 인증 role 에 read 허용 — UI 가 좁혀지면 비대칭. Track A 는 UI + API 양쪽을 같은 범위로 정렬한다.

## 2. Decisions (confirmed in brainstorming)

| # | 결정 | 선택 | 이유 |
|---|---|---|---|
| Q1 | UI 접근 범위 | **(b) MASTER + SUPERVISOR** | PDF "Admin/Tax Engine" governance 성격 + Track C audit timeline 이 supervisor oversight 일과 일치. OPERATOR/LEAD 본업 (큐/케이스) 과 분리. |
| Q2 | API GET 범위 | **(a) UI 와 동일하게 좁힘** | UI 만 좁히면 비대칭. PATCH 가 이미 MASTER-only 인 것과 동일 패턴 (read=양쪽, write=master). |
| Q3 (impl) | UI 거부 처리 | silent redirect → `/{locale}/operator/dashboard` | operator/layout.tsx 의 silent-redirect 패턴과 일치. 분리된 4XX 페이지 미필요. |

## 3. Access matrix

| Role | 현재 UI | 현재 API GET | Track A 후 UI | Track A 후 API GET |
|---|---|---|---|---|
| CUSTOMER | 차단 (layout) | 200 | 차단 | **403** |
| CONSULTANT_JTC / TAX_ADVISOR_JTC | 차단 (layout) | 200 | 차단 | **403** |
| PLATFORM_ADMIN | 차단 | 403 | 차단 | 403 (변화 없음) |
| TAX_OPERATOR | 진입 | 200 | redirect → /operator/dashboard | **403** |
| TAX_OPERATOR_LEAD | 진입 | 200 | redirect → /operator/dashboard | **403** |
| TAX_OPERATOR_SUPERVISOR | 진입 | 200 | 진입 | 200 (변화 없음) |
| TAX_OPERATOR_MASTER | 진입 + 편집 | 200 + PATCH 200 | 진입 + 편집 (변화 없음) | (변화 없음) |

## 4. Implementation

### 4.1 Page gate (`src/app/[locale]/(dashboard)/operator/settings/page.tsx`)

이미 `resolveUserRole` 호출 + `canEdit` 결정하는 server component. role 결정 직후 narrowing 추가:

```ts
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

// ... 기존 imports ...

export default async function OperatorSettingsPage() {
  const t = await getTranslations('operatorSettings');
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await resolveUserRole(supabase, user.id) : null;

  // Track A: narrow to MASTER + SUPERVISOR (PDF "Admin/Tax Engine" governance).
  // Operator layout has already allowed all 4 operator tiers in; this gate
  // narrows further for the settings page specifically. OPERATOR/LEAD bounce
  // back to /operator/dashboard (the parent operator surface).
  const SETTINGS_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
  if (!role || !SETTINGS_ROLES.includes(role)) {
    redirect(`/${locale}/operator/dashboard`);
  }

  const canEdit = role === 'TAX_OPERATOR_MASTER';

  // ... 나머지 기존 코드 (rules fetch, audit fetch, render) ...
}
```

`redirect` from `next/navigation`, `getLocale` from `next-intl/server`. 두 import 모두 operator/layout.tsx 가 이미 쓰는 패턴.

### 4.2 API gate — 2 GET endpoints

**`src/app/api/admin/tax-code-rule/route.ts`** (GET):
```ts
return composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
)(request as RequestWithSession, handleGet);
```

**`src/app/api/admin/tax-code-rule/audit-log/route.ts`** (GET): 동일 middleware chain.

`requireRole` 은 가변 인자 (`...roles: UserRole[]`) — Track B/C 의 PATCH endpoint 에서 이미 사용 검증됨.

PATCH (`tax-code-rule/[id]/route.ts`) 는 이미 `requireRole(UserRole.TAX_OPERATOR_MASTER)` 라 변경 없음.

### 4.3 Sidebar 정정 (`src/components/layout/sidebar.tsx`)

현재 `/operator/settings` 줄은 `supervisorRoles` (LEAD + SUPERVISOR + MASTER) 한테 노출. Track A 후 LEAD 가 클릭하면 silent redirect 가 일어나 UX 불일치.

수정: 그 한 줄만 `[SUPERVISOR, MASTER]` 로 좁힘.

`NavItem` 인터페이스에 `roles?: UserRole[]` per-item override 가 이미 있음 (sidebar.tsx:59). 가장 깔끔한 옵션 채택: 그 한 줄에 inline roles 추가.

```tsx
{
  href: '/operator/settings',
  icon: Settings,
  labelKey: 'nav.opsSettings',
  roles: [UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER], // Track A
},
```

상위 section 의 `supervisorRoles` (LEAD 포함) 와 교차하여 LEAD 는 자동 제외.

### 4.4 Smoke 갱신 (`scripts/test-tax-code-rule.ts`)

기존 15 assertion 중 1개 expectation 변경 + 3개 추가:

| # | 기존 | Track A 후 |
|---|---|---|
| 2 | CONSULTANT GET → 200 | CONSULTANT GET → **403** (메시지 라벨도 갱신) |
| 16 | (없음) | **MASTER+SUPERVISOR 양쪽 GET 200 + 7 rows** (= SUPERVISOR GET 검증) |
| 17 | (없음) | **SUPERVISOR GET audit-log → 200 + array** |
| 18 | (없음) | **OPERATOR GET → 403** |

번호 13/14/15 (Track C audit) 는 그대로. 17 의 SUPERVISOR audit-log read 는 Track C 의 13 (MASTER audit-log read) 과 짝.

총 **18 assertion**.

### 4.5 CLAUDE.md

Track B+C 라인을 "Track B+C+A" + "15 → 18" 로 갱신:
```
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B+C+A Tax Code Rule CRUD + RBAC + audit timeline + access gate (GET 4 roles + PATCH 5 roles + 400/404 + audit-log GET 2 roles + 1 forbidden, 총 18)
```

### 4.6 Files

수정:
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — role narrowing + redirect
- `src/app/api/admin/tax-code-rule/route.ts` — middleware chain narrow
- `src/app/api/admin/tax-code-rule/audit-log/route.ts` — middleware chain narrow
- `src/components/layout/sidebar.tsx` — settings 항목 role 좁힘
- `scripts/test-tax-code-rule.ts` — assertion 2 expectation + 16/17/18 신규
- `CLAUDE.md` — 라인 갱신

신규: **0 파일**, 마이그레이션 **0개**.

## 5. Risks / open questions

- **OPERATOR/LEAD 의 silent redirect UX**: 북마크/URL 진입 시 메시지 없이 redirect. operator/layout.tsx 의 redirect 와 동일 패턴이라 신규 우려 없음.
- **CONSULTANT 가 GET 호출하면 403 으로 깨질 client**: 현재 API GET 을 CONSULTANT 가 부르는 client 코드는 없음 (page.tsx 만 호출, page 는 operator layout 으로 이미 차단). 회귀 영향 없음. smoke 의 assertion 2 만 expectation 변경.
- **smoke runner step 라벨**: `scripts/test-smoke-all.ts` 의 step name "tax code rule CRUD + RBAC (Track B)" 갱신 여부. 가독성 위해 "Track B+C+A" 또는 generic 라벨로. cosmetic 이라 implementation 시 결정.
- **Track D 와의 상호작용**: Track D (Coretax 토글 DB-driven) 가 settings 페이지 다른 섹션에 영향 줌. Track A 의 access gate 는 페이지 단위라 Track D 의 변경과 충돌 없음.

## 6. Out of scope (Track D)

- Coretax API 토글을 env-var → DB-driven 으로 (Track D)
- 변경 announcements/changelog 메뉴 (별도 트랙)
- finer per-section 게이트 (e.g., supervisor 한테는 audit timeline 만 보이게) — 현 design 은 페이지 단위 all-or-nothing
