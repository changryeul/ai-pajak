# Customer AI Chat Phase 2.2 — Draft Persistence + History

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2+Q3 = a+a+a)
- **Builds on**: Phase 2 (`45b92cc`, ✨ on-demand) + Phase 2.1 (`3d5971f`, auto-draft) — both ephemeral

## 1. Context

Phase 2/2.1 의 draft 가 ephemeral (또는 single `auto_draft` column). Operator 가 여러 draft 시도 또는 review 시 이전 시도 lost. 신규 customer message 도착 시 stale 한 auto_draft 가 그대로 → 사용자가 [닫기] 후 ✨ 클릭으로 새 draft 받아야.

이번 Phase 2.2 — draft 영구 저장 + history dropdown. v1 = auto-regenerate 안 함 (Phase 2.3 으로 deferred).

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | history 저장 | **(a) 신규 `customer_ai_draft` 테이블** — 깔끔, 확장성 ↑ |
| Q2 | 표시 UI | **(a) input 위 dropdown** "이전 N건" — 작은 공간 |
| Q3 | scope | **(a) v1 = history + dropdown UI 만** (auto-regenerate 별도 트랙) |

## 3. Schema

신규 마이그레이션 `supabase/migrations/20260603000005_customer_ai_draft.sql`:

```sql
CREATE TABLE IF NOT EXISTS customer_ai_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES customer_ai_thread(id) ON DELETE CASCADE,
  draft_text TEXT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('manual', 'auto')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'applied')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_draft_thread_recent
  ON customer_ai_draft(thread_id, generated_at DESC);

ALTER TABLE customer_ai_draft ENABLE ROW LEVEL SECURITY;

-- operator-tier only — same gate as customer-inbox
CREATE POLICY "Operator-tier read drafts" ON customer_ai_draft FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
    AND is_active = TRUE
  ));

CREATE POLICY "Operator-tier write drafts" ON customer_ai_draft FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
    AND is_active = TRUE
  ));

-- Block platform admin (consistent with thread + message tables)
CREATE POLICY "Block platform admin" ON customer_ai_draft FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    AND role = 'PLATFORM_ADMIN' AND is_active = TRUE
  ));
```

**Note**: customer 한테 노출 0 — RLS 가 operator-tier 만 허용. 마이그레이션 0 (테이블 + 인덱스 + 3 RLS).

## 4. Endpoints

### 4.1 GET `/api/operator/customer-inbox/threads/[id]/drafts`

list 반환 (최신 generated_at DESC, 최대 10):

```ts
{ data: Array<{
  id: string;
  draftText: string;
  source: 'manual' | 'auto';
  status: 'active' | 'dismissed' | 'applied';
  generatedAt: string;  // ISO
}> }
```

middleware: `composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(4 operator-tier))`. RBAC 검증.

### 4.2 DELETE `/api/operator/customer-inbox/threads/[id]/drafts/[draftId]`

soft delete (`status='dismissed'`) — history 보존 + UI 에서 숨김.

response: `{ data: { ok: true } }`. middleware 동일.

### 4.3 변경: 기존 POST `.../ai-draft` (Phase 2 ✨ 버튼)

ephemeral → DB INSERT:

```ts
// 기존 (Phase 2): Claude 호출 → return draft, no persistence
// 신규 (Phase 2.2): Claude 호출 → DB INSERT + return id + draft
const { draft, model } = await generateDraft(threadId);
const { data: row } = await admin
  .from('customer_ai_draft')
  .insert({ thread_id: threadId, draft_text: draft, source: 'manual', status: 'active' })
  .select('id, generated_at')
  .single();
return NextResponse.json({ data: { draftId: row.id, draft, model, generatedAt: row.generated_at } });
```

### 4.4 변경: 기존 Phase 2.1 auto-draft trigger (POST customer-ai/threads/[id]/messages 안의 background)

기존: `customer_ai_thread.auto_draft` UPDATE
신규: `customer_ai_draft` INSERT (source='auto')

Phase 2.1 의 `customer_ai_thread.auto_draft` 컬럼: backward compat 위해 유지 (UI 표시는 안 함), 또는 Phase 2.3 에서 제거. 본 spec 에선 그대로 유지하되 신규 row 도 INSERT.

### 4.5 변경: Phase 2.1 DELETE `.../auto-draft` (기존 dismiss)

기존: `auto_draft = null` 로 thread clear
신규: 최신 active draft 의 status='dismissed' 로 마크 (DELETE single 과 동일 의미)

## 5. UI

### 5.1 Operator inbox input area (`CustomerInboxClient.tsx`)

기존 Phase 2.1 pill `[수락][닫기]` → 확장:

```tsx
{selectedThread && drafts.length > 0 && (
  <div className="mb-2 space-y-1">
    {/* Latest draft pill (Phase 2.1 유지) */}
    {latestDraft && latestDraft.status === 'active' && (
      <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <span className="text-sm text-purple-900 flex-1 truncate">{latestDraft.draftText.slice(0, 80)}…</span>
        <button onClick={() => acceptDraft(latestDraft)} className="px-2 py-1 rounded bg-purple-600 text-white text-xs">{t('autoDraftAccept')}</button>
        <button onClick={() => dismissDraft(latestDraft.id)} className="px-2 py-1 rounded border text-xs">{t('autoDraftDismiss')}</button>
      </div>
    )}
    {/* History dropdown (신규 Phase 2.2) */}
    {drafts.length > 1 && (
      <details className="text-xs">
        <summary className="cursor-pointer text-purple-700 hover:text-purple-900 px-2 py-1">
          {t('draftHistoryToggle', { count: drafts.length })}
        </summary>
        <ul className="mt-1 space-y-1 max-h-48 overflow-y-auto bg-white border border-purple-100 rounded p-2">
          {drafts.slice(0, 10).map(d => (
            <li key={d.id} className={`flex items-center gap-2 p-2 rounded hover:bg-purple-50 ${d.status === 'dismissed' ? 'opacity-50' : ''}`}>
              <span className="text-[10px] text-gray-400 shrink-0">{formatTimeAgo(d.generatedAt)}</span>
              <span className="text-xs text-gray-700 flex-1 truncate">{d.draftText.slice(0, 60)}…</span>
              <button onClick={() => acceptDraft(d)} className="text-[10px] text-purple-600 hover:underline">{t('autoDraftAccept')}</button>
            </li>
          ))}
        </ul>
      </details>
    )}
  </div>
)}
```

### 5.2 State + handlers

```ts
const [drafts, setDrafts] = useState<DraftDTO[]>([]);

const loadDrafts = useCallback(async (threadId: string) => {
  const r = await fetch(`/api/operator/customer-inbox/threads/${threadId}/drafts`);
  const j = await r.json();
  setDrafts(j.data ?? []);
}, []);

// thread 선택 시 + ✨ 클릭 후 + send 후 refresh
useEffect(() => {
  if (selectedThreadId) loadDrafts(selectedThreadId);
}, [selectedThreadId, loadDrafts]);

const acceptDraft = (d: DraftDTO) => setInput(d.draftText);
const dismissDraft = async (id: string) => {
  await fetch(`/api/operator/customer-inbox/threads/${selectedThreadId}/drafts/${id}`, { method: 'DELETE' });
  loadDrafts(selectedThreadId!);
};
```

### 5.3 ✨ button 동작 변경

기존: response 의 draft 를 setInput
신규: response 의 draft 받음 + loadDrafts 호출 (history 갱신) + 최신 draft 가 pill 에 자동 표시

## 6. i18n (신규 3 키 × 5 locale)

`operatorCustomerInbox.*` 에 추가:
- `draftHistoryToggle`: "이전 draft {count}건 보기" / "Show {count} previous drafts" / ...
- `draftSourceManual`: "수동 ✨" / "Manual ✨" / ...
- `draftSourceAuto`: "자동" / "Auto" / ...

## 7. Smoke (extend `scripts/test-customer-ai-inbox.ts` → 15+3=18 assertion)

추가 assertion:
- 16. operator ✨ 클릭 → 신규 draft row 가 customer_ai_draft 에 insert (status='active', source='manual')
- 17. GET /drafts → 최신순 list, 신규 draft 가 최상단
- 18. DELETE /drafts/[id] → status='dismissed' 로 마크, GET 시 dismissed 표시

## 8. Files

**신규** (3):
- `supabase/migrations/20260603000005_customer_ai_draft.sql`
- `src/app/api/operator/customer-inbox/threads/[id]/drafts/route.ts` (GET)
- `src/app/api/operator/customer-inbox/threads/[id]/drafts/[draftId]/route.ts` (DELETE)

**수정** (3):
- `src/app/api/operator/customer-inbox/threads/[id]/ai-draft/route.ts` — POST 가 INSERT 추가 (response 에 draftId 포함)
- `src/app/api/customer-ai/threads/[id]/messages/route.ts` — Phase 2.1 의 auto-draft trigger 가 INSERT 도 같이
- `src/app/api/operator/customer-inbox/threads/[id]/auto-draft/route.ts` — Phase 2.1 의 DELETE 가 최신 active draft 의 status='dismissed' 로 변경
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx` — drafts state + dropdown UI + handler 변경
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 키 × 5 locale
- `scripts/test-customer-ai-inbox.ts` — 3 assertion 추가 (16-18)

**마이그레이션**: 1 (customer_ai_draft 테이블 + 인덱스 + 3 RLS).

## 9. Out of scope (Phase 2.3+)

- **Auto-regenerate** on customer message burst (현재는 첫 customer msg 만 trigger — burst 시 stale)
- **Inline streaming display** (Claude SSE)
- **Operator-level** (operator 끼리 안 공유)
- **Template snippets**
- `customer_ai_thread.auto_draft` 컬럼 제거 (현재 backward compat 유지)

## 10. Risks

- **DB row 폭증**: 매 customer message + 매 ✨ 클릭마다 row. 일반 thread 당 5-20 row, 100 thread = 500-2000 row. PK + 인덱스로 충분히 빠름. 1년 후 cleanup 필요 시 별도 트랙.
- **Persona masking**: customer 한테 노출 0 — RLS 가 operator-tier 만. customer 응답 (find-or-create / messages) 에서 draft 정보 leak 없음 (별도 endpoint, 별도 RLS).
- **migration history mismatch (2026-04-10 batch)**: drift CI guard 가 잡음. 새 마이그레이션 push 후 즉시 검증.
- **DTO mismatch**: `customer_ai_draft.status='applied'` 는 사용 안 함 (acceptDraft 이 client-side 만 setInput 함). 향후 send 후 자동 'applied' 마크 검토. 현재 v1 에선 미사용.

## 11. 검증

- TS clean
- vitest (있는 경우)
- prod smoke runner 20→23 step (3 assertion 추가)
- 마이그레이션 prod 적용 + drift audit 0
- visual: operator 가 thread 선택 → ✨ 클릭 → input 위 pill + dropdown 보임 → dropdown 클릭 → 이전 draft 선택 가능
