# Customer AI Chat Phase 2.3 — auto-regenerate on burst + column deprecate

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2+Q3 = a+a+b)
- **Builds on**: Phase 2.2 (`e0ca8e3`) — persistence + history dropdown

## 1. Context

Phase 2.1 (`3d5971f`) 의 `auto_draft IS NULL` 조건이 customer message burst (예: 3개 빠르게) 시 첫 msg 만 trigger → stale draft. Phase 2.2 가 신규 `customer_ai_draft` 테이블 도입 — 이제 `auto_draft` 컬럼은 backward compat 만.

Phase 2.3 = burst 처리 (throttle 30s) + Phase 2.1 잔여 컬럼 정리.

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | burst trigger | **(a) throttle 30s** — 마지막 draft generated_at > 30s 이전이면 새 draft, 아니면 skip |
| Q2 | `auto_draft` 컬럼 | **(a) DROP** (마이그레이션 1) |
| Q3 | burst 시 이전 active draft | **(b) active 유지** — Phase 2.2 dropdown 이 history 노출 |

## 3. Schema 변경

신규 마이그레이션 `supabase/migrations/20260603000006_drop_auto_draft_column.sql`:

```sql
-- Phase 2.3: customer_ai_thread.auto_draft + auto_draft_at 컬럼 DROP.
-- 모든 draft 데이터는 Phase 2.2 (commit e0ca8e3) 의 customer_ai_draft
-- 테이블로 이전 완료. backward compat 가드 더 이상 불필요.
ALTER TABLE customer_ai_thread
  DROP COLUMN IF EXISTS auto_draft,
  DROP COLUMN IF EXISTS auto_draft_at;
```

마이그레이션 1 (단순 DROP, 2 컬럼).

## 4. Code 변경

### 4.1 customer messages POST (auto-trigger)
`src/app/api/customer-ai/threads/[id]/messages/route.ts` — Phase 2.1 의 `after()` block:

```ts
// 기존 (Phase 2.1):
const { data: threadRow } = await admin.from('customer_ai_thread').select('auto_draft').eq('id', threadId).maybeSingle();
if (threadRow && threadRow.auto_draft === null) {
  after(() => generateAndStoreDraft(threadId));
}

// 신규 (Phase 2.3): throttle 30s
const THROTTLE_MS = 30_000;
const { data: lastDraft } = await admin
  .from('customer_ai_draft')
  .select('generated_at')
  .eq('thread_id', threadId)
  .order('generated_at', { ascending: false })
  .limit(1)
  .maybeSingle();
const now = Date.now();
const lastMs = lastDraft ? new Date(lastDraft.generated_at).getTime() : 0;
if (now - lastMs >= THROTTLE_MS) {
  after(async () => {
    const result = await generateDraft(threadId);
    if (!result) return;
    await admin.from('customer_ai_draft').insert({
      thread_id: threadId,
      draft_text: result.draft,
      source: 'auto',
      status: 'active',
    });
    // No more auto_draft column update — Phase 2.2 가 INSERT 만으로 충분
  });
}
```

`generateAndStoreDraft` helper 도 같이 정리 — `customer_ai_thread.auto_draft` UPDATE 줄 제거.

### 4.2 Phase 2.1 DELETE `.../auto-draft`
`src/app/api/operator/customer-inbox/threads/[id]/auto-draft/route.ts` — Phase 2.2 가 status='dismissed' 만 update. 잔여 `UPDATE customer_ai_thread SET auto_draft = null` 줄 제거 (컬럼 없으니 에러):

```ts
// 기존
await admin.from('customer_ai_thread').update({ auto_draft: null, auto_draft_at: null })...

// 신규: 제거. status update 만 유지.
await admin.from('customer_ai_draft')
  .update({ status: 'dismissed' })
  .eq('thread_id', threadId)
  .eq('status', 'active');
```

### 4.3 operator thread list `/api/operator/customer-inbox/threads`
select 에서 `auto_draft`, `auto_draft_at` 컬럼 제거. 또는 select(*) 면 자동.

### 4.4 customer find-or-create `/api/customer-ai/threads/find-or-create`
응답 strip 에서 `auto_draft` 제거 (이미 strip 했지만 컬럼 없으니 무관). 코드 정리.

### 4.5 UI — `CustomerInboxClient.tsx`
Phase 2.2 가 이미 drafts state 만 사용. thread row 의 auto_draft 참조 없으면 변경 0.

## 5. Drift audit 영향

`scripts/verify-prod-schema-drift.ts` 가 모든 마이그레이션의 `ADD COLUMN` 을 parse → expected set. Phase 2.3 의 DROP 후 `auto_draft` 가 expected 에 남지만 prod 에 없음 → false drift = 2.

해결:
- **(a) Drift script 가 `ALTER TABLE ... DROP COLUMN` 도 parse 해서 expected set 에서 제거** ← **추천**, future-proof
- (b) hardcode exception list
- (c) Audit script 무시 (acceptable)

`(a)` 가 깔끔. script 의 parseMigration 에 `DROP COLUMN` 매칭 추가.

## 6. Smoke 영향

`scripts/test-customer-ai-inbox.ts` 의 assertion 11 (Phase 2.1 trigger 검증):
- 두 번째 customer msg → 자동 draft 생성 → 8s 대기 후 thread 의 auto_draft 확인

문제: 
- `auto_draft` 컬럼 없으니 assertion 11 깨짐
- throttle 30s — 첫 customer msg (assertion 2) 후 5s 안에 두 번째 msg 도착하면 throttle 발동, 새 draft 안 생김

수정:
- assertion 11 의 검증 대상을 `customer_ai_thread.auto_draft` → `customer_ai_draft` 테이블 가장 최근 row 로 변경
- throttle 우회: admin client 로 첫 draft 의 generated_at 을 1분 전으로 update → 두번째 msg → throttle 통과

```ts
// 신규 throttle-aware
await sbAdmin.from('customer_ai_draft')
  .update({ generated_at: new Date(Date.now() - 60_000).toISOString() })
  .eq('thread_id', threadId);
// 그 후 두번째 customer msg → 새 draft 생성됨
```

## 7. Files

**신규** (1):
- `supabase/migrations/20260603000006_drop_auto_draft_column.sql`

**수정** (5):
- `src/app/api/customer-ai/threads/[id]/messages/route.ts` — throttle + auto_draft UPDATE 제거
- `src/app/api/operator/customer-inbox/threads/[id]/auto-draft/route.ts` — UPDATE 줄 제거
- `src/app/api/operator/customer-inbox/threads/route.ts` — select 에서 컬럼 제거 (있으면)
- `src/app/api/customer-ai/threads/find-or-create/route.ts` — strip 코드 정리
- `scripts/verify-prod-schema-drift.ts` — DROP COLUMN parse 추가
- `scripts/test-customer-ai-inbox.ts` — assertion 11 throttle-aware + customer_ai_draft 검증으로 변경

**마이그레이션**: 1 (DROP 2 컬럼)

## 8. Out of scope (Phase 2.4+)
- `generated_at` 보다 정밀한 burst signal (예: customer activity pattern)
- Operator-level draft (operator 끼리 안 공유)
- Template snippets
- Inline streaming display
- Draft auto-cleanup (1개월 후 dismissed → delete)

## 9. Risks

- **throttle 30s 가 너무 길/짧**: 사용자 워크플로우 따라 조정 가능 (config 또는 env). v1 = 30s hardcode.
- **drift script 가 DROP COLUMN parse 실수**: 신규 logic 한 번에 적용 — script test 필요. 단순 regex (`/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["\`]?(\w+)["\`]?/gi`) 면 OK.
- **마이그레이션 DROP 실패** (RLS / view dependency): `auto_draft` 컬럼이 view / function 에 참조되면 DROP 실패. grep 으로 확인 후 진행. 현재 spec 작성 시 참조 없음 (Phase 2.2 가 컬럼 사용 안 함).
- **legacy row 의 auto_draft 데이터 손실**: Phase 2.2 이전 row 의 auto_draft 가 있다면 영구 손실. 운영 데이터는 dev/staging 만 → 안전. 메모 `feedback_local_testing_only.md` 의 "prod = staging" 정책으로 backfill 불필요.
