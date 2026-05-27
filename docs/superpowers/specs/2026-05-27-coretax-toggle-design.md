# Coretax API 토글 — env → DB-driven (Track D)

- **Date**: 2026-05-27
- **PDF source**: 수퍼바이저 화면 메신저 포함 20260525, p.26 §3 4-card header strip 의 "Coretax Status" 카드 (현재 "API 미연동 / 상담원 수동처리" 정적 표기)
- **Track**: D (of B/C/A/D sequence; B/C/A complete 2026-05-27)
- **Status**: Design approved, ready for implementation plan

## 1. Context

Coretax API 통합 ON/OFF 가 현재 env var `CORETAX_SUBMIT_ENABLED` 로만 제어 — toggle 마다 Vercel redeploy 필요. PDF p.26 의 §3 Coretax Status 카드는 정적 i18n 텍스트 ("API 미연동 / 상담원 수동처리") 라서 실제 상태 반영도 안 됨.

`src/lib/coretax/client.ts` 의 `isEnabled()` 가 4개 env (`SUBMIT_ENABLED`, `API_BASE_URL`, `API_TOKEN`, `API_TIMEOUT_MS`) 를 읽어 boolean 반환. 호출자는 `operator/cases/[id]/coretax/route.ts` 4곳 (auto-fill billingId/bpeNumber 결정) + `closing-statements/[id]/submit/route.ts` (channel 선택).

Track D 는 `SUBMIT_ENABLED` 만 DB 로 옮겨 MASTER 가 UI 토글로 즉시 ON/OFF. credentials (URL+token+timeout) 는 SecOps 영역 → env 유지.

## 2. Decisions (confirmed in brainstorming)

| # | 결정 | 선택 | 이유 |
|---|---|---|---|
| Q1 | DB 이전 범위 | **(a) Toggle 만** (`SUBMIT_ENABLED`) | credentials (URL/token) DB 저장은 백업/audit/RLS gap 으로 secret 유출 risk. SecOps 가 env 로 rotate. |
| Q2 | 저장 위치 | **(a) 신규 `system_setting` generic kv** | 1행 1 key (`coretax.submit_enabled`). 미래 다른 system flag forward-compat. JSONB value 라 metadata 자유. |
| Q3 | env↔DB 우선순위 | **(a) DB-only (env 폐기)** | 단일 source of truth. seed 는 `{enabled: false}` — deploy 후 master 가 UI 로 ON. ambiguity 없음. |

## 3. Schema (마이그레이션 `20260527000003_system_setting.sql`)

```sql
-- Generic platform-level kv store. Today's only row: coretax.submit_enabled.
-- Read = all authenticated; Update = TAX_OPERATOR_MASTER. No INSERT/DELETE
-- from app (rows added via migrations only).

CREATE TABLE system_setting (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_setting IS
  'Platform-level config kv. MASTER edits only. Today: coretax.submit_enabled.';

ALTER TABLE system_setting ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_setting_read ON system_setting
  FOR SELECT TO authenticated USING (true);

CREATE POLICY system_setting_master_update ON system_setting
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- Seed (idempotent). Prod 의 현 env CORETAX_SUBMIT_ENABLED 가 false 라 안전.
INSERT INTO system_setting (key, value) VALUES
  ('coretax.submit_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Audit ENUM 추가 (Track C 의 audit_tax_code_rule_enum 패턴과 동일).
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CORETAX_TOGGLE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

## 4. `src/lib/coretax/client.ts` 변경

### 4.1 `isEnabled()` sync → async + 60s cache

```ts
let enabledCache: { value: boolean; expiresAt: number } | null = null;
const ENABLED_CACHE_TTL_MS = 60_000;

export async function isEnabled(): Promise<boolean> {
  if (enabledCache && enabledCache.expiresAt > Date.now()) {
    return enabledCache.value;
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('system_setting')
    .select('value')
    .eq('key', 'coretax.submit_enabled')
    .single();
  const dbEnabled = (data?.value as { enabled?: boolean } | undefined)?.enabled === true;
  const cfg = readConfig();
  const value = dbEnabled && !!(cfg.baseUrl && cfg.token);  // credentials guard 유지
  enabledCache = { value, expiresAt: Date.now() + ENABLED_CACHE_TTL_MS };
  return value;
}

export function invalidateEnabledCache(): void {
  enabledCache = null;
}
```

`getSupabaseAdmin` import 추가. `process.env.CORETAX_SUBMIT_ENABLED` 참조 제거.

### 4.2 호출자 변경 (4 사이트, `operator/cases/[id]/coretax/route.ts`)

| 라인 | 변경 |
|---|---|
| 149 | `coretaxMode: coretax.isEnabled() ? ...` → `coretaxMode: (await coretax.isEnabled()) ? ...` |
| 151 | `apiEnabled: coretax.isEnabled()` → `apiEnabled: await coretax.isEnabled()` |
| 248 | `if (!billingId && coretax.isEnabled())` → `if (!billingId && (await coretax.isEnabled()))` |
| 298 | `if (!bpeNumber && coretax.isEnabled())` → `if (!bpeNumber && (await coretax.isEnabled()))` |

또한 `src/app/api/tax/annual-closing/[id]/submit/route.ts:80` 의:
```ts
const useCoretaxApi = process.env.CORETAX_SUBMIT_ENABLED === 'true';
```
→
```ts
const useCoretaxApi = await coretax.isEnabled();
```
+ `import * as coretax from '@/lib/coretax/client';` 추가.

### 4.3 `client.test.ts` 재작성

기존 5 test (env 기반) 가 모두 깨짐 → DB query mock 으로 재구성. Vitest `vi.mock('@/lib/supabase/admin', ...)` 패턴. 또는 cache 주입 helper (`__setEnabledCacheForTest(value)`) export.

가벼운 접근: 테스트마다 `invalidateEnabledCache()` 호출 + supabase admin client mock 으로 `from().select().eq().single()` chain 이 원하는 `{ data: { value: {enabled} }}` 반환하게 stub.

## 5. API endpoints (`src/app/api/admin/coretax/config/route.ts`)

신규 한 파일에 GET + PATCH 둘 다.

### 5.1 GET
```ts
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
)
```
응답: `{ data: { enabled: boolean, updatedAt: string | null, updatedBy: string | null } }` + `Cache-Control: no-store`.

### 5.2 PATCH
```ts
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_OPERATOR_MASTER),
)
```

Zod: `z.object({ enabled: z.boolean() })`. Handler:
1. SELECT before (current row value)
2. UPDATE `system_setting` row + `updated_by`/`updated_at`
3. `coretax.invalidateEnabledCache()` (이 instance 캐시 즉시 무효화)
4. `recordAudit({ action: 'CORETAX_TOGGLE', actorUserId, actorRole, details: { key: 'coretax.submit_enabled', before: oldEnabled, after: newEnabled }, ipAddress, userAgent })` — Track C 의 manual recordAudit 패턴
5. Response: `{ data: { enabled, updatedAt, updatedBy } }`

no-op (already that value) 시에도 audit 생성 vs skip — Track C 와 일관성: **skip** (변경 없으면 row 없음).

## 6. UI 변경

### 6.1 `page.tsx` 변경

§3 4-card header strip 의 Coretax 카드를 정적 `Header` 헬퍼 → 신규 client component 로 교체:

```tsx
<CoretaxStatusCard initial={coretaxConfig} canEdit={canEdit} />
```

server 에서 fetch:
```ts
const { data: coretaxRow } = await admin
  .from('system_setting')
  .select('value, updated_by, updated_at')
  .eq('key', 'coretax.submit_enabled')
  .single();

const coretaxConfig = {
  enabled: (coretaxRow?.value as { enabled?: boolean } | undefined)?.enabled === true,
  updatedAt: coretaxRow?.updated_at ?? null,
  updatedBy: coretaxRow?.updated_by ?? null,
};
```

(actor email join 은 카드 안에서 굳이 필요 없음 — updatedAt + role 만 표시.)

### 6.2 `_components/CoretaxStatusCard.tsx` (신규 client)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface Props {
  initial: { enabled: boolean; updatedAt: string | null; updatedBy: string | null };
  canEdit: boolean;
}

export function CoretaxStatusCard({ initial, canEdit }: Props) {
  const t = useTranslations('operatorSettings.header');
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/coretax/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setEnabled(j.data.enabled);
      toast.success(t(j.data.enabled ? 'coretaxValueOn' : 'coretaxValueOff'));
      router.refresh();
    } catch (e) {
      toast.error(`${e}`);
    } finally {
      setSaving(false);
    }
  };

  const tone = enabled ? 'emerald' : 'amber';
  const cls = tone === 'emerald'
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-amber-50 border-amber-200';
  const valueLabel = t(enabled ? 'coretaxValueOn' : 'coretaxValueOff');

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{t('coretaxStatus')}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-base font-black text-slate-900">{valueLabel}</p>
        {canEdit && (
          <button
            type="button"
            disabled={saving}
            onClick={toggle}
            className={`rounded px-2 py-1 text-[10px] font-bold border ${enabled ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-amber-700 text-white border-amber-800'} disabled:opacity-50`}
            aria-pressed={enabled}
          >
            {saving ? '…' : t('coretaxToggle')}
          </button>
        )}
      </div>
    </div>
  );
}
```

기존 정적 `Header` 헬퍼는 다른 3 카드 (fiscalYear/platform/manageTarget) 가 계속 사용 — 그대로 유지.

## 7. i18n (5 locale, 3 신규 + 1 삭제)

`operatorSettings.header.*` 에:

**추가**:
| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `coretaxValueOn` | "API 자동" | "API auto" | "API otomatis" | "API 自動" | "API 自动" |
| `coretaxValueOff` | "수동 처리" | "Manual mode" | "Mode manual" | "手動処理" | "手动处理" |
| `coretaxToggle` | "토글" | "Toggle" | "Toggle" | "切替" | "切换" |

**삭제**: `coretaxStatusValue` (정적 라벨, 사용처 사라짐).

## 8. 회귀 (`scripts/test-coretax-toggle.ts` — 신규)

별도 스크립트로 분리 (`test-tax-code-rule.ts` 와 family 다름). 5 assertion:

1. SUPERVISOR GET → 200 + `{enabled, updatedAt, updatedBy}` shape
2. MASTER GET → 200 (같은 shape)
3. PLATFORM_ADMIN GET → 403
4. SUPERVISOR PATCH `{enabled: true}` → 403
5. MASTER PATCH `{enabled: !current}` → 200 + DB 반영 검증 → revert

cleanup: 항상 원래 값으로 revert. audit_log 에 `CORETAX_TOGGLE` row 생성 검증 (optional, 보너스).

`scripts/test-smoke-all.ts` 에 step 추가 (`coretax toggle (Track D)`). 13 → 14 steps.

## 9. Files

신규:
- `supabase/migrations/20260527000003_system_setting.sql`
- `src/app/api/admin/coretax/config/route.ts`
- `src/app/[locale]/(dashboard)/operator/settings/_components/CoretaxStatusCard.tsx`
- `scripts/test-coretax-toggle.ts`

수정:
- `src/lib/coretax/client.ts` — async isEnabled + cache + invalidation
- `src/lib/coretax/client.test.ts` — DB mock 으로 재작성
- `src/app/api/operator/cases/[id]/coretax/route.ts` — 4 곳 `await`
- `src/app/api/tax/annual-closing/[id]/submit/route.ts` — env 참조 → `await coretax.isEnabled()`
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — coretax fetch + 카드 교체
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 신규 + 1 삭제
- `scripts/test-smoke-all.ts` — step 추가
- `package.json` — `test:coretax-toggle` 스크립트 (optional)
- `CLAUDE.md` — Coretax env var 섹션 deprecate 명시 + 새 smoke 라인 추가

마이그레이션 신규: **1개** (`20260527000003_system_setting.sql`, table+RLS+seed+ENUM add).

## 10. Risks / open questions

- **Per-instance 60s cache stale**: master flip 후 다른 Vercel function instance 가 최대 60s 옛값 반환. 운영 영향 미미 (Coretax 통합은 분 단위 작업 아님, operator 가 수동 fallback 가능).
- **`isEnabled()` async 전환의 잠재 회귀**: TS strict mode 가 `Promise<boolean>` truthy check 잡아줌. 단, ESLint `no-misused-promises` 가 켜져 있어야 안전. 모든 호출자 (`coretax.isEnabled()` grep) 변경 확인 필요.
- **env `CORETAX_SUBMIT_ENABLED` deprecate**: deploy 직후 prod 의 기존 env (현재 false 라 가정) 가 무시됨. 안전. 그러나 staging/dev 의 env 도 정리 필요 (`.env*` 파일 + Vercel project settings 의 항목 삭제). CLAUDE.md 에 명시 + 후속 cleanup 권고.
- **Cache invalidation 은 PATCH instance 만**: 다른 instance 는 60s TTL 기다림. Redis pub/sub 등 분산 invalidation 은 over-engineering — 60s 허용 가능.
- **`client.test.ts` 재작성 분량**: 5 test 가 env 기반이라 모두 mock 으로 교체. 분량 작아 1 task 안에 끝남.
- **Audit ENUM `CORETAX_TOGGLE` 미정의 시 fallback**: 마이그레이션이 ENUM add 를 포함하므로 같은 commit 에서 안전. Track B nits 의 `audit_tax_code_rule_enum` 패턴과 동일.
- **Track A 의 page-level role gate**: `/operator/settings` 는 SUPERVISOR + MASTER 만 진입. coretax 카드는 SUPERVISOR 한테는 read-only, MASTER 만 toggle 버튼 노출 (`canEdit` 재활용). 일관.

## 11. Out of scope

- credentials (URL/token) DB 이전 (보안상 의도적 제외)
- 분산 cache invalidation (Redis pub/sub)
- Coretax 통합의 실제 endpoint 호출/응답 변경 (`call()` 내부 로직)
- multi-key system_setting UI (오늘 1행, 미래 트랙)
