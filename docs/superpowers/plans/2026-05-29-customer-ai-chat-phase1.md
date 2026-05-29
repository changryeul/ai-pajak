# Customer ↔ AI 상담원 Chat Phase 1 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customer 가 `(dashboard)` 어디서나 FAB 챗 열면 현 페이지 context (PPh21/PPh23/PPN/Closing) 기준 thread 자동 생성/연결. Operator 가 백오피스 inbox 에서 응답 → customer view 에 "AI 상담원" 페르소나로 표시. AI draft 는 Phase 2.

**Architecture:** 신규 2 테이블 (`customer_ai_thread` + `customer_ai_message`) + RLS (customer own + operator-tier all) + 5 endpoint + 신규 client (`CustomerAiChat`) + 신규 operator 3-pane inbox + 5 locale i18n. Polling 5초 (panel visible 한정).

**Spec reference:** `docs/superpowers/specs/2026-05-29-customer-ai-chat-phase1-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/20260529000001_customer_ai_thread.sql`
- `src/types/customer-ai.ts`
- `src/lib/customer-ai/context.ts`
- `src/lib/customer-ai/persona.ts`
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

**Modified:**
- `src/components/chat/ChatbotWrapper.tsx` — role 분기
- `src/app/[locale]/(dashboard)/layout.tsx` — role resolve + ChatbotWrapper 에 prop 전달
- `src/components/layout/sidebar.tsx` — operator 섹션 'customer-inbox' 링크
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — `customerAiChat` + `operatorCustomerInbox` namespaces + `nav.customerInbox`
- `scripts/test-smoke-all.ts` — 새 step
- `package.json` — script
- `CLAUDE.md` — smoke line + Phase 1 reference

신규 마이그레이션: **1**.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/20260529000001_customer_ai_thread.sql`

- [ ] **1.1: Write migration**

```sql
-- Customer ↔ AI 상담원 messenger Phase 1 MVP.
-- - customer_ai_thread: 1 row per (customer × tax case context)
-- - customer_ai_message: messages in a thread, customer or operator sender
-- Customer view always shows operator messages as "AI 상담원" (persona
-- masking enforced at API layer, not DB).

CREATE TABLE customer_ai_thread (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  customer_user_id            UUID NOT NULL REFERENCES auth.users(id),
  context_kind                TEXT NOT NULL,
  context_period              TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'AWAITING_OPERATOR',
  customer_unread_count       INTEGER NOT NULL DEFAULT 0,
  operator_unread_count       INTEGER NOT NULL DEFAULT 0,
  last_customer_message_at    TIMESTAMPTZ,
  last_operator_message_at    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, context_kind, context_period)
);

CREATE INDEX customer_ai_thread_customer_idx ON customer_ai_thread(customer_id);
CREATE INDEX customer_ai_thread_operator_unread_idx
  ON customer_ai_thread(operator_unread_count)
  WHERE operator_unread_count > 0;

COMMENT ON TABLE customer_ai_thread IS
  'Customer ↔ AI 상담원 thread (Phase 1 MVP). 1 row per (customer × context_kind × period). Operator messages persona-masked to "AI 상담원" on customer endpoints.';

CREATE TABLE customer_ai_message (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           UUID NOT NULL REFERENCES customer_ai_thread(id) ON DELETE CASCADE,
  sender_role         TEXT NOT NULL,
  sender_user_id      UUID REFERENCES auth.users(id),
  content             TEXT NOT NULL,
  customer_read_at    TIMESTAMPTZ,
  operator_read_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_ai_message_thread_idx ON customer_ai_message(thread_id, created_at);

COMMENT ON TABLE customer_ai_message IS
  'Messages in customer_ai_thread. sender_role = customer | operator. customer endpoint always returns operator messages as "AI 상담원" (persona masking).';

-- ── RLS ──
ALTER TABLE customer_ai_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ai_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_ai_thread_customer_select ON customer_ai_thread
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY customer_ai_thread_customer_insert ON customer_ai_thread
  FOR INSERT TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

CREATE POLICY customer_ai_thread_operator_all ON customer_ai_thread
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  );

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

CREATE POLICY customer_ai_message_operator_all ON customer_ai_message
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  );
```

- [ ] **1.2: Apply to prod**

```bash
supabase db push --include-all --linked
```
Expected: 2 CREATE TABLE + 2 INDEX + 2 COMMENT + 2 ALTER + 6 CREATE POLICY succeed.

- [ ] **1.3: Verify prod**

```bash
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local', quiet: true });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
c.from('customer_ai_thread').select('*').limit(1).then(r => console.log('thread table:', r.error?.message || 'OK (' + (r.data?.length ?? 0) + ' rows)'));
c.from('customer_ai_message').select('*').limit(1).then(r => console.log('message table:', r.error?.message || 'OK (' + (r.data?.length ?? 0) + ' rows)'));
"
```
Expected: both 'OK (0 rows)'.

- [ ] **1.4: Commit**

```bash
git add supabase/migrations/20260529000001_customer_ai_thread.sql
git commit -m "$(cat <<'EOF'
feat(customer-ai): schema + RLS for customer↔AI 상담원 chat (Phase 1 1/N)

신규 2 테이블:
  - customer_ai_thread (1 row per customer × context_kind × period,
    UNIQUE constraint 가 find-or-create 보장)
  - customer_ai_message (sender_role, sender_user_id, content,
    customer_read_at/operator_read_at)

RLS:
  - customer: 본인 thread / 본인 thread 의 message read+insert
  - operator-tier (OPERATOR/LEAD/SUPERVISOR/MASTER): 모든 thread/message
    read+write (RLS USING + WITH CHECK 양쪽)
  - PLATFORM_ADMIN 차단은 API middleware (blockPlatformAdmin)
  - persona masking 은 API layer (서버가 customer endpoint 응답에서
    operator 메시지의 displaySender 를 "AI 상담원" 으로 강제)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types + helpers

**Files:** Create `src/types/customer-ai.ts`, `src/lib/customer-ai/context.ts`, `src/lib/customer-ai/persona.ts`

- [ ] **2.1: types**

`src/types/customer-ai.ts`:

```ts
export type ContextKind = 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER';
export type ThreadStatus = 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
export type SenderRole = 'customer' | 'operator';

export interface ChatContext {
  kind: ContextKind;
  period: string;  // 'YYYY-MM' or 'OTHER'
  label: string;   // UI display
}

export interface ThreadDTO {
  id: string;
  contextKind: ContextKind;
  contextPeriod: string;
  status: ThreadStatus;
  customerUnreadCount: number;
  operatorUnreadCount: number;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  createdAt: string;
  displayLabel: string;  // e.g. 'MSG-PTABCXYZ-202512-PPH21'
}

export interface ThreadWithCustomerDTO extends ThreadDTO {
  customerId: string;
  customerName: string;
}

export interface MessageDTO {
  id: string;
  senderRole: SenderRole;
  displaySender: string;  // Customer view: 'AI 상담원' for operator. Operator view: real sender email.
  content: string;
  createdAt: string;
  customerReadAt: string | null;
  operatorReadAt: string | null;
}
```

- [ ] **2.2: Context helper**

`src/lib/customer-ai/context.ts`:

```ts
import type { ChatContext, ContextKind } from '@/types/customer-ai';

/**
 * Map current pathname → ChatContext (kind + period + UI label).
 *
 * Used by CustomerAiChat to derive which thread to find-or-create when
 * the customer opens the FAB on a given tax page. Falls back to OTHER
 * for non-tax pages so non-tax inquiries route to a single shared thread.
 */
export function detectContext(pathname: string, now: Date = new Date()): ChatContext {
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rules: Array<{ re: RegExp; kind: ContextKind; label: (period: string) => string }> = [
    { re: /^\/[a-z]{2}\/tax\/pph21/, kind: 'PPH21', label: (p) => `PPh21 · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/pph23/, kind: 'PPH23', label: (p) => `PPh23 · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/ppn/,   kind: 'PPN',   label: (p) => `PPN · ${p}` },
    { re: /^\/[a-z]{2}\/tax\/annual/, kind: 'CLOSING', label: (p) => `결산 · ${p}` },
  ];

  for (const r of rules) {
    if (r.re.test(pathname)) {
      return { kind: r.kind, period, label: r.label(period) };
    }
  }
  return { kind: 'OTHER', period: 'OTHER', label: '일반 문의' };
}

/** Human-readable thread label for UI display (NOT stored in DB). */
export function buildDisplayLabel(customerId: string, contextKind: ContextKind, contextPeriod: string): string {
  const custTag = customerId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const periodTag = contextPeriod.replace(/-/g, '');
  return `MSG-${custTag}-${periodTag}-${contextKind}`;
}
```

- [ ] **2.3: Persona helper**

`src/lib/customer-ai/persona.ts`:

```ts
import type { MessageDTO } from '@/types/customer-ai';

interface RawMessage {
  id: string;
  thread_id: string;
  sender_role: 'customer' | 'operator';
  sender_user_id: string | null;
  content: string;
  customer_read_at: string | null;
  operator_read_at: string | null;
  created_at: string;
}

/**
 * Customer view: operator sender always shown as "AI 상담원" — real
 * operator identity NEVER leaked to customer client.
 */
export function mapMessageForCustomer(m: RawMessage, customerOwnName: string): MessageDTO {
  return {
    id: m.id,
    senderRole: m.sender_role,
    displaySender: m.sender_role === 'operator' ? 'AI 상담원' : customerOwnName,
    content: m.content,
    createdAt: m.created_at,
    customerReadAt: m.customer_read_at,
    operatorReadAt: m.operator_read_at,
  };
}

/**
 * Operator view: real sender identity shown (email or '내부 담당자' fallback
 * for unknown user). Customer sender shown by name/email.
 */
export function mapMessageForOperator(
  m: RawMessage,
  emailById: Record<string, string | null>,
  customerName: string,
): MessageDTO {
  const fallback = '내부 담당자';
  return {
    id: m.id,
    senderRole: m.sender_role,
    displaySender:
      m.sender_role === 'operator'
        ? (m.sender_user_id ? (emailById[m.sender_user_id] ?? fallback) : fallback)
        : customerName,
    content: m.content,
    createdAt: m.created_at,
    customerReadAt: m.customer_read_at,
    operatorReadAt: m.operator_read_at,
  };
}
```

- [ ] **2.4: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors.

- [ ] **2.5: Commit (combined with Task 3 + 4)** — see Task 4.

---

## Task 3: Customer endpoints

**Files:**
- `src/app/api/customer-ai/threads/find-or-create/route.ts`
- `src/app/api/customer-ai/threads/[id]/messages/route.ts`

- [ ] **3.1: find-or-create**

```ts
/**
 * POST /api/customer-ai/threads/find-or-create
 *   body: { contextKind: ContextKind, contextPeriod: string }
 *   → 200 { data: ThreadDTO }
 *
 * CUSTOMER only. Uses UNIQUE(customer_id, context_kind, context_period)
 * to find existing row first; INSERT if none.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { ContextKind, ThreadDTO } from '@/types/customer-ai';
import { buildDisplayLabel } from '@/lib/customer-ai/context';

const schema = z.object({
  contextKind: z.enum(['PPH21', 'PPH23', 'PPN', 'CLOSING', 'OTHER']),
  contextPeriod: z.string().regex(/^(\d{4}-\d{2}|OTHER)$/, 'period must be YYYY-MM or OTHER'),
});

interface RawThread {
  id: string;
  customer_id: string;
  context_kind: ContextKind;
  context_period: string;
  status: 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
  customer_unread_count: number;
  operator_unread_count: number;
  last_customer_message_at: string | null;
  last_operator_message_at: string | null;
  created_at: string;
}

function toDTO(t: RawThread): ThreadDTO {
  return {
    id: t.id,
    contextKind: t.context_kind,
    contextPeriod: t.context_period,
    status: t.status,
    customerUnreadCount: t.customer_unread_count,
    operatorUnreadCount: t.operator_unread_count,
    lastCustomerMessageAt: t.last_customer_message_at,
    lastOperatorMessageAt: t.last_operator_message_at,
    createdAt: t.created_at,
    displayLabel: buildDisplayLabel(t.customer_id, t.context_kind, t.context_period),
  };
}

async function handle(req: RequestWithSession): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Resolve current customer row
  const { data: cust, error: cErr } = await admin
    .from('customer')
    .select('id')
    .eq('user_id', req.session.userId)
    .maybeSingle();
  if (cErr || !cust) {
    return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  }

  // Find existing
  const { data: existing } = await admin
    .from('customer_ai_thread')
    .select('*')
    .eq('customer_id', cust.id)
    .eq('context_kind', parsed.data.contextKind)
    .eq('context_period', parsed.data.contextPeriod)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: toDTO(existing as RawThread) });
  }

  // Insert new
  const { data: created, error: iErr } = await admin
    .from('customer_ai_thread')
    .insert({
      customer_id: cust.id,
      customer_user_id: req.session.userId,
      context_kind: parsed.data.contextKind,
      context_period: parsed.data.contextPeriod,
    })
    .select('*')
    .single();
  if (iErr || !created) {
    loggers.api.error({ err: iErr?.message, route: 'customer-ai find-or-create' }, 'create thread failed');
    return NextResponse.json({ error: 'failed to create thread' }, { status: 500 });
  }
  return NextResponse.json({ data: toDTO(created as RawThread) });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handle);
}
```

- [ ] **3.2: messages GET + POST**

`src/app/api/customer-ai/threads/[id]/messages/route.ts`:

```ts
/**
 * GET  /api/customer-ai/threads/:id/messages — list messages in thread.
 *   - Customer can only see own thread (RLS).
 *   - Operator messages persona-masked to 'AI 상담원' (server-enforced).
 *   - Side effect: marks operator messages as read by customer,
 *     resets customer_unread_count to 0.
 *
 * POST /api/customer-ai/threads/:id/messages — customer posts a message.
 *   body: { content: string (1..2000) }
 *   Side effect: increments operator_unread_count, sets last_customer_
 *   message_at, status='AWAITING_OPERATOR'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { MessageDTO } from '@/types/customer-ai';
import { mapMessageForCustomer } from '@/lib/customer-ai/persona';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/messages/);
  return m?.[1] ?? null;
}

async function getCustomerName(admin: ReturnType<typeof getSupabaseAdmin>, customerId: string): Promise<string> {
  const { data } = await admin.from('customer').select('full_name, company_name').eq('id', customerId).maybeSingle();
  return data?.company_name || data?.full_name || '고객';
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  // Verify customer owns the thread (RLS would block but check explicitly for 404)
  const { data: thread } = await admin
    .from('customer_ai_thread')
    .select('id, customer_id, customer_user_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread || thread.customer_user_id !== req.session.userId) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  }

  // Fetch messages
  const { data: msgs } = await admin
    .from('customer_ai_message')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  // Side effect: mark operator messages as read by customer
  const now = new Date().toISOString();
  const unread = (msgs ?? []).filter((m) => m.sender_role === 'operator' && !m.customer_read_at);
  if (unread.length > 0) {
    await admin.from('customer_ai_message').update({ customer_read_at: now })
      .in('id', unread.map((m) => m.id));
  }
  // Reset thread's customer_unread_count
  if (thread.customer_id) {
    await admin.from('customer_ai_thread')
      .update({ customer_unread_count: 0 }).eq('id', threadId);
  }

  const customerName = await getCustomerName(admin, thread.customer_id);
  const dto: MessageDTO[] = (msgs ?? []).map((m) => mapMessageForCustomer(m as any, customerName));
  return NextResponse.json({ data: dto });
}

const postSchema = z.object({ content: z.string().min(1).max(2000) });

async function handlePost(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: thread } = await admin
    .from('customer_ai_thread')
    .select('id, customer_id, customer_user_id, operator_unread_count')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread || thread.customer_user_id !== req.session.userId) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: msg, error: iErr } = await admin
    .from('customer_ai_message')
    .insert({
      thread_id: threadId,
      sender_role: 'customer',
      sender_user_id: req.session.userId,
      content: parsed.data.content,
    })
    .select('*')
    .single();
  if (iErr || !msg) {
    loggers.api.error({ err: iErr?.message }, 'customer message insert failed');
    return NextResponse.json({ error: 'failed to insert message' }, { status: 500 });
  }

  await admin.from('customer_ai_thread').update({
    last_customer_message_at: now,
    operator_unread_count: (thread.operator_unread_count ?? 0) + 1,
    status: 'AWAITING_OPERATOR',
    updated_at: now,
  }).eq('id', threadId);

  const customerName = await getCustomerName(admin, thread.customer_id);
  return NextResponse.json({ data: mapMessageForCustomer(msg as any, customerName) });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handlePost);
}
```

- [ ] **3.3: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```

---

## Task 4: Operator endpoints

**Files:**
- `src/app/api/operator/customer-inbox/threads/route.ts`
- `src/app/api/operator/customer-inbox/threads/[id]/messages/route.ts`
- `src/app/api/operator/customer-inbox/threads/[id]/resolve/route.ts`

- [ ] **4.1: threads list (operator)**

`src/app/api/operator/customer-inbox/threads/route.ts`:

```ts
/**
 * GET /api/operator/customer-inbox/threads
 *   → 200 { data: ThreadWithCustomerDTO[] }
 *
 * Operator-tier only. ORDER BY operator_unread_count DESC, last_customer_
 * message_at DESC NULLS LAST. Joins customer name (company_name OR full_name).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { ThreadWithCustomerDTO } from '@/types/customer-ai';
import { buildDisplayLabel } from '@/lib/customer-ai/context';

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('customer_ai_thread')
    .select(`
      *,
      customer:customer_id (id, full_name, company_name)
    `)
    .order('operator_unread_count', { ascending: false })
    .order('last_customer_message_at', { ascending: false, nullsFirst: false })
    .limit(200);

  const dto: ThreadWithCustomerDTO[] = (data ?? []).map((t: any) => ({
    id: t.id,
    contextKind: t.context_kind,
    contextPeriod: t.context_period,
    status: t.status,
    customerUnreadCount: t.customer_unread_count,
    operatorUnreadCount: t.operator_unread_count,
    lastCustomerMessageAt: t.last_customer_message_at,
    lastOperatorMessageAt: t.last_operator_message_at,
    createdAt: t.created_at,
    displayLabel: buildDisplayLabel(t.customer_id, t.context_kind, t.context_period),
    customerId: t.customer_id,
    customerName: t.customer?.company_name || t.customer?.full_name || '고객',
  }));

  return NextResponse.json({ data: dto }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
  )(request as RequestWithSession, handleGet);
}
```

- [ ] **4.2: thread messages (operator)**

`src/app/api/operator/customer-inbox/threads/[id]/messages/route.ts`:

```ts
/**
 * GET  /api/operator/customer-inbox/threads/:id/messages — operator view.
 *   - Real sender identity shown (email or '내부 담당자').
 *   - Side effect: marks customer messages as read by operator,
 *     resets operator_unread_count.
 *
 * POST /api/operator/customer-inbox/threads/:id/messages — operator reply.
 *   body: { content: string }
 *   Side effect: increments customer_unread_count, sets last_operator_
 *   message_at, status='RESPONDED'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit, recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { MessageDTO } from '@/types/customer-ai';
import { mapMessageForOperator } from '@/lib/customer-ai/persona';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/messages/);
  return m?.[1] ?? null;
}

async function getCustomerName(admin: ReturnType<typeof getSupabaseAdmin>, customerId: string): Promise<string> {
  const { data } = await admin.from('customer').select('full_name, company_name').eq('id', customerId).maybeSingle();
  return data?.company_name || data?.full_name || '고객';
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: thread } = await admin.from('customer_ai_thread').select('id, customer_id').eq('id', threadId).maybeSingle();
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });

  const { data: msgs } = await admin.from('customer_ai_message').select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  // Mark customer messages as read by operator
  const now = new Date().toISOString();
  const unread = (msgs ?? []).filter((m) => m.sender_role === 'customer' && !m.operator_read_at);
  if (unread.length > 0) {
    await admin.from('customer_ai_message').update({ operator_read_at: now })
      .in('id', unread.map((m) => m.id));
  }
  await admin.from('customer_ai_thread').update({ operator_unread_count: 0 }).eq('id', threadId);

  // Resolve sender emails for operator-side display
  const operatorIds = [...new Set((msgs ?? []).filter((m) => m.sender_role === 'operator' && m.sender_user_id).map((m) => m.sender_user_id as string))];
  const emailById: Record<string, string | null> = {};
  for (const id of operatorIds) {
    const { data: u } = await admin.auth.admin.getUserById(id);
    emailById[id] = u.user?.email ?? null;
  }

  const customerName = await getCustomerName(admin, thread.customer_id);
  const dto: MessageDTO[] = (msgs ?? []).map((m) => mapMessageForOperator(m as any, emailById, customerName));
  return NextResponse.json({ data: dto });
}

const postSchema = z.object({ content: z.string().min(1).max(2000) });

async function handlePost(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: thread } = await admin.from('customer_ai_thread')
    .select('id, customer_id, customer_unread_count').eq('id', threadId).maybeSingle();
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: msg, error: iErr } = await admin.from('customer_ai_message').insert({
    thread_id: threadId,
    sender_role: 'operator',
    sender_user_id: req.session.userId,
    content: parsed.data.content,
  }).select('*').single();
  if (iErr || !msg) {
    loggers.api.error({ err: iErr?.message }, 'operator message insert failed');
    return NextResponse.json({ error: 'failed to insert message' }, { status: 500 });
  }

  await admin.from('customer_ai_thread').update({
    last_operator_message_at: now,
    customer_unread_count: (thread.customer_unread_count ?? 0) + 1,
    status: 'RESPONDED',
    updated_at: now,
  }).eq('id', threadId);

  await recordAudit({
    action: 'CUSTOMER_AI_REPLY',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { threadId, messageId: msg.id },
  });

  const customerName = await getCustomerName(admin, thread.customer_id);
  const emailById: Record<string, string | null> = { [req.session.userId]: null };
  // Self email — fetch
  const { data: u } = await admin.auth.admin.getUserById(req.session.userId);
  emailById[req.session.userId] = u.user?.email ?? null;
  return NextResponse.json({ data: mapMessageForOperator(msg as any, emailById, customerName) });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handlePost);
}
```

Note: `'CUSTOMER_AI_REPLY'` is not a known activity_type ENUM value. `recordAudit` will fall back to `TAX_CALCULATION` + store action in details. Phase 1 acceptable; Phase 2 may add ENUM.

- [ ] **4.3: resolve endpoint**

`src/app/api/operator/customer-inbox/threads/[id]/resolve/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(req: RequestWithSession): Promise<Response> {
  const m = (req as unknown as NextRequest).nextUrl.pathname.match(/\/threads\/([^/]+)\/resolve/);
  const id = m?.[1];
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('customer_ai_thread')
    .update({ status: 'RESOLVED', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { status: 'RESOLVED' } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handle);
}
```

- [ ] **4.4: TS check + commit Tasks 2 + 3 + 4 together**

```bash
npx tsc --noEmit -p . 2>&1 | head
git add src/types/customer-ai.ts \
        src/lib/customer-ai/ \
        src/app/api/customer-ai/ \
        src/app/api/operator/customer-inbox/
git commit -m "$(cat <<'EOF'
feat(customer-ai): types + helpers + 5 endpoints (Phase 1 2/N)

신규:
  - types/customer-ai.ts (ContextKind, ThreadStatus, ThreadDTO, MessageDTO, ChatContext)
  - lib/customer-ai/context.ts (detectContext + buildDisplayLabel)
  - lib/customer-ai/persona.ts (mapMessageForCustomer/Operator — operator
    real email 절대 customer 한테 노출 X)
  - api/customer-ai/threads/find-or-create (CUSTOMER, UNIQUE 활용)
  - api/customer-ai/threads/[id]/messages (GET + POST customer)
  - api/operator/customer-inbox/threads (operator list)
  - api/operator/customer-inbox/threads/[id]/messages (GET + POST operator)
  - api/operator/customer-inbox/threads/[id]/resolve (POST)

미들웨어: customer endpoint = requireRole(CUSTOMER). operator endpoint =
requireRole(4 operator-tier). PLATFORM_ADMIN 차단은 blockPlatformAdmin.
서버에서 customer endpoint 의 operator 메시지 displaySender 강제로
'AI 상담원' set — RLS 위 추가 layer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: i18n (do early so UI compiles)

**Files:** `src/i18n/messages/{ko,en,id,ja,zh}.json`

- [ ] **5.1: Add 2 namespaces × 5 locales**

Each file: add `customerAiChat` + `operatorCustomerInbox` namespaces at top level. Also add `nav.customerInbox`.

**ko**:
```jsonc
"customerAiChat": {
  "title": "AI 상담원",
  "subtitle": "자료 요청, 신고 진행 상황, 문의를 안내합니다",
  "statusAwaiting": "AI 상담원 응답 대기",
  "statusResponded": "응답 도착",
  "statusResolved": "해결됨",
  "linkedTask": "현재 연결된 업무",
  "inputPlaceholder": "메시지를 입력하세요...",
  "send": "전송",
  "emptyState": "AI 상담원에게 첫 메시지를 보내보세요",
  "loading": "불러오는 중...",
  "errorSend": "전송 실패. 다시 시도해주세요."
},
"operatorCustomerInbox": {
  "title": "고객 상담",
  "subtitle": "고객 view 에는 항상 'AI 상담원' 으로 표시됩니다",
  "threadListEmpty": "고객 상담 요청이 없습니다",
  "selectThreadHint": "왼쪽에서 thread 를 선택하세요",
  "customerInfoHeader": "고객 정보",
  "metadataHeader": "Thread 정보",
  "replyPlaceholder": "AI 상담원 페르소나로 답변...",
  "send": "전송",
  "markResolved": "해결됨으로 표시",
  "unreadBadge": "{count} 안 읽음"
}
```

And to `nav` (top-level) namespace add: `"customerInbox": "고객 상담"`.

**en**:
- title: "AI Consultant", subtitle: "Material requests, filing status, and inquiry guidance"
- statusAwaiting: "Awaiting AI Consultant", statusResponded: "Reply Received", statusResolved: "Resolved"
- linkedTask: "Linked task", inputPlaceholder: "Type your message...", send: "Send"
- emptyState: "Send your first message to the AI Consultant"
- loading: "Loading...", errorSend: "Send failed. Try again."
- operator: title: "Customer Inbox", subtitle: "Customers always see your messages as 'AI Consultant'"
- threadListEmpty: "No customer inquiries", selectThreadHint: "Select a thread on the left"
- customerInfoHeader: "Customer Info", metadataHeader: "Thread Info"
- replyPlaceholder: "Reply as AI Consultant...", send: "Send", markResolved: "Mark resolved"
- unreadBadge: "{count} unread"
- nav.customerInbox: "Customer Inbox"

**id**:
- title: "Konsultan AI", subtitle: "Panduan permintaan dokumen, status pelaporan, dan pertanyaan"
- statusAwaiting: "Menunggu Konsultan AI", statusResponded: "Balasan Diterima", statusResolved: "Selesai"
- linkedTask: "Tugas terhubung", inputPlaceholder: "Ketik pesan Anda...", send: "Kirim"
- emptyState: "Kirim pesan pertama ke Konsultan AI"
- loading: "Memuat...", errorSend: "Gagal mengirim. Coba lagi."
- operator: title: "Kotak Pelanggan", subtitle: "Pelanggan selalu melihat pesan Anda sebagai 'Konsultan AI'"
- threadListEmpty: "Tidak ada pertanyaan pelanggan", selectThreadHint: "Pilih thread di sebelah kiri"
- customerInfoHeader: "Info Pelanggan", metadataHeader: "Info Thread"
- replyPlaceholder: "Balas sebagai Konsultan AI...", send: "Kirim", markResolved: "Tandai selesai"
- unreadBadge: "{count} belum dibaca"
- nav.customerInbox: "Kotak Pelanggan"

**ja**:
- title: "AIコンサルタント", subtitle: "資料リクエスト、申告進捗、お問い合わせを案内します"
- statusAwaiting: "AIコンサルタント応答待ち", statusResponded: "返信あり", statusResolved: "解決済み"
- linkedTask: "関連業務", inputPlaceholder: "メッセージを入力...", send: "送信"
- emptyState: "AIコンサルタントに最初のメッセージを送りましょう"
- loading: "読込中...", errorSend: "送信失敗。再試行してください。"
- operator: title: "顧客対応", subtitle: "顧客には常に「AIコンサルタント」として表示されます"
- threadListEmpty: "顧客の問い合わせはありません", selectThreadHint: "左からスレッドを選択"
- customerInfoHeader: "顧客情報", metadataHeader: "スレッド情報"
- replyPlaceholder: "AIコンサルタントとして返信...", send: "送信", markResolved: "解決済みに"
- unreadBadge: "未読 {count}"
- nav.customerInbox: "顧客対応"

**zh**:
- title: "AI 顾问", subtitle: "提供资料请求、申报进度、咨询指引"
- statusAwaiting: "等待 AI 顾问回复", statusResponded: "已收到回复", statusResolved: "已解决"
- linkedTask: "关联业务", inputPlaceholder: "请输入消息...", send: "发送"
- emptyState: "向 AI 顾问发送第一条消息"
- loading: "加载中...", errorSend: "发送失败,请重试。"
- operator: title: "客户咨询", subtitle: "客户始终将您的消息显示为「AI 顾问」"
- threadListEmpty: "暂无客户咨询", selectThreadHint: "请在左侧选择会话"
- customerInfoHeader: "客户信息", metadataHeader: "会话信息"
- replyPlaceholder: "以 AI 顾问身份回复...", send: "发送", markResolved: "标记已解决"
- unreadBadge: "{count} 未读"
- nav.customerInbox: "客户咨询"

- [ ] **5.2: Validate JSON**

```bash
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "ok $f" || echo "BAD $f"
done
```

- [ ] **5.3: Commit**

```bash
git add src/i18n/messages/{ko,en,id,ja,zh}.json
git commit -m "$(cat <<'EOF'
feat(i18n): customerAiChat + operatorCustomerInbox + nav.customerInbox (Phase 1 3/N)

5 locale × 2 namespace (customer-side 11 키 + operator-side 9 키) + nav 키 1개.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: CustomerAiChat + ChatbotWrapper role dispatch

**Files:**
- `src/components/chat/CustomerAiChat.tsx` (new)
- `src/components/chat/ChatbotWrapper.tsx` (modify)
- `src/app/[locale]/(dashboard)/layout.tsx` (modify — pass role prop)

- [ ] **6.1: CustomerAiChat component**

`src/components/chat/CustomerAiChat.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { detectContext } from '@/lib/customer-ai/context';
import type { ThreadDTO, MessageDTO } from '@/types/customer-ai';

const POLL_MS = 5_000;

export function CustomerAiChat() {
  const t = useTranslations('customerAiChat');
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [thread, setThread] = useState<ThreadDTO | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const ctx = detectContext(pathname || '/');

  // Ensure thread when opening
  const openPanel = useCallback(async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      const r = await fetch('/api/customer-ai/threads/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextKind: ctx.kind, contextPeriod: ctx.period }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setThread(j.data);
      // Fetch messages (also resets customer_unread_count server-side)
      const m = await fetch(`/api/customer-ai/threads/${j.data.id}/messages`);
      const mj = await m.json();
      setMessages(mj.data ?? []);
      setUnreadCount(0);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [ctx.kind, ctx.period]);

  // Polling while open
  useEffect(() => {
    if (!isOpen || !thread) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const r = await fetch(`/api/customer-ai/threads/${thread.id}/messages`);
      if (r.ok) {
        const j = await r.json();
        setMessages(j.data ?? []);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isOpen, thread]);

  // Scroll to bottom on new messages
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!thread || !input.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/customer-ai/threads/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setMessages((prev) => [...prev, j.data]);
      setInput('');
    } catch {
      // toast or inline error
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={openPanel}
        aria-label={unreadCount > 0 ? `AI 상담원 ${unreadCount}개 응답` : 'AI 상담원 열기'}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:scale-105 transition-all duration-300 relative"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white shadow-lg">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        )}
      </button>
    );
  }

  const statusLabel =
    thread?.status === 'RESPONDED' ? t('statusResponded') :
    thread?.status === 'RESOLVED' ? t('statusResolved') :
    t('statusAwaiting');

  return (
    <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden bottom-6 right-6 w-[380px] h-[560px]">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex items-start justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-sm">{t('title')}</h3>
          <p className="text-xs text-blue-200 mt-0.5">{statusLabel}</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5">{t('linkedTask')}: {ctx.label}</p>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="text-center text-xs text-gray-400">{t('loading')}</div>}
        {!loading && messages.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">{t('emptyState')}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.senderRole === 'customer' ? 'justify-end' : ''}`}>
            {m.senderRole === 'operator' && (
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.senderRole === 'customer' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              <p className={`text-[10px] mt-1 ${m.senderRole === 'customer' ? 'text-blue-200' : 'text-gray-400'}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {m.senderRole === 'customer' && (
              <div className="p-1.5 bg-gray-200 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={t('inputPlaceholder')}
            disabled={sending}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <button onClick={send} disabled={sending || !input.trim() || !thread} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerAiChat;
```

- [ ] **6.2: ChatbotWrapper role dispatch**

`src/components/chat/ChatbotWrapper.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';

const TaxChatbot = dynamic(() => import('./TaxChatbot'), { ssr: false });
const CustomerAiChat = dynamic(() => import('./CustomerAiChat'), { ssr: false });

interface Props {
  /** From server-resolved role. CUSTOMER → CustomerAiChat (concierge). Else → TaxChatbot (public AI Q&A). */
  role: string | null;
}

export function ChatbotWrapper({ role }: Props) {
  if (role === 'CUSTOMER') return <CustomerAiChat />;
  return <TaxChatbot />;
}
```

- [ ] **6.3: Dashboard layout — resolve role + pass prop**

`src/app/[locale]/(dashboard)/layout.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { SidebarWrapper } from '@/components/layout/SidebarWrapper';
import { Header } from '@/components/layout/header';
import { MobileSidebarProvider } from '@/components/layout/mobile-sidebar';
import { ChatbotWrapper } from '@/components/chat/ChatbotWrapper';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await resolveUserRole(supabase, user.id) : null;

  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <SidebarWrapper />
        <div className="lg:ml-64">
          <Header userEmail={user?.email} userName={user?.user_metadata?.full_name} />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
        <ChatbotWrapper role={role} />
      </div>
    </MobileSidebarProvider>
  );
}
```

- [ ] **6.4: TS check + commit**

```bash
npx tsc --noEmit -p . 2>&1 | head
git add src/components/chat/CustomerAiChat.tsx \
        src/components/chat/ChatbotWrapper.tsx \
        "src/app/[locale]/(dashboard)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(customer-ai): CustomerAiChat FAB + role dispatch (Phase 1 4/N)

신규 CustomerAiChat ('use client'):
  - mount 시 현 pathname → detectContext → thread find-or-create
  - panel 열린 동안 5초 polling (document.visibilityState='visible' 만)
  - operator 메시지는 Bot 아이콘 + "AI 상담원" 페르소나 (서버 강제)
  - status badge (대기/응답/해결) + 현재 연결된 업무 표시

ChatbotWrapper role prop 분기:
  - CUSTOMER → CustomerAiChat (concierge)
  - 그 외 → TaxChatbot (public AI Q&A 유지)

dashboard layout server-side role resolve 후 prop 전달.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Operator inbox UI + sidebar

**Files:**
- `src/app/[locale]/(dashboard)/operator/customer-inbox/page.tsx`
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/InboxThreadList.tsx`
- `src/app/[locale]/(dashboard)/operator/customer-inbox/_components/InboxThreadDetail.tsx`
- `src/components/layout/sidebar.tsx`

- [ ] **7.1: page.tsx**

`src/app/[locale]/(dashboard)/operator/customer-inbox/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/layout/PageTitle';
import { CustomerInboxClient } from './_components/CustomerInboxClient';

export default async function OperatorCustomerInboxPage() {
  const t = await getTranslations('operatorCustomerInbox');
  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('title')} />
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      </div>
      <CustomerInboxClient />
    </div>
  );
}
```

- [ ] **7.2: CustomerInboxClient (3-pane)**

`src/app/[locale]/(dashboard)/operator/customer-inbox/_components/CustomerInboxClient.tsx`:

Skeleton with state for selected thread + fetches threads + fetches messages on select. Implement the 3-pane (list 240px / detail 1fr / info 320px) using the same color palette as Track B/C UI (slate borders, emerald for own messages, blue for customer).

Full code (~150 lines) — implementer should follow the pattern from `supervisor/approval/[sessionId]/page.tsx` (Track C reference).

Key:
- left list: `customerName · displayLabel · status pill · unread badge if > 0`
- middle detail: messages timeline (real displaySender shown, NOT masked)
- right info: customer name + email + thread metadata + "Mark resolved" button
- input bar at bottom + send button → POST messages → append + clear

- [ ] **7.3: sidebar entry**

In `src/components/layout/sidebar.tsx`, inside the supervisor section (around line 273), add:

```tsx
{ href: '/operator/customer-inbox', icon: MessageCircle, labelKey: 'nav.customerInbox' },
```

Verify `MessageCircle` already imported (it likely is — TaxChatbot uses it).

- [ ] **7.4: TS check + commit**

```bash
npx tsc --noEmit -p . 2>&1 | head
git add "src/app/[locale]/(dashboard)/operator/customer-inbox/" \
        src/components/layout/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(operator): customer-inbox 3-pane UI + sidebar (Phase 1 5/N)

신규 /operator/customer-inbox page (server + _components 3-pane client).
좌: thread list (unread 우선 정렬, customer 이름 + label + status pill)
중: 선택 thread 메시지 timeline (real displaySender — operator 자기/
    동료 / customer 모두 실명/email)
우: customer info + thread metadata + "해결됨으로 표시" 버튼

Sidebar 의 operator (supervisor) 섹션에 '고객 상담' 링크 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Smoke + runner

**Files:**
- `scripts/test-customer-ai-inbox.ts`
- `scripts/test-smoke-all.ts` (add step)
- `package.json` (add script)

- [ ] **8.1: smoke script** — 10-assertion script per spec §7. Use pattern from `scripts/test-tax-code-rule.ts` for login/get/post helpers.

- [ ] **8.2: Wire into runner**

`scripts/test-smoke-all.ts` STEPS array, near other admin/config or as new section:

```ts
{ name: 'customer-ai inbox end-to-end (Phase 1)', file: 'test-customer-ai-inbox.ts' },
```

`package.json`:

```jsonc
"test:customer-ai-inbox": "tsx scripts/test-customer-ai-inbox.ts",
```

- [ ] **8.3: Run smoke (use local dev server + prod Supabase env swap pattern)**

```bash
SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-customer-ai-inbox.ts
```
Expected: `— 10 pass / 0 fail —` (number may vary, all pass).

- [ ] **8.4: Commit**

```bash
git add scripts/test-customer-ai-inbox.ts scripts/test-smoke-all.ts package.json
git commit -m "$(cat <<'EOF'
test(customer-ai): inbox end-to-end smoke (Phase 1 6/N)

10 assertion: customer find-or-create → customer post → operator list
sees thread + unread → operator GET → mark read → operator reply →
customer GET 시 displaySender='AI 상담원' (persona masking 검증) →
consultant 403 → admin 403 → resolve.

Runner step 추가 (15 total). package.json test:customer-ai-inbox.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: CLAUDE.md + push + prod verify

- [ ] **9.1: CLAUDE.md**

Add 1 line in "Individual scripts" list:
```
- `SEED_TARGET=prod npx tsx scripts/test-customer-ai-inbox.ts` — Phase 1 Customer ↔ AI 상담원 chat (find-or-create + persona masking + RBAC, 10 assertions)
```
Bump integrated runner step count (14 → 15).

- [ ] **9.2: Commit + push**

```bash
git add CLAUDE.md && git commit -m "docs(CLAUDE.md): customer-ai smoke + Phase 1 reference"
git push origin main
```

- [ ] **9.3: Wait for Vercel deploy** — poll until customer endpoint live (similar pattern to Track D verification).

- [ ] **9.4: Prod smoke 10/10**

```bash
SEED_TARGET=prod npx tsx scripts/test-customer-ai-inbox.ts
```

- [ ] **9.5: Visual smoke** — log in as company.test@example.com → FAB at bottom-right → click → empty thread visible. Send message → message appears. Logout → log in as operator.test@aipajak.com → sidebar "고객 상담" → see thread → reply → logout → company.test again → see reply as "AI 상담원".

- [ ] **9.6: Save memory**

Memory file `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_29_customer_ai_chat_phase1.md` + MEMORY.md pointer.

---

## Out of scope (Phase 2/3)

- AI draft suggestion (Anthropic Claude) for operator (Phase 2)
- 파일 첨부 (Phase 3)
- 빠른 문구 templates (Phase 3)
- 문의 유형 dropdown (Phase 3)
- 알림 (email/push) (Phase 3)
- Websocket/SSE 실시간 (Phase 3)

## Report Format (per task)
- **Status**
- TS / smoke output
- Files changed
- Commit SHA
- Concerns
