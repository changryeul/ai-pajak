# Tax Code Rule — DB-persistence + inline 편집 (Track B)

- **Date**: 2026-05-27
- **PDF source**: 수퍼바이저 화면 메신저 포함 20260525, p.26-27 ("Admin / Tax Engine")
- **Track**: B (of A/B/C/D sequence noted in commit `6db31f2` 의 후속)
- **Status**: Design approved, ready for implementation plan

## 1. Context

현재 `/operator/settings` (`src/app/[locale]/(dashboard)/operator/settings/page.tsx`) 페이지의 **§3 "Tax Code Rules"** 7행은 client component 안의 `TAX_RULES_KO` 상수로 하드코딩 되어 있다. PDF 의 정적 mock 을 그대로 그리는 단계이고, MASTER 가 운영하면서 "검토 조건" / "필요 증빙" / "세율 기준" 문구를 손볼 수단이 없다.

Track B 는 이 7행을 DB-persisted + MASTER inline-editable 로 전환한다. 이후 Track C 가 변경 timeline 을 별도 audit 테이블로 영구 저장하고, Track A 가 페이지 자체의 권한 게이트(현재 미설정)를 정리하며, Track D 가 Coretax API 토글(현재 env-var manual mode) 을 DB-driven 으로 옮긴다.

## 2. Decisions (confirmed in brainstorming)

| # | 결정 | 선택 | 이유 |
|---|---|---|---|
| Q1 | 데이터 스코프 | **시스템-레벨 단일 테이블** | 인도네시아 정부 세무 코드 = 모든 firm 공통. firm 별로 다르면 위험. |
| Q2 | 편집 권한 | **TAX_OPERATOR_MASTER 만** | PDF "Admin / Tax Engine" badge 와 일치. Master 는 이미 governance 영역(`/admin/master/*`) 보유. |
| Q3 | 편집 UX | **Row 별 inline 편집** | 7행 고정 + 짧은 텍스트 다수 → modal/drawer 보다 클릭 적고 비교 쉬움. |

명시적으로 빠진 것:
- 신규 row 추가 / 삭제 (세법 개정 = 마이그레이션 처리)
- `category` / `sort_order` 변경
- per-tax_partner override (필요 시 미래에 row-level column 추가)
- Full audit timeline (Track C)
- 다국어 컬럼 (현재 ko 한 벌, 필요 시 향후 column 추가)

## 3. Schema

마이그레이션 파일: `supabase/migrations/20260527000001_tax_code_rule.sql`

```sql
CREATE TABLE tax_code_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL UNIQUE,        -- 'PPh21' | 'PPh23' | 'PPh4(2)' | 'PPh22' | 'PPh26' | 'PPN' | 'PPh25'
  sort_order      INTEGER NOT NULL,            -- 1..7, stable PDF row order
  tax_code        TEXT NOT NULL,               -- '411121-100' 등
  rate_rule       TEXT NOT NULL,               -- 세율 기준
  condition_text  TEXT NOT NULL,               -- 적용 조건
  doc_required    TEXT NOT NULL,               -- 필요 증빙
  review_note     TEXT NOT NULL,               -- 상담원 검토 조건
  updated_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tax_code_rule_sort_order_idx ON tax_code_rule(sort_order);

-- RLS
ALTER TABLE tax_code_rule ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_code_rule_read ON tax_code_rule
  FOR SELECT TO authenticated USING (true);

-- UPDATE: MASTER 만. user_roles 에서 TAX_OPERATOR_MASTER active 확인.
CREATE POLICY tax_code_rule_master_update ON tax_code_rule
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- INSERT / DELETE 정책 없음 → 인증된 누구도 row 추가/삭제 불가.
-- (Seed 는 service-role 키로 같은 마이그레이션 안에서 1회.)

-- Seed (idempotent)
INSERT INTO tax_code_rule (category, sort_order, tax_code, rate_rule, condition_text, doc_required, review_note) VALUES
  ('PPh21',   1, '411121-100', '급여/비정기소득별 누진·TER 기준',     '직원 급여, THR, bonus, benefit 등',                        'Payroll, A1/A2, employee master',         '직원구분/비과세/공제항목 확인'),
  ('PPh23',   2, '411124-104', '일반 용역 2% 등',                    '서비스 수수료, management fee, royalty 등',                'Invoice, contract, bukti potong',         '서비스 성격과 계약서 문구 확인'),
  ('PPh4(2)', 3, '411128-403', '최종분리과세 항목별 상이',             '건물 임대, 특정 건설서비스, 토지/건물 거래 등',              '계약서, 라이선스, invoice',                  'PPh23과 혼동 위험이 큰 항목 우선검토'),
  ('PPh22',   4, '411122-100', '거래/수입/기관별 상이',               '수입, 정부거래, 특정 상품 거래',                            'PIB, purchase document, payment proof',   '거래주체와 과세대상 여부 확인'),
  ('PPh26',   5, '411127-100', '기본 20% / 조세조약 적용 가능',         '비거주자 지급, royalty, interest, technical fee',          'DGT Form, treaty residence certificate, contract', '조세조약 적용 가능성과 DGT 유효성 확인'),
  ('PPN',     6, '411211-100', '현재 적용 VAT rate 기준',             '과세 재화/용역, PKP 거래',                                  'Faktur Pajak, invoice, e-Faktur data',    'PKP 여부, VAT credit 가능 여부 확인'),
  ('PPh25',   7, '411126-100', '전년도 기준 월할 또는 신규 기준',        '법인/개인 월별 선납세액',                                    '전년도 SPT, PPh25 billing history',       'UMKM final 전환 여부와 법인나이 확인')
ON CONFLICT (category) DO NOTHING;
```

## 4. API

### `GET /api/admin/tax-code-rule`

`src/app/api/admin/tax-code-rule/route.ts`

- 미들웨어: `composeMiddleware(requireAuth, blockPlatformAdmin)` — PLATFORM_ADMIN 은 read 도 차단(하드룰 #1 일관성). 다른 모든 인증 role 은 read 가능.
- 응답: `{ data: TaxCodeRule[] }` (sort_order ASC).
- 캐싱: `cache: 'no-store'` (변경 직후 stale 회피).

### `PATCH /api/admin/tax-code-rule/[id]`

`src/app/api/admin/tax-code-rule/[id]/route.ts`

- 미들웨어: `composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(UserRole.TAX_OPERATOR_MASTER), withAudit('TAX_CODE_RULE_UPDATE'))`
- 입력 Zod 스키마(부분 업데이트, 모두 optional but 최소 1개 필수):
  ```ts
  z.object({
    tax_code:       z.string().min(1).max(50).optional(),
    rate_rule:      z.string().min(1).max(500).optional(),
    condition_text: z.string().min(1).max(500).optional(),
    doc_required:   z.string().min(1).max(500).optional(),
    review_note:    z.string().min(1).max(500).optional(),
  }).refine(v => Object.keys(v).length > 0, { message: 'at least one field required' })
  ```
- 핸들러: `updated_by = req.session.userId`, `updated_at = now()` 강제 set. 응답 `{ data: TaxCodeRule }` (갱신된 행).
- 404 if id not found, 400 if body 비어있음.

### 응답 타입

```ts
export interface TaxCodeRule {
  id: string;
  category: string;
  sort_order: number;
  tax_code: string;
  rate_rule: string;
  condition_text: string;
  doc_required: string;
  review_note: string;
  updated_by: string | null;
  updated_at: string;   // ISO
  created_at: string;
}
```

## 5. UI

### `page.tsx` 변경

현 client component (`'use client'`) 를 **server component** 로 전환:
- `createServerClient()` (Supabase, user 세션) 로 `tax_code_rule` 7행 fetch (RLS `SELECT … USING (true)` 가 인증 사용자에게 모두 허용).
- 1~5 섹션 중 §3 만 자식 client component 로 분리 (`TaxCodeRulesTable`). 나머지 4섹션 + 헤더는 server 그대로.
- 7행 + 현재 role (서버에서 세션 읽어 결정) 을 props 로 전달.
- `useTranslations` → `getTranslations` 로 교체 (자식 client 는 `useTranslations` 유지).

### `TaxCodeRulesTable.tsx` (신규 client component)

위치: `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRulesTable.tsx`

Props:
```ts
{ initialRules: TaxCodeRule[]; canEdit: boolean; }
```

상태:
- `useQuery` 로 list 관리 (`initialData = initialRules`).
- `editingId: string | null` — 동시에 한 행만 편집.
- `draft: Partial<TaxCodeRule>` — 편집 중 값.
- `useMutation` PATCH → `onSuccess`: invalidate + `editingId = null` + success toast. `onError`: error toast, draft 유지.

행 렌더링:
- `editingId !== row.id` (정적 모드): 현 PDF UI 와 동일. 우측 끝에 `canEdit` 면 "편집" 버튼.
- `editingId === row.id` (편집 모드): 5개 셀(`tax_code`, `rate_rule`, `condition_text`, `doc_required`, `review_note`) 을 `<input>` (tax_code 짧음) / `<textarea>` (긴 텍스트) 로 전환. 우측 끝에 "저장" / "취소" 버튼. 저장 중 disabled + spinner. `category` 와 `sort_order` 는 readonly 셀.

추가 UI:
- 편집 모드 진입 시 다른 행의 "편집" 버튼 disabled — 동시 편집 방지.
- `updated_at` 기준 24h 이내 행에는 category 셀 옆 작은 "최근 수정" pill (track C 의 timeline 으로 가는 시각적 다리).
- MASTER 가 아니면 "편집" 버튼 자체가 안 보임 + 컬럼 안내 tooltip ("편집은 MASTER 권한 필요") 로 read-only 안내.

### 변경 영역 비교

```
page.tsx                §1 Form Profile     ← 변경 없음 (server)
                        §2 Control          ← 변경 없음 (server)
                        §3 Tax Code Rules   ← <TaxCodeRulesTable initialRules={…} canEdit={…} />  (client)
                        §4 Decision         ← 변경 없음 (server)
                        §5 Audit            ← 변경 없음 (track C 에서 교체)
```

## 6. i18n

`operatorSettings.rules.*` 에 신규 키 7개 × 5 locale (ko/en/id/ja/zh):

| 키 | ko 샘플 |
|---|---|
| `editButton` | "편집" |
| `saveButton` | "저장" |
| `cancelButton` | "취소" |
| `savingLabel` | "저장 중..." |
| `saveError` | "저장 실패: {message}" |
| `recentlyUpdated` | "최근 수정" |
| `masterOnlyTooltip` | "편집은 MASTER 권한이 필요합니다." |

셀 본문은 DB 값(현 ko 시드) 그대로 렌더 — 향후 다국어 컬럼이 필요해지면 column 추가.

## 7. Regression

### Unit
- 없음 (calculator 모듈 아님).

### Smoke
새 파일: `scripts/test-tax-code-rule.ts`

검증 매트릭스:
1. `GET /api/admin/tax-code-rule` (MASTER) → 200, `data.length === 7`, category set === expected.
2. `GET …` (CONSULTANT_JTC) → 200 (read 가능).
3. `GET …` (PLATFORM_ADMIN) → 403.
4. `PATCH /api/admin/tax-code-rule/{PPh21.id}` (MASTER, `{review_note: 'TEMP_TEST'}`) → 200, response.review_note === 'TEMP_TEST'.
5. `GET …` 재조회 → PPh21.review_note === 'TEMP_TEST', updated_by === master.user_id.
6. `PATCH …` (MASTER, 원복) → 200.
7. `PATCH …` (SUPERVISOR) → 403.
8. `PATCH …` (TAX_OPERATOR) → 403.
9. `PATCH …` (CONSULTANT_JTC) → 403.
10. `PATCH …` (PLATFORM_ADMIN) → 403.
11. `PATCH …` (MASTER, 빈 body `{}`) → 400.
12. `PATCH /api/admin/tax-code-rule/non-existent-uuid` (MASTER, valid body) → 404.

스크립트 종료 전 항상 원복. CLAUDE.md 의 smoke 패턴 (`SEED_TARGET=prod` 지원) 일관 유지.

### `package.json` + smoke runner
- `package.json` `scripts` 영역에 `test:tax-code-rule` 추가 (optional, 개별 실행용).
- 통합 runner (`scripts/smoke-runner.ts` 같은 파일이 있다면) 에 13번째 step 으로 wire.

### e2e
- 없음 (이 단계). UI flow 는 다음 사이클의 e2e 묶음에서 다룰 수 있음.

## 8. Files touched

신규:
- `supabase/migrations/20260527000001_tax_code_rule.sql`
- `src/app/api/admin/tax-code-rule/route.ts`
- `src/app/api/admin/tax-code-rule/[id]/route.ts`
- `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRulesTable.tsx`
- `scripts/test-tax-code-rule.ts`

수정:
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — server-component 화 + §3 자식 분리
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — `operatorSettings.rules.*` 7 키 추가
- `package.json` — smoke 스크립트 한 줄
- (optional) 통합 smoke runner — step 추가

## 9. Out of scope (Track C/A/D 로 넘김)

- 변경 timeline 영구 저장 + 페이지 §5 audit row list 동적 교체 → **Track C**
- 페이지 자체 접근 권한 게이트 (현재 operator/supervisor/master 모두 진입 가능, 의도된 동작 검증 필요) → **Track A**
- Coretax API 토글 (env var → DB-driven) → **Track D**

## 10. Risks / open questions

- **MASTER 시드 부재 환경** — local Supabase 에서 `master.test@aipajak.com` 은 `npm run db:seed-test-users` 만으론 안 시드됨; `SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts` 필요. `scripts/test-tax-code-rule.ts` 의 prereq 주석에 명시.
- **`category = 'PPh4(2)'` 에 괄호 포함** — JSON 직렬화/URL 인코딩 모두 문제 없으나, 회귀 스크립트의 매칭 string literal 에 escape 주의.
