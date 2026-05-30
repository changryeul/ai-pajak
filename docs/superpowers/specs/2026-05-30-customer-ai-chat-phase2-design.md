# Customer AI Chat Phase 2 — AI Draft Suggestion (MVP)

- **Date**: 2026-05-30
- **Status**: Design approved, ready for implementation

## 1. Context

Phase 1 (2026-05-29) shipped customer ↔ AI 상담원 persona-masked messenger. operator 가 응답 직접 작성. Phase 2 = operator 가 "AI 추천" 버튼 클릭 시 Claude 가 thread context 기반 답변 초안 생성 → operator 가 input 에 미리 채워진 draft 를 review/edit 후 send. **schema 변경 0**, on-demand only, 휘발성 (저장 X).

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | Persistence | **(a) Ephemeral** — 호출마다 생성, 저장 X. schema 0. |
| Q2 | Trigger | **(a) On-demand** — operator 가 버튼 클릭할 때만. 비용 통제. |

Auto-generate / persistence 는 v2.1 으로 별도.

## 3. Backend

### Endpoint: `POST /api/operator/customer-inbox/threads/[id]/ai-draft`

**미들웨어**:
```ts
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
)
```

**Handler 흐름**:
1. UUID validation on thread id (regex)
2. Fetch thread + customer (full_name, company_name) join
3. Fetch last 10 messages (created_at DESC, then reverse for chronological)
4. Build system prompt + user message for Claude
5. Call Anthropic SDK (`claude-sonnet-4-6`)
6. Return `{ data: { draft: string, model: string } }`
7. `recordAudit({action:'CUSTOMER_AI_DRAFT_REQUEST', details: {threadId}})`
8. Errors:
   - thread not found → 404
   - Anthropic call fails → 500 with generic message (log details via pino)
   - rate limit / cost guard via existing `checkRateLimit` (per-user 30/min like /api/chat)

**System prompt** (Indonesian + Korean mix, optimised for tax consulting context):

```
You are drafting a reply for an Indonesian tax consultant who is responding to a customer inquiry. The customer sees the consultant as "AI 상담원" (the platform's AI consultant persona) — they do not know a human is replying.

Customer context:
- Name: {customerName}
- Tax case: {contextKind} period {contextPeriod}

Recent conversation (oldest first):
{lastN messages with [customer]/[operator] prefix}

Draft a helpful reply in the customer's language. Rules:
- Concise (1-3 short paragraphs)
- Professional + actionable
- Specific menu paths if action needed (e.g., "/tax/pph21 페이지에서 직원 데이터를 업로드해주세요")
- If you need more info, ask specific questions
- Reply ONLY with the draft text — no preamble, no signature, no markdown formatting
```

`{lastN messages}` 는 마지막 10개. `[customer]` / `[operator]` prefix 로 role 표시 — Claude 가 누가 누구인지 알도록.

**Rate limit**: 기존 `checkRateLimit('chat', userId, 30/min)` 재활용 또는 `'ai-draft'` 별도 key.

**Model**: `claude-sonnet-4-6` (default per project standards). Haiku 도 검토 가능하지만 세무 응답 품질 차이 가능성 → sonnet 안전.

## 4. UI

**File**: `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx`

Send button 옆에 "AI 추천" 버튼 추가:

```tsx
// state 추가
const [drafting, setDrafting] = useState(false);

const generateDraft = async () => {
  if (!selectedId || drafting) return;
  setDrafting(true);
  try {
    const r = await fetch(`/api/operator/customer-inbox/threads/${selectedId}/ai-draft`, {
      method: 'POST',
    });
    if (r.ok) {
      const j = await r.json();
      setInput(j.data.draft);  // pre-fill input — operator can edit
    }
  } catch { /* silent */ }
  finally { setDrafting(false); }
};

// Button JSX (input bar 안에 send button 옆):
<button
  type="button"
  onClick={generateDraft}
  disabled={drafting || sending}
  className="rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 disabled:opacity-50"
  aria-label={t('aiDraftButton')}
  title={t('aiDraftButton')}
>
  {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
</button>
```

`Sparkles` 아이콘 (lucide-react) import 추가.

## 5. i18n (2 keys × 5 locale)

`operatorCustomerInbox.*` 추가:

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `aiDraftButton` | "AI 추천" | "AI Draft" | "Saran AI" | "AI 推奨" | "AI 推荐" |
| `aiDraftLoading` | "AI 답변 작성 중..." | "Drafting reply..." | "Membuat draft..." | "下書き作成中..." | "正在生成草稿..." |

`aiDraftLoading` 은 v1 에서 button 내 spinner 만 — 별도 표시 X. 키만 미리 정의 (향후 toast/inline message 용).

## 6. Smoke (extend existing `scripts/test-customer-ai-inbox.ts`)

기존 10 assertion 에 2 assertion 추가 (총 12):

**11.** OPERATOR POST ai-draft → 200, body `data.draft` string 비어있지 않음
**12.** CONSULTANT POST ai-draft → 403

```ts
// 11. OPERATOR AI draft
const r11 = await api(`/api/operator/customer-inbox/threads/${threadId}/ai-draft`, opTok, { method: 'POST' });
if (r11.status === 200 && typeof r11.body.data?.draft === 'string' && r11.body.data.draft.length > 0) {
  console.log(`✅ 11. OPERATOR AI draft → 200, length=${r11.body.data.draft.length}`); pass++;
} else {
  console.error(`✗ 11. AI draft:`, r11); fail++;
}

// 12. CONSULTANT AI draft → 403
const r12 = await api(`/api/operator/customer-inbox/threads/${threadId}/ai-draft`, consTok, { method: 'POST' });
if (r12.status === 403) {
  console.log(`✅ 12. CONSULTANT AI draft → 403`); pass++;
} else {
  console.error(`✗ 12. AI draft consultant:`, r12.status); fail++;
}
```

위치: assertion 9 (resolve) 이전에 — RESOLVED 상태 thread 에 draft 요청 시 동작 미정의라 회피.

## 7. Files

**신규**:
- `src/app/api/operator/customer-inbox/threads/[id]/ai-draft/route.ts` (endpoint)

**수정**:
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx` (button + state + handler + Sparkles import)
- `src/i18n/messages/{ko,en,id,ja,zh}.json` (2 keys × 5 locale)
- `scripts/test-customer-ai-inbox.ts` (2 assertions)

**마이그레이션 0**. server endpoint 5 → 6. UI 1 button 추가.

## 8. Out of scope (Phase 2.1+)

- **Persistence** — draft 를 DB 저장해서 operator 사이 공유 + 재 호출 절약
- **Auto-generate** — customer 메시지 도착 시 자동 background draft (cron 또는 webhook)
- **Draft history** — operator 가 여러 draft 비교
- **Inline suggestion UI** — input 위에 draft pill 로 표시 (current: input 에 바로 채움)
- **Template snippets** — 자주 쓰는 답변 미리 저장 (Phase 3)

## 9. Risks

- **Anthropic 비용**: operator 가 button 클릭마다 호출. 평균 thread 당 3-5 호출 추정 (draft → 수정 → 재draft). 10 operator × 50 thread × 5 호출 = 일 2500 호출. Sonnet 4.6 토큰 비용 추정 필요 — 일단 rate limit 30/min/operator 로 cap.
- **품질**: 초기 prompt 가 단순함. customer/operator 가 답변 품질 낮으면 prompt 정교화 (시간 들어가는 작업). MVP 출시 후 사용 데이터 기반 iterate.
- **Latency**: Claude 호출 ~3-5초. UI 에 spinner — operator 가 기다리는 동안 다른 thread 처리 가능 (현 UI 가 thread 전환 막지 않음).
- **Persona masking**: draft 가 customer 한테 절대 노출 X. endpoint 가 operator-tier 만 호출 가능. 보안 boundary 명확.
- **`CUSTOMER_AI_DRAFT_REQUEST` audit ENUM 미정의** → fallback `TAX_CALCULATION` (Phase 1 동일 패턴).
