# Customer AI Chat Phase 2.1 — Auto-draft on customer message

- **Date**: 2026-05-30
- **Status**: Design approved
- **Builds on**: Phase 2 (ephemeral on-demand ✨ button)

## 1. Context

Phase 2 ✨ 버튼은 operator 가 thread 열고 한 번 더 클릭해야 함. Phase 2.1 은 customer 메시지 도착 직후 background 에서 자동 draft 생성 + thread row 에 저장 → operator 가 thread 열면 input 위 pill 로 "AI 추천 답변 있음 [수락] [닫기]" 노출. **응답 latency 체감 -80%** 목표.

✨ 버튼은 그대로 유지 (수동 trigger 백업).

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 트리거 빈도 | **(b) operator 직전 응답 이후 첫 customer 메시지에만** — 한 차례당 1 draft. 비용 1/3~1/5 절감. |
| Q2 | 저장 위치 | **(a) `customer_ai_thread.auto_draft TEXT` 컬럼** — latest 만 덮어쓰기. 마이그레이션 +2 컬럼. |
| Q3 | operator UI | **(b) input 위 suggestion pill** — `[수락] [닫기]` 명시적 수락. operator 가 이미 타이핑 중인 내용을 자동으로 덮어쓰지 않음. |

## 3. State Machine

```
auto_draft = NULL
  ↓ (customer sends message — POST customer/messages)
fire-and-forget generateDraft(threadId)
  ↓ (Claude success)
auto_draft = '<text>', auto_draft_at = NOW()
  ↓ (operator opens thread → list/detail returns auto_draft)
UI shows pill with [수락][닫기]
  ↓ (operator [수락])              ↓ (operator [닫기])           ↓ (operator sends reply)
input = auto_draft (local only)    DELETE /auto-draft           POST /messages
auto_draft 그대로 (cleared by send) → auto_draft = NULL         → auto_draft = NULL (server)
```

**Burst 처리**: customer 가 1초 안에 3 메시지 보내면 첫 메시지 트리거 후 `auto_draft != NULL` 이므로 후속 2 메시지는 skip. draft 가 1번째 메시지 기준이라 약간 stale 할 수 있음 — Q1 (b) 의 의도된 tradeoff.

## 4. Schema

**신규 마이그레이션**: `supabase/migrations/20260530000001_customer_ai_auto_draft.sql`

```sql
alter table customer_ai_thread
  add column auto_draft text,
  add column auto_draft_at timestamptz;

comment on column customer_ai_thread.auto_draft is
  'Latest AI-generated draft suggestion for operator (Phase 2.1). NULL when no pending draft.';
comment on column customer_ai_thread.auto_draft_at is
  'When auto_draft was generated. NULL when auto_draft is NULL.';
```

RLS: 기존 thread RLS 그대로 유지 (operator-tier read all, customer 본인 row read). 컬럼 추가만으로 권한 확장 X.

**Customer 노출 차단**: customer 가 GET 으로 thread 받을 때 (`/api/customer-ai/threads/find-or-create`) 서버에서 `auto_draft`, `auto_draft_at` field 제거 후 응답. RLS 는 column-level 가 없으므로 application-layer 필터로 차단. 보안 boundary 명확.

## 5. Backend

### 5.1 Shared helper: `src/lib/customer-ai/draft.ts`

기존 Phase 2 endpoint 의 Claude 호출 로직을 함수로 추출:

```ts
export interface GenerateDraftResult {
  draft: string;
  model: string;
}

export async function generateDraft(threadId: string): Promise<GenerateDraftResult | null>;
```

- thread 없으면 null
- ANTHROPIC_API_KEY 없으면 null + log warn
- Claude 실패 시 null + log error (throw X — fire-and-forget 에서 사용)

기존 `/api/operator/customer-inbox/threads/[id]/ai-draft/route.ts` 도 이 함수 호출하도록 refactor — duplication 0.

### 5.2 Customer POST messages — background trigger via `after()`

`src/app/api/customer-ai/threads/[id]/messages/route.ts`:
- customer 메시지 insert 후
- thread row 조회 → `auto_draft IS NULL` 일 때만
- `import { after } from 'next/server'` (Next 16 stable)
- `after(() => generateAndStoreDraft(threadId))` — response 반환 후 Vercel fluid compute 가 background promise 보장 실행
- 헬퍼:
  ```ts
  async function generateAndStoreDraft(threadId: string): Promise<void> {
    try {
      const result = await generateDraft(threadId);
      if (!result) return;
      await admin
        .from('customer_ai_thread')
        .update({ auto_draft: result.draft, auto_draft_at: new Date().toISOString() })
        .eq('id', threadId)
        .is('auto_draft', null);  // race-safe: skip if already set
      await recordAudit({
        action: 'CUSTOMER_AI_DRAFT_REQUEST',
        actorUserId: null,  // system trigger, no actor
        details: { threadId, trigger: 'auto' },
      });
    } catch (e) { loggers.api.error({err: e instanceof Error ? e.message : 'unknown', threadId}, 'auto-draft failed'); }
  }
  ```
- response 는 기존대로 즉시 (customer 가 메시지 보낸 직후 thank-you 화면 봄). Claude latency 3-5초는 background 에서 진행.
- `after()` 가 (이론적으로) 사용 불가 환경이면 fallback: `await` 로 동기 호출 (customer 3초 대기). implementer 가 첫 dispatch 에서 `after` import 확인 → 안 되면 await fallback. 결정권 implementer.

### 5.3 Operator POST messages — clear on send

`src/app/api/operator/customer-inbox/threads/[id]/messages/route.ts`:
- operator 메시지 insert 후
- `update customer_ai_thread set auto_draft = null, auto_draft_at = null where id = $1`
- audit 그대로

### 5.4 Operator thread list — include auto_draft

`src/app/api/operator/customer-inbox/threads/route.ts`:
- select 에 `auto_draft, auto_draft_at` 추가
- 응답 thread 객체에 그대로 포함

### 5.5 Operator DELETE auto-draft (닫기)

**신규**: `src/app/api/operator/customer-inbox/threads/[id]/auto-draft/route.ts`

```ts
export async function DELETE(request) {
  return composeMiddleware(
    requireAuth, blockPlatformAdmin,
    requireRole(...4 operator-tier),
    withAudit('CUSTOMER_AI_DRAFT_DISMISS'),
  )(request as RequestWithSession, async (req) => {
    const threadId = parseUuid(req);
    if (!threadId) return NextResponse.json({error:'uuid'}, {status:400});
    const { error } = await admin
      .from('customer_ai_thread')
      .update({ auto_draft: null, auto_draft_at: null })
      .eq('id', threadId);
    if (error) return NextResponse.json({error:'failed'}, {status:500});
    return NextResponse.json({data:{ok:true}});
  });
}
```

### 5.6 Customer thread response — filter

`src/app/api/customer-ai/threads/find-or-create/route.ts`:
- thread row 응답 직전 `delete thread.auto_draft; delete thread.auto_draft_at;` (혹은 explicit select 에 제외)
- 확실하게 explicit field whitelist 권장

## 6. UI

`src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx`:

- thread state 에 `auto_draft: string | null, auto_draft_at: string | null` 포함 (list response 에서 옴)
- input bar 위에 conditional pill (selectedThread.auto_draft && !drafting):

```tsx
{selectedThread?.auto_draft && (
  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-sm">
    <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
    <span className="text-purple-900 truncate flex-1">
      {t('autoDraftPillText')} · {formatRelative(selectedThread.auto_draft_at)}
    </span>
    <button onClick={acceptAutoDraft} className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs">
      {t('autoDraftAccept')}
    </button>
    <button onClick={dismissAutoDraft} className="px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-100 text-xs">
      {t('autoDraftDismiss')}
    </button>
  </div>
)}
```

핸들러:
- `acceptAutoDraft()`: `setInput(selectedThread.auto_draft)`, locally clear (`updateThreadInList(id, {auto_draft: null})`). 서버 호출 X — 다음 operator send 가 어차피 clear.
- `dismissAutoDraft()`: `DELETE /auto-draft` → 응답 후 local clear

`formatRelative(iso)`: 간단 utility ("방금", "5분 전", "1시간 전"). 새 util 작성 또는 기존 `formatRelativeTime` 사용 (있으면).

## 7. i18n (3 keys × 5 locale)

`operatorCustomerInbox.*` 추가:

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `autoDraftPillText` | "AI 추천 답변 있음" | "AI draft available" | "Saran AI tersedia" | "AI 推奨あり" | "AI 推荐已生成" |
| `autoDraftAccept` | "수락" | "Accept" | "Terima" | "受け入れる" | "接受" |
| `autoDraftDismiss` | "닫기" | "Dismiss" | "Tutup" | "閉じる" | "关闭" |

## 8. Smoke (extend `scripts/test-customer-ai-inbox.ts` → 15 total)

기존 12 assertion 에 3 추가:

**13.** customer POST 2nd message → wait 8s → OPERATOR list thread 의 `auto_draft` 가 non-empty + `auto_draft_at` 가 timestamp
**14.** OPERATOR DELETE /auto-draft → 200 → 재조회 시 thread.auto_draft === null
**15.** CONSULTANT DELETE /auto-draft → 403

위치: 기존 11 (operator AI draft on-demand) 직후, 12 (consultant on-demand 403) 다음.

```ts
// 13. auto-draft populated after customer msg
await api(`/api/customer-ai/threads/${threadId}/messages`, custTok, { method:'POST', body:{content:'질문 두번째'} });
await sleep(8000);  // Claude latency budget
const r13 = await api('/api/operator/customer-inbox/threads', opTok);
const t13 = r13.body.data?.find((t:any) => t.id === threadId);
if (t13?.auto_draft && typeof t13.auto_draft === 'string' && t13.auto_draft.length > 0 && t13.auto_draft_at) {
  console.log(`✅ 13. auto-draft populated, length=${t13.auto_draft.length}`); pass++;
} else { console.error(`✗ 13. auto-draft missing:`, t13?.auto_draft); fail++; }

// 14. operator DISMISS
const r14 = await api(`/api/operator/customer-inbox/threads/${threadId}/auto-draft`, opTok, { method:'DELETE' });
const r14b = await api('/api/operator/customer-inbox/threads', opTok);
const t14 = r14b.body.data?.find((t:any) => t.id === threadId);
if (r14.status === 200 && (t14?.auto_draft === null || t14?.auto_draft === undefined)) {
  console.log(`✅ 14. dismiss → cleared`); pass++;
} else { console.error(`✗ 14. dismiss:`, r14.status, t14?.auto_draft); fail++; }

// 15. consultant DISMISS → 403
const r15 = await api(`/api/operator/customer-inbox/threads/${threadId}/auto-draft`, consTok, { method:'DELETE' });
if (r15.status === 403) { console.log(`✅ 15. consultant dismiss → 403`); pass++; } else { console.error(`✗ 15.`, r15.status); fail++; }
```

Anthropic 호출 실패 시 (잔액 0 등) assertion 13 fail — Phase 2 와 동일 패턴 (잔액 충전된 환경에서만 실 통과).

## 9. Files

**신규** (3):
- `supabase/migrations/20260530000001_customer_ai_auto_draft.sql`
- `src/lib/customer-ai/draft.ts` (Claude 호출 헬퍼)
- `src/app/api/operator/customer-inbox/threads/[id]/auto-draft/route.ts` (DELETE)

**수정** (7):
- `src/app/api/operator/customer-inbox/threads/[id]/ai-draft/route.ts` — `generateDraft` 헬퍼 호출로 refactor
- `src/app/api/customer-ai/threads/[id]/messages/route.ts` — fire-and-forget trigger
- `src/app/api/operator/customer-inbox/threads/[id]/messages/route.ts` — clear on send
- `src/app/api/operator/customer-inbox/threads/route.ts` — include auto_draft fields
- `src/app/api/customer-ai/threads/find-or-create/route.ts` — filter out auto_draft
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx` — pill + handlers
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 keys × 5 locale
- `scripts/test-customer-ai-inbox.ts` — +3 assertions = 15

## 10. Out of scope (Phase 2.2+)

- Draft history (여러 generation 비교)
- Auto-regenerate stale draft (customer 메시지 burst 후 1초 wait + regen)
- Draft 가 stale 한지 시각 표시 (e.g. customer 가 추가 메시지 보낸 후)
- Operator 가 다른 operator 의 draft 를 보는지 (현재는 모두 공유 — `auto_draft` 컬럼 thread-level)
- Template snippets (Phase 3)
- Inline streaming display (현재는 wait until done)

## 11. Risks

- **비용 burst**: customer 1명이 빠르게 100 메시지 → 100 trigger? **No** — 첫 메시지 trigger 후 `auto_draft != NULL` 이라 후속 skip. 안전.
- **Race condition**: 2 customer 메시지가 동시 도착해서 두 트리거 fire → 2 Claude 호출 후 두 update 가 동시 도착. `update ... where id = $1 AND auto_draft IS NULL` 로 race-safe. 두번째 update 는 no-op.
- **Stale draft**: customer 가 첫 메시지 후 "정정해서 보낼게요" 라며 추가 메시지 보내면 draft 가 첫 메시지 기준. operator 가 직접 ✨ 버튼으로 regenerate 또는 [닫기] 후 ✨. 명시적.
- **Background work 누락**: serverless 에서 `void promise` 는 GC 위험. 해결: Next 16 `after()` from `next/server` — Vercel fluid compute 가 response 반환 후 background 실행 보장. `after()` 사용 불가 시 `await` fallback (customer 3초 대기 — UX 약간 저하).
- **권한 leak**: customer 가 `auto_draft` 를 GET 으로 받으면 안 됨. find-or-create 응답에서 explicit filter — 5.6 참조. smoke 에서 customer 응답에 `auto_draft` 필드 없는지 추가 검증 권장 (assertion 13.5 — optional).
- **`CUSTOMER_AI_DRAFT_DISMISS` audit ENUM 미정의** → fallback (Phase 1/2 동일 패턴).
