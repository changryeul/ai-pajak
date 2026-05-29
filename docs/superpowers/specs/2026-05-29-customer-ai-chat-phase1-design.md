# Customer ↔ AI 상담원 Chat (Phase 1 MVP)

- **Date**: 2026-05-29
- **Mockup**: KakaoTalk_Photo_2026-05-28-15-26-23 (방향성 reference, 자유 변형 가능)
- **Status**: Design approved, ready for implementation plan

## 1. Context

현재 `/dashboard` layout 에 minimal FAB 챗봇 (`TaxChatbot.tsx`) 이 있으나:
- session-local (sessionStorage) — 새로고침 시 사라짐 가능
- pure AI Q&A (Anthropic Claude 자동 응답) — 사람 개입 X
- 모든 role 에 보임 (CUSTOMER + CONSULTANT + OPERATOR + ADMIN)
- 어떤 tax case 와도 연결 X

User 가 원하는 모델 (mockup + 보충 설명):
- **Concierge** — 고객 view 는 항상 "AI 상담원" 페르소나, 실제로는 operator (백오피스 직원) 가 응답
- **AI 는 draft 생성 역할** (Phase 2 에서 추가) — 복잡한 세무 판단은 사람이 확인 후 전송
- **모든 대화는 세무 case 와 연결** — 현재 페이지/업무 context 기준 자동 thread 생성
- 백오피스에서 동일 threadId — operator 가 실제 내부 ID 보고, 고객은 페르소나만

Phase 1 (이 spec) = messenger plumbing + persona masking 기반. AI draft / 파일 첨부 / 빠른 문구 / 문의 유형 dropdown 은 Phase 2/3 별도 트랙.

## 2. Decisions (confirmed)

| # | 결정 | 선택 |
|---|---|---|
| Q1 | Mockup 충실도 | 방향성 — 자유 변형 (MVP 는 단순화) |
| Q2 | 응답 주체 | **humans-first + persona masking** (operator 가 실제 응답, 고객 view 항상 "AI 상담원") |
| Q3 | Thread 생성 trigger | **현재 페이지/업무 context 자동** (예: /tax/pph21 진입 → "PPh21 + 현재 month" thread) |
| Q4 | AI 의 역할 | **상담원 답변 초안 작성** — Phase 2 (이 spec scope 외). Phase 1 은 plumbing 만. |

## 3. Schema

마이그레이션 `20260529000001_customer_ai_thread.sql`:

### 3.1 `customer_ai_thread`

```sql
CREATE TABLE customer_ai_thread (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  customer_user_id            UUID NOT NULL REFERENCES auth.users(id),
  context_kind                TEXT NOT NULL,        -- 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER'
  context_period              TEXT NOT NULL,        -- 'YYYY-MM' (or 'OTHER' for kind=OTHER)
  status                      TEXT NOT NULL DEFAULT 'AWAITING_OPERATOR',  -- AWAITING_OPERATOR / RESPONDED / RESOLVED
  customer_unread_count       INTEGER NOT NULL DEFAULT 0,
  operator_unread_count       INTEGER NOT NULL DEFAULT 0,
  last_customer_message_at    TIMESTAMPTZ,
  last_operator_message_at    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, context_kind, context_period)
);

CREATE INDEX customer_ai_thread_customer_idx ON customer_ai_thread(customer_id);
CREATE INDEX customer_ai_thread_operator_unread_idx ON customer_ai_thread(operator_unread_count) WHERE operator_unread_count > 0;
```

### 3.2 `customer_ai_message`

```sql
CREATE TABLE customer_ai_message (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           UUID NOT NULL REFERENCES customer_ai_thread(id) ON DELETE CASCADE,
  sender_role         TEXT NOT NULL,   -- 'customer' | 'operator'
  sender_user_id      UUID REFERENCES auth.users(id),
  content             TEXT NOT NULL,
  customer_read_at    TIMESTAMPTZ,
  operator_read_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_ai_message_thread_idx ON customer_ai_message(thread_id, created_at);
```

### 3.3 RLS

```sql
ALTER TABLE customer_ai_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ai_message ENABLE ROW LEVEL SECURITY;

-- Customer: own threads only (own customer_user_id)
CREATE POLICY customer_ai_thread_customer_select ON customer_ai_thread
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY customer_ai_thread_customer_insert ON customer_ai_thread
  FOR INSERT TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

-- Operator-tier: read + update (status, unread counts) all threads
CREATE POLICY customer_ai_thread_operator_all ON customer_ai_thread
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
            AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
            AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
            AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
            AND is_active = true)
  );

-- Messages: customer can read/insert own thread messages
CREATE POLICY customer_ai_message_customer_select ON customer_ai_message
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customer_ai_thread t
            WHERE t.id = thread_id AND t.customer_user_id = auth.uid())
  );

CREATE POLICY customer_ai_message_customer_insert ON customer_ai_message
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'customer'
    AND EXISTS (SELECT 1 FROM customer_ai_thread t
                WHERE t.id = thread_id AND t.customer_user_id = auth.uid())
  );

-- Operator-tier: full message access
CREATE POLICY customer_ai_message_operator_all ON customer_ai_message
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
            AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
            AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
            AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
            AND is_active = true)
  );
```

PLATFORM_ADMIN 차단은 `blockPlatformAdmin` middleware 가 API layer 에서 처리 (RLS 위에).

## 4. API

### 4.1 Customer side — `/api/customer-ai/`

**`POST /api/customer-ai/threads/find-or-create`**
- Body: `{ contextKind: 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER', contextPeriod: string }`
- Middleware: `composeMiddleware(requireAuth, blockPlatformAdmin, requireRole(CUSTOMER))`
- 동일 (customer_user_id, kind, period) thread 있으면 그 행 return, 없으면 신규 INSERT (status='AWAITING_OPERATOR', unread=0/0)
- 응답: `{ data: ThreadDTO }`

**`GET /api/customer-ai/threads/[id]/messages`**
- 미들웨어: `requireAuth + blockPlatformAdmin` (RLS 가 own-thread 만 허용)
- thread 의 메시지 (created_at ASC) 반환. operator 메시지의 `displaySender = 'AI 상담원'` (서버에서 강제), customer 메시지는 본인 이름/email.
- 부수 효과: 이 호출이 operator 메시지의 `customer_read_at` 을 now() 로 set, thread 의 `customer_unread_count` = 0 으로 reset.
- 응답: `{ data: { thread: ThreadDTO, messages: MessageDTO[] } }`

**`POST /api/customer-ai/threads/[id]/messages`**
- Body: `{ content: string }` (Zod min(1).max(2000))
- 미들웨어: 위와 동일 + RLS 가 own-thread sender_role='customer' insert 만 허용
- `sender_role='customer'`, `sender_user_id=session.userId`, `content` insert
- 부수 효과: thread `last_customer_message_at=now()`, `operator_unread_count += 1`, `status='AWAITING_OPERATOR'`
- 응답: `{ data: MessageDTO }`

### 4.2 Operator side — `/api/operator/customer-inbox/`

**`GET /api/operator/customer-inbox/threads`**
- 미들웨어: `requireAuth + blockPlatformAdmin + requireRole(OPERATOR, LEAD, SUPERVISOR, MASTER)`
- 모든 customer thread 반환. ORDER BY `operator_unread_count DESC, last_customer_message_at DESC NULLS LAST` (응답 대기 thread 가 위로)
- customer 정보 join (full_name, company_name)
- 응답: `{ data: ThreadWithCustomerDTO[] }`

**`GET /api/operator/customer-inbox/threads/[id]/messages`**
- 미들웨어: 위와 동일
- 메시지 (created_at ASC) 반환. `displaySender` = operator 메시지는 실제 sender email, customer 메시지는 customer email
- 부수 효과: customer 메시지의 `operator_read_at=now()`, thread `operator_unread_count=0`
- 응답: `{ data: { thread: ThreadWithCustomerDTO, messages: MessageDTO[] } }`

**`POST /api/operator/customer-inbox/threads/[id]/messages`**
- Body: `{ content: string }` (Zod)
- 미들웨어: 위와 동일
- `sender_role='operator'`, `sender_user_id=session.userId`, `content` insert
- 부수 효과: `last_operator_message_at=now()`, `customer_unread_count += 1`, `status='RESPONDED'`
- 응답: `{ data: MessageDTO }`

**`POST /api/operator/customer-inbox/threads/[id]/resolve`**
- 미들웨어: 위와 동일
- thread `status='RESOLVED'` set
- 응답: `{ data: ThreadDTO }`

### 4.3 DTO 정의

```ts
interface ThreadDTO {
  id: string;
  contextKind: string;
  contextPeriod: string;
  status: 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
  customerUnreadCount: number;
  operatorUnreadCount: number;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  createdAt: string;
  /** Human-readable label: "MSG-{cust8}-{period}-{kind}" — UI display only */
  displayLabel: string;
}

interface ThreadWithCustomerDTO extends ThreadDTO {
  customerId: string;
  customerName: string;          // full_name OR company_name
}

interface MessageDTO {
  id: string;
  senderRole: 'customer' | 'operator';
  /** Customer 호출 시 'AI 상담원' (operator role) OR own name. Operator 호출 시 real sender email. */
  displaySender: string;
  content: string;
  createdAt: string;
  /** Used for unread indicator computation client-side. */
  customerReadAt: string | null;
  operatorReadAt: string | null;
}
```

### 4.4 Persona masking 구현

서버 강제. customer-side endpoint 의 mapping 함수:

```ts
function mapMessageForCustomer(m, currentCustomerName): MessageDTO {
  return {
    ...
    displaySender: m.sender_role === 'operator' ? 'AI 상담원' : currentCustomerName,
  };
}
```

operator-side endpoint 의 mapping 함수:

```ts
function mapMessageForOperator(m, senderEmailById): MessageDTO {
  return {
    ...
    displaySender: m.sender_role === 'operator'
      ? (senderEmailById[m.sender_user_id] ?? '내부 담당자')
      : (customerName),
  };
}
```

customer 가 절대로 real operator name 못 봄 — 서버에서 차단.

## 5. UI

### 5.1 Customer FAB — `src/components/chat/CustomerAiChat.tsx` (신규)

기존 `TaxChatbot.tsx` 를 대체. ChatbotWrapper 가 role 분기:

```tsx
// ChatbotWrapper.tsx 변경
if (role === 'CUSTOMER') return <CustomerAiChat />;
return <TaxChatbot />;  // 다른 role 은 기존 public AI Q&A 그대로
```

`CustomerAiChat` 의 동작:
1. mount 시 현재 URL → context 추출 (`/lib/customer-ai/context.ts` helper):
   - `/tax/pph21*` → `{kind: 'PPH21', period: 'YYYY-MM'}`
   - `/tax/pph23*` → `{kind: 'PPH23', period: ...}`
   - `/tax/ppn*` → `{kind: 'PPN', period: ...}`
   - `/tax/annual/*` → `{kind: 'CLOSING', period: ...}`
   - 그 외 → `{kind: 'OTHER', period: 'OTHER'}`
2. FAB 클릭 시 `POST find-or-create` → thread 확보
3. `GET messages` → 메시지 리스트 + `customerUnreadCount=0` reset
4. unread badge = `customerUnreadCount`. mount 시 (panel 안 열린 상태) `GET threads` 로 카운트 fetch — proactive sum 표시
5. 메시지 보내기 → `POST messages` + 로컬 append + status='AWAITING_OPERATOR'
6. Status badge: 헤더에 "AI 상담원 응답 대기" / "응답 도착 (N)" / "해결됨"
7. "현재 연결된 업무" 표시: `{contextKind} · {contextPeriod}` (간단 버전)
8. polling: panel 열려있는 동안 5초마다 `GET messages` (단순 polling. websocket/SSE 는 Phase 3)

### 5.2 Operator inbox — `/operator/customer-inbox/page.tsx` (신규)

3-pane layout (Track 의 supervisor approval detail 과 동일 패턴):
- 좌측 (240px): thread 리스트. `operator_unread_count > 0` 인 thread 상단에 emerald dot + 카운트 badge. customer 이름 / context label / last msg time.
- 중앙 (1fr): 선택된 thread 의 메시지 (스크롤). 좌측은 customer, 우측은 operator (자기 자신 / 다른 operator). 자기 자신 메시지는 emerald, 다른 operator 는 slate, customer 는 blue.
- 우측 (320px): customer info 카드 + thread metadata + "해결됨으로 표시" 버튼

입력: 하단 textarea + "전송" 버튼. 보내면 `POST messages`, status 자동 'RESPONDED'.

Sidebar 추가 (operator 섹션, 다른 메뉴 아래):
```tsx
{ href: '/operator/customer-inbox', icon: MessageCircle, labelKey: 'nav.customerInbox' },
```

### 5.3 Context detection helper

`src/lib/customer-ai/context.ts`:

```ts
export interface ChatContext {
  kind: 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER';
  period: string;  // 'YYYY-MM' or 'OTHER'
  /** Human-readable label for UI ("현재 연결된 업무"). */
  label: string;
}

export function detectContext(pathname: string, now = new Date()): ChatContext {
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (/^\/[a-z]{2}\/tax\/pph21/.test(pathname)) return { kind: 'PPH21', period, label: `PPh21 · ${period}` };
  if (/^\/[a-z]{2}\/tax\/pph23/.test(pathname)) return { kind: 'PPH23', period, label: `PPh23 · ${period}` };
  if (/^\/[a-z]{2}\/tax\/ppn/.test(pathname)) return { kind: 'PPN', period, label: `PPN · ${period}` };
  if (/^\/[a-z]{2}\/tax\/annual/.test(pathname)) return { kind: 'CLOSING', period, label: `결산 · ${period}` };
  return { kind: 'OTHER', period: 'OTHER', label: '일반 문의' };
}
```

### 5.4 displayLabel 생성

`MSG-{cust8}-{period}-{kind}` — 예: `MSG-PTABCXYZ-202512-PPH21`. customer id 의 앞 8자 (or company_name 의 약자) + period (no dash) + kind. UI 표시용, DB 저장 X.

## 6. i18n (2 namespace × 5 locale)

### `customerAiChat`:
- `title`: "AI 상담원" / "AI Consultant" / "Konsultan AI" / "AIコンサルタント" / "AI 顾问"
- `subtitle`: "자료 요청, 신고 진행 상황, 문의를 안내합니다"
- `statusAwaiting`: "AI 상담원 응답 대기"
- `statusResponded`: "응답 도착"
- `statusResolved`: "해결됨"
- `linkedTask`: "현재 연결된 업무"
- `inputPlaceholder`: "메시지를 입력하세요..."
- `send`: "전송"
- `emptyState`: "AI 상담원에게 첫 메시지를 보내보세요"
- `loading`: "불러오는 중..."
- `errorSend`: "전송 실패. 다시 시도해주세요."

### `operatorCustomerInbox`:
- `title`: "고객 상담"
- `subtitle`: "고객 view 에는 항상 'AI 상담원' 으로 표시됩니다"
- `threadListEmpty`: "고객 상담 요청이 없습니다"
- `selectThreadHint`: "왼쪽에서 thread 를 선택하세요"
- `customerInfoHeader`: "고객 정보"
- `metadataHeader`: "thread 정보"
- `replyPlaceholder`: "AI 상담원 페르소나로 답변..."
- `send`: "전송"
- `markResolved`: "해결됨으로 표시"
- `unreadBadge`: "{count} 안 읽음"

5 locale 모두 (ko/en/id/ja/zh) 동일 키.

Sidebar 키: `nav.customerInbox`: "고객 상담" / "Customer Inbox" / "Kotak Pelanggan" / "顧客対応" / "客户咨询"

## 7. 회귀 — `scripts/test-customer-ai-inbox.ts` (신규)

E2E 시나리오:
1. CUSTOMER (company.test) 로그인 → `POST find-or-create` (kind=PPH21, period=현재월) → thread 행 생성 확인
2. CUSTOMER → `POST messages` "테스트 메시지 1" → `operator_unread_count=1`, status='AWAITING_OPERATOR' 확인
3. OPERATOR (operator.test) 로그인 → `GET threads` → 위 thread 가 리스트 첫 행 (unread highest), customer 이름 join 확인
4. OPERATOR → `GET messages` → "테스트 메시지 1" 보임 + sender_role='customer' + displaySender=customer email. 부수 효과: `operator_unread_count=0`
5. OPERATOR → `POST messages` "AI 상담원이 곧 답변드립니다" → `customer_unread_count=1`, status='RESPONDED'
6. CUSTOMER → `GET messages` → 2개 메시지. operator 메시지의 **displaySender='AI 상담원'** (real operator name 절대 노출 X) → persona masking 검증. 부수 효과: `customer_unread_count=0`
7. CONSULTANT_JTC → `POST find-or-create` → 403 (RBAC)
8. PLATFORM_ADMIN → `GET threads` → 403 (blockPlatformAdmin)
9. CUSTOMER 가 다른 customer 의 thread 접근 시도 (잘못된 thread_id) → RLS 차단 (404 또는 empty)
10. OPERATOR → `POST resolve` → status='RESOLVED'
11. cleanup — thread + messages 삭제 (CASCADE 로 한 번에)

총 ~10 assertion. smoke runner 에 새 step 등록 (14 → 15).

## 8. Files

**신규**:
- `supabase/migrations/20260529000001_customer_ai_thread.sql`
- `src/types/customer-ai.ts` — DTO + ChatContext types
- `src/lib/customer-ai/context.ts` — detectContext helper
- `src/lib/customer-ai/persona.ts` — mapMessageForCustomer / mapMessageForOperator helpers
- `src/app/api/customer-ai/threads/find-or-create/route.ts`
- `src/app/api/customer-ai/threads/[id]/messages/route.ts`
- `src/app/api/operator/customer-inbox/threads/route.ts`
- `src/app/api/operator/customer-inbox/threads/[id]/messages/route.ts`
- `src/app/api/operator/customer-inbox/threads/[id]/resolve/route.ts`
- `src/components/chat/CustomerAiChat.tsx`
- `src/app/[locale]/(dashboard)/operator/customer-inbox/page.tsx`
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/InboxThreadList.tsx`
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/InboxThreadDetail.tsx`
- `scripts/test-customer-ai-inbox.ts`

**수정**:
- `src/components/chat/ChatbotWrapper.tsx` — role 분기 (CUSTOMER → CustomerAiChat / else → TaxChatbot)
- `src/components/layout/sidebar.tsx` — operator 섹션에 'customer-inbox' 링크
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 2 namespace + nav 키
- `scripts/test-smoke-all.ts` — 새 step
- `package.json` — `test:customer-ai-inbox` script

신규 마이그레이션: **1개**.

## 9. Out of scope (Phase 2/3)

- **AI draft suggestion** (Phase 2) — Anthropic Claude 가 operator 한테 답변 초안 제공. customer 메시지 도착 시 자동 trigger 또는 operator UI 의 "AI 추천" 버튼.
- **파일 첨부** (Phase 3) — supabase storage bucket + signed URL.
- **빠른 문구 (template library)** (Phase 3) — operator 가 자주 쓰는 답변 미리 저장.
- **문의 유형 dropdown** (Phase 3) — 현재는 contextKind 가 자동 분류, dropdown 으로 명시적 선택은 v3.
- **알림** (Phase 3) — 이메일 / push 알림.
- **Websocket / SSE 실시간** (Phase 3) — 현재 polling 5초.
- **다중 thread 한 화면** — 현재 화면당 1 thread (현재 페이지 context), 전체 thread 리스트는 v2.

## 10. Risks / open questions

- **Polling 5초 — 부하**: 100 customer × 5초 = 분당 1200 req. supabase free tier 한계. customer 가 chat panel 안 닫고 화면 두면 누적. 대응: panel 안 보이는 동안 (visibilitychange='hidden') polling 중단. v2 에서 websocket 검토.
- **Unread count race**: customer 가 `GET messages` (reset) 와 operator 가 `POST` (increment) 가 동시 도착 시 count 0 인데 unread 있음 상태 가능. v1 은 허용 — 5초 polling 후 정정. v2 에서 server-side atomic counter.
- **`displaySender` 가 client 에 노출되는지 검증**: customer endpoint 는 operator real email 절대 반환 안함. operator endpoint 만 노출. 회귀 (test #6) 가 핵심 검증.
- **Thread 무한 생성**: customer 가 매 페이지 마다 thread 자동 생성 → 운영 부담. 대응: `find-or-create` 가 (customer, kind, period) UNIQUE 제약으로 중복 방지. 같은 페이지에 다시 들어와도 동일 thread.
- **`OTHER` kind thread**: dashboard / non-tax 페이지에서 챗 열면 `kind='OTHER', period='OTHER'` 단일 thread 사용 — customer 당 1개로 통일.
- **`/dashboard` layout 아닌 페이지**: ChatbotWrapper 가 `(dashboard)` layout 에만 mount → /login / / 등 public 페이지는 chat 안 보임. 의도된 동작.
- **Mobile UX**: FAB + panel 이 mobile 에서 full-screen modal 로 (현 TaxChatbot 의 isExpanded 패턴 재활용).
- **AI 상담원 페르소나 어색함**: 고객이 "AI 인줄 알았는데 답이 너무 사람같다" 또는 반대 — operator 가 명시적으로 AI 흉내내야 하나 자연스러운 답 해야 하나. 답: 자연스러운 답. user 도 시간이 지나면 인지하게 됨 — 마치 chatbot 이 사람 운영자 + AI 의 hybrid 인 것처럼.
- **Migration ordering**: `20260529000001` 가 이번 첫 마이그레이션. 2026-05-27 의 `20260527000004_rls_with_check.sql` 다음.
- **CUSTOMER role 필터**: ChatbotWrapper 는 role 을 어떻게 알지? 현 `src/components/chat/ChatbotWrapper.tsx` 는 'use client' + dynamic import. role 은 server fetch 가 필요 — 다음 옵션:
  - (a) ChatbotWrapper 를 server component 로 전환 + dynamic import 안에서 role 받아 자식 client 컴포넌트로 분기
  - (b) dashboard layout 이 role 을 props 로 전달
  - (c) client 컴포넌트가 자체적으로 `/api/auth/me` 같은 endpoint 호출해 role 확인 후 분기 렌더
  - 추천: (b) — layout 이 이미 server side 라 role resolve 후 props 만 더 넘기면 됨. ChatbotWrapper 가 `role` prop 받아 분기.

## 11. Why / 비즈니스 가치

- **"AI 와 대화하는 느낌"**: 고객 입장에서 24/7 즉시 답변 받는 듯한 perceived value. 실제로는 영업시간 내 operator 가 응답.
- **"고객 관계 unbundling 방지"**: customer 가 operator 개인을 알면 그 operator 가 회사 떠날 때 customer 도 따라 떠남. AI 페르소나 면 customer 는 "AI Pajak 의 AI 상담원" 과 관계 — 회사가 owner.
- **세무 case 와 자동 연결**: customer 가 "PPh21 관련해서요..." 라고 매번 안 써도 자동으로 thread 가 해당 case 에 연결. operator 가 화면에서 context 즉시 파악.
- **AI draft (Phase 2)**: operator 생산성 ×2~3 — 매번 처음부터 타이핑 안하고 AI 초안 검토/수정만.
