# 상담원 통합 업무함 — 원천세(PPh23+PPh4(2)) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v19 목업의 "원천세" 사이드바 뷰(현재 스텁)를 활성화하고, PPh23 + PPh4(2) 두 세목을 실데이터(`pph23_transaction`)에 붙여 상담원 업무함에서 검토·요청까지 동작시킨다.

**Architecture:** PPh21 골든 패턴 미러. 업무 단위 = 기존 `djp_submission_queue`(tax_type='PPh23', period YYYY-MM). 상세는 `pph23_transaction`을 (customer, period)로 집계(두 regime 함께). 증빙 첨부는 `pph23_transaction.invoice_document_id != null`로 판정(조인 불필요). 요청 엔드포인트·RequestDrawer·quick-create는 범용이라 재사용. 신규 테이블 0.

**Tech Stack:** Next.js 16 App Router, React 19, TS strict, Supabase admin, CSS Module(재사용), next-intl(ko/en/id), Vitest, prod smoke(tsx).

**Design doc:** `docs/superpowers/specs/2026-07-31-workqueue-withholding-design.md`

---

## File Structure

**신규 백엔드**
- `src/lib/operator/withholding-review-flags.ts` — 원천세 거래 이슈 판정 순수 함수. (Task 1)
- `src/lib/operator/__tests__/withholding-review-flags.test.ts` — 유닛. (Task 1)
- `src/app/api/operator/workqueue/[queueId]/withholding/route.ts` — 상세 GET. (Task 2)

**신규 프런트**
- `src/components/operator/workqueue/WithholdingReviewTable.tsx` — 거래 검토 표. (Task 3)
- `src/components/operator/workqueue/WithholdingReviewPanel.tsx` — 우측 상세(요약+표+요청). (Task 3)

**수정**
- `src/components/operator/workqueue/types.ts` — Withholding DTO 타입 + taxView→taxType 맵. (Task 3)
- `src/components/operator/workqueue/WorkqueueClient.tsx` — taxView 구동 일반화 + 패널 분기. (Task 4)
- `src/components/operator/workqueue/WorkqueueSidebar.tsx` — 원천세 viewBtn 스텁 해제. (Task 4)
- `src/i18n/messages/{ko,en,id}.json` — `operatorWorkqueue` 원천세 키. (Task 5)
- `scripts/test-workqueue-withholding.ts` — 신규 smoke. (Task 6)
- `scripts/test-smoke-all.ts` — runner 1 step. (Task 6)

---

## Task 1: 이슈 판정 순수 함수

**Files:**
- Create: `src/lib/operator/withholding-review-flags.ts`
- Test: `src/lib/operator/__tests__/withholding-review-flags.test.ts`

목적: 원천세 거래 한 줄 → red(이슈 하나라도) / green "확인 완료". 이슈 4종: NPWP 없음 / 증빙 미첨부 / 세액·세율 0 / 거래처 미매칭.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/operator/__tests__/withholding-review-flags.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateWithholdingFlags, type WithholdingReviewInput } from '../withholding-review-flags';

const clean: WithholdingReviewInput = {
  counterpartyNpwp: '01.234.567.8-901.000',
  counterpartyId: 'cp-1',
  taxAmount: 150000,
  taxRate: 0.02,
  hasInvoicePhoto: true,
};

describe('evaluateWithholdingFlags', () => {
  it('marks a fully clean transaction green', () => {
    const r = evaluateWithholdingFlags(clean);
    expect(r.level).toBe('green');
    expect(r.issues).toEqual([]);
    expect(r.label).toBe('확인 완료');
  });

  it('flags missing counterparty NPWP as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, counterpartyNpwp: '  ' });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('NPWP');
    expect(r.label).toBe('NPWP 확인 필요');
  });

  it('flags missing invoice photo as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, hasInvoicePhoto: false });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('증빙');
    expect(r.label).toBe('증빙 확인 필요');
  });

  it('flags zero tax amount or rate as red', () => {
    expect(evaluateWithholdingFlags({ ...clean, taxAmount: 0 }).issues).toContain('세액');
    expect(evaluateWithholdingFlags({ ...clean, taxRate: 0 }).issues).toContain('세액');
  });

  it('flags unmatched counterparty as red', () => {
    const r = evaluateWithholdingFlags({ ...clean, counterpartyId: null });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('거래처');
  });

  it('combines multiple issues into one label in fixed order', () => {
    const r = evaluateWithholdingFlags({
      ...clean, counterpartyNpwp: null, hasInvoicePhoto: false, taxAmount: 0, counterpartyId: null,
    });
    expect(r.level).toBe('red');
    expect(r.issues).toEqual(['NPWP', '증빙', '세액', '거래처']);
    expect(r.label).toBe('NPWP·증빙·세액·거래처 확인 필요');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/operator/__tests__/withholding-review-flags.test.ts`
Expected: FAIL — cannot find module `../withholding-review-flags`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/operator/withholding-review-flags.ts

export interface WithholdingReviewInput {
  counterpartyNpwp: string | null;
  counterpartyId: string | null;
  taxAmount: number;
  taxRate: number;
  hasInvoicePhoto: boolean;
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface WithholdingFlags {
  level: ReviewLevel;
  issues: string[]; // fixed order tokens: 'NPWP' | '증빙' | '세액' | '거래처'
  label: string;
}

const isBlank = (v: string | null): boolean => !v || v.trim().length === 0;

export function evaluateWithholdingFlags(input: WithholdingReviewInput): WithholdingFlags {
  const issues: string[] = [];
  if (isBlank(input.counterpartyNpwp)) issues.push('NPWP');
  if (!input.hasInvoicePhoto) issues.push('증빙');
  if (input.taxAmount <= 0 || input.taxRate <= 0) issues.push('세액');
  if (isBlank(input.counterpartyId)) issues.push('거래처');

  if (issues.length > 0) {
    return { level: 'red', issues, label: `${issues.join('·')} 확인 필요` };
  }
  return { level: 'green', issues: [], label: '확인 완료' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/operator/__tests__/withholding-review-flags.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/operator/withholding-review-flags.ts src/lib/operator/__tests__/withholding-review-flags.test.ts
git commit -m "feat(operator): withholding transaction review-flag pure function + unit tests"
```

---

## Task 2: 원천세 상세 GET 엔드포인트

**Files:**
- Create: `src/app/api/operator/workqueue/[queueId]/withholding/route.ts`

목적: 큐행(queueId) → (customer_id, period) 의 `pph23_transaction`(두 regime) + Task 1 플래그 + 요약 반환. RBAC은 PPh21 route 와 동일한 user_roles 게이트. 증빙 = `invoice_document_id != null`.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/operator/workqueue/[queueId]/withholding/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateWithholdingFlags } from '@/lib/operator/withholding-review-flags';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, status')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`; // YYYY-MM

  const { data: txns } = await admin
    .from('pph23_transaction')
    .select('id, counterparty_id, counterparty_name, counterparty_npwp, tax_regime, transaction_date, description, income_type, service_type, gross_amount, tax_rate, tax_amount, invoice_document_id')
    .eq('customer_id', q.customer_id).eq('tax_period', period)
    .order('transaction_date', { ascending: true });

  const rows = (txns ?? []).map(t => {
    const hasInvoicePhoto = t.invoice_document_id != null;
    const flags = evaluateWithholdingFlags({
      counterpartyNpwp: t.counterparty_npwp ?? null,
      counterpartyId: t.counterparty_id ?? null,
      taxAmount: Number(t.tax_amount ?? 0),
      taxRate: Number(t.tax_rate ?? 0),
      hasInvoicePhoto,
    });
    return {
      id: t.id,
      regime: t.tax_regime === 'PPH4_2' ? 'PPH4_2' : 'PPH23',
      counterpartyName: t.counterparty_name ?? '—',
      counterpartyNpwp: t.counterparty_npwp ?? null,
      transactionDate: t.transaction_date ?? null,
      description: t.description ?? '',
      incomeType: t.income_type ?? t.service_type ?? '',
      grossAmount: Number(t.gross_amount ?? 0),
      taxRate: Number(t.tax_rate ?? 0),
      taxAmount: Number(t.tax_amount ?? 0),
      hasInvoicePhoto,
      flags,
    };
  });

  const summary = {
    txnCount: rows.length,
    totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
    totalTax: rows.reduce((s, r) => s + r.taxAmount, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red').length,
  };

  return NextResponse.json({
    success: true,
    data: { queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/operator/workqueue/[queueId]/withholding"
git commit -m "feat(operator): GET workqueue/[queueId]/withholding — pph23_transaction join + review flags"
```

---

## Task 3: 공유 타입 + 우측 원천세 패널 + 거래 표

**Files:**
- Modify: `src/components/operator/workqueue/types.ts`
- Create: `src/components/operator/workqueue/WithholdingReviewTable.tsx`
- Create: `src/components/operator/workqueue/WithholdingReviewPanel.tsx`

목적: 선택 큐건의 `GET /withholding` → 요약 4카드 + regime/상태 필터 + 거래 표 + [요청]. 요청 모달은 PPh21 패널의 것과 동일 계약(`/workqueue/[id]/request`).

- [ ] **Step 1: Add shared types + taxView→taxType map to `types.ts`**

`src/components/operator/workqueue/types.ts` 끝에 추가:

```typescript
// taxView(사이드바) → djp_submission_queue.tax_type
export const TAX_VIEW_TO_TYPE: Record<string, string> = {
  pph21: 'PPh21',
  withholding: 'PPh23',
};

export interface WithholdingRow {
  id: string;
  regime: 'PPH23' | 'PPH4_2';
  counterpartyName: string;
  counterpartyNpwp: string | null;
  transactionDate: string | null;
  description: string;
  incomeType: string;
  grossAmount: number;
  taxRate: number;
  taxAmount: number;
  hasInvoicePhoto: boolean;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface WithholdingDetail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { txnCount: number; totalGross: number; totalTax: number; incompleteCount: number };
  rows: WithholdingRow[];
}
```

- [ ] **Step 2: WithholdingReviewTable**

```tsx
// src/components/operator/workqueue/WithholdingReviewTable.tsx
'use client';
import styles from './workqueue.module.css';
import type { WithholdingRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const lvlText = (l: string) => (l === 'green' ? '완료' : l === 'red' ? '요청' : '검토');
const regimeText = (r: string) => (r === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23');
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

interface Props {
  rows: WithholdingRow[];
  onRequest: (row: WithholdingRow) => void;
  onViewPhoto: (row: WithholdingRow) => void;
}

export function WithholdingReviewTable({ rows, onRequest, onViewPhoto }: Props) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>거래처</th><th>NPWP</th><th>세목</th><th>거래일</th>
          <th className={styles.money}>총 지급</th><th>세율</th><th className={styles.money}>세액</th>
          <th>증빙</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{lvlText(r.flags.level)}</span></td>
              <td className={styles.name}><b>{r.counterpartyName}</b><span>{r.incomeType}</span></td>
              <td>{r.counterpartyNpwp ?? 'NPWP 없음'}</td>
              <td>{regimeText(r.regime)}</td>
              <td>{r.transactionDate ?? '—'}</td>
              <td className={styles.money}>{rp(r.grossAmount)}</td>
              <td>{pct(r.taxRate)}</td>
              <td className={styles.money}>{rp(r.taxAmount)}</td>
              <td>
                {r.hasInvoicePhoto
                  ? <button className={styles.btn} onClick={() => onViewPhoto(r)}>첨부됨</button>
                  : <span style={{ color: '#9ca3af' }}>미첨부</span>}
              </td>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
              <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>요청</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: WithholdingReviewPanel (fetch + 요약 + 필터 + 표 + 요청 + 증빙 모달)**

```tsx
// src/components/operator/workqueue/WithholdingReviewPanel.tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { WithholdingReviewTable } from './WithholdingReviewTable';
import type { WithholdingDetail, WithholdingRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function WithholdingReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<WithholdingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regime, setRegime] = useState<'' | 'PPH23' | 'PPH4_2'>('');
  const [statusF, setStatusF] = useState<'' | 'red' | 'green'>('');
  const [requestRow, setRequestRow] = useState<WithholdingRow | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/withholding`);
      const j = await r.json();
      if (j.success) setDetail(j.data as WithholdingDetail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    try {
      await fetch('/api/operator/queue', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, action }),
      });
      await load(); onChanged();
    } catch { setError('상태 변경에 실패했습니다.'); }
  };

  const viewPhoto = async (row: WithholdingRow) => {
    try {
      const r = await fetch(`/api/tax/pph23-transactions/${row.id}/invoice-photo`);
      const j = await r.json();
      const url = j?.data?.url ?? j?.url ?? null;
      if (url) setPhotoUrl(url);
    } catch { /* ignore — modal just won't open */ }
  };

  const rows = useMemo(() => (detail?.rows ?? []).filter(r =>
    (!regime || r.regime === regime) && (!statusF || r.flags.level === statusF)), [detail, regime, statusF]);

  if (error) return (
    <div className={styles.card}><div className={styles.body}>
      <div className={styles.blocked}>{error}</div>
      <button className={styles.btn} onClick={() => load()}>다시 시도</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>불러오는 중…</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div><h1>{t('whTitle')}</h1><p>{detail.period} 귀속분 · 원천세 거래 검토</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <button className={`${styles.btn} ${styles.purple}`} onClick={() => act('request-approval')}>고객 검토완료</button>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{t('whTxnCount')}</small><b>{s.txnCount}건</b></div>
          <div className={styles.metric2}><small>{t('whTotalGross')}</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>{t('whTotalTax')}</small><b>{rp(s.totalTax)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        <div className={styles.toolbar}>
          <div>
            <select value={regime} onChange={e => setRegime(e.target.value as '' | 'PPH23' | 'PPH4_2')}>
              <option value="">전체 세목</option>
              <option value="PPH23">PPh 23</option>
              <option value="PPH4_2">PPh 4(2)</option>
            </select>
            <select value={statusF} onChange={e => setStatusF(e.target.value as '' | 'red' | 'green')}>
              <option value="">전체 상태</option>
              <option value="red">요청 필요</option>
              <option value="green">확인 완료</option>
            </select>
          </div>
        </div>

        <WithholdingReviewTable rows={rows} onRequest={setRequestRow} onViewPhoto={viewPhoto} />
      </div>

      {requestRow && (
        <RequestModal key={requestRow.id} row={requestRow} queueId={queueId}
          onClose={() => setRequestRow(null)}
          onSent={async () => { setRequestRow(null); await load(); onChanged(); }} />
      )}
      {photoUrl && (
        <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={() => setPhotoUrl(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>증빙 미리보기</h2>
            <div className={styles.mb}><img src={photoUrl} alt="증빙" style={{ maxWidth: '100%', borderRadius: 8 }} /></div>
            <div className={styles.mf}><button className={styles.btn} onClick={() => setPhotoUrl(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestModal({ row, queueId, onClose, onSent }:
  { row: WithholdingRow; queueId: string; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState(`${row.counterpartyName} 거래의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const send = async () => {
    setSending(true);
    try {
      await fetch(`/api/operator/workqueue/${queueId}/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: row.id, message: msg }),
      });
      onSent();
    } finally { setSending(false); }
  };
  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>고객에게 요청</h2>
        <div className={styles.mb}>
          <label>대상 거래<input readOnly value={row.counterpartyName} /></label>
          <label>고객에게 보낼 메시지<textarea value={msg} onChange={e => setMsg(e.target.value)} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={send} disabled={sending}>고객에게 표시</button>
        </div>
      </div>
    </div>
  );
}
```

> Note: the invoice-photo GET response shape is read defensively (`j.data.url ?? j.url`). Task 3 Step 4 verifies the actual key.

- [ ] **Step 4: Verify invoice-photo GET response shape**

Run: `grep -n "NextResponse.json\|signed\|url" src/app/api/tax/pph23-transactions/[id]/invoice-photo/route.ts`
Expected: a GET handler returning a signed URL. Confirm the JSON key (`url` at top level or under `data`). The panel already reads both (`j.data.url ?? j.url`); if the key differs, adjust that one line.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds (WithholdingReviewPanel imported in Task 4; until then the build passes because nothing imports it yet — it's a standalone module).

- [ ] **Step 6: Commit**

```bash
git add src/components/operator/workqueue/types.ts src/components/operator/workqueue/WithholdingReviewTable.tsx src/components/operator/workqueue/WithholdingReviewPanel.tsx
git commit -m "feat(operator): withholding review panel + transaction table + shared types"
```

---

## Task 4: WorkqueueClient taxView 일반화 + 사이드바 활성화

**Files:**
- Modify: `src/components/operator/workqueue/WorkqueueClient.tsx`
- Modify: `src/components/operator/workqueue/WorkqueueSidebar.tsx`

목적: 사이드바 원천세 뷰 클릭 → 리스트 tax_type 전환(PPh23) + 우측 패널 전환(WithholdingReviewPanel). PPh21 경로 회귀 없음.

- [ ] **Step 1: Generalize WorkqueueClient's two fetches + panel switch**

`src/components/operator/workqueue/WorkqueueClient.tsx` 편집:

(a) import 추가 + 맵 사용:
```typescript
import { WithholdingReviewPanel } from './WithholdingReviewPanel';
import { STATUS_LABEL_MAP, TAX_VIEW_TO_TYPE, type QueueListItem, type StatusFilter, type TaxView } from './types';
```

(b) effect 의 fetch URL 을 taxView 구동으로 변경 (line ~30):
```typescript
        const r = await fetch(`/api/operator/queue?taxType=${TAX_VIEW_TO_TYPE[taxView]}&year=${y}&month=${Number(m)}&limit=200`);
```
그리고 effect deps 를 `[period]` → `[period, taxView]` 로 변경.

(c) `load` callback 의 fetch URL 동일 변경 + deps `[period]` → `[period, taxView]`:
```typescript
      const r = await fetch(`/api/operator/queue?taxType=${TAX_VIEW_TO_TYPE[taxView]}&year=${y}&month=${Number(m)}&limit=200`);
```

(d) taxView 변경 시 선택 초기화 — sidebar 핸들러를 감싼다. `<WorkqueueSidebar ... onTaxView={setTaxView} />` 를:
```typescript
        <WorkqueueSidebar counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          taxView={taxView} onTaxView={(v) => { setSelectedId(null); setTaxView(v); }} />
```

(e) 우측 패널 분기 — 기존 `selectedId ? <Pph21ReviewPanel .../>` 블록을:
```typescript
                {selectedId
                  ? (taxView === 'withholding'
                      ? <WithholdingReviewPanel key={selectedId} queueId={selectedId} onChanged={load} />
                      : <Pph21ReviewPanel key={selectedId} queueId={selectedId} onChanged={load} />)
                  : <div className={styles.card}><div className={styles.body}>왼쪽에서 고객 업무를 선택하세요.</div></div>}
```

- [ ] **Step 2: Activate the withholding sidebar button**

`src/components/operator/workqueue/WorkqueueSidebar.tsx` 에서 원천세 viewBtn 의 stub 인자 제거:
```tsx
        {viewBtn('withholding', '원천세 (PPh 4(2), 15, 22, 23, 26)')}
```
(세 번째 인자 `true` 삭제 → 클릭 활성.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/[locale]/operator/workqueue` still present; `/api/operator/workqueue/[queueId]/withholding` in route list.

- [ ] **Step 4: Commit**

```bash
git add src/components/operator/workqueue/WorkqueueClient.tsx src/components/operator/workqueue/WorkqueueSidebar.tsx
git commit -m "feat(operator): wire withholding view into workqueue (taxView-driven list + panel)"
```

---

## Task 5: i18n 키 (ko/en/id)

**Files:**
- Modify: `src/i18n/messages/ko.json`, `en.json`, `id.json`

목적: `operatorWorkqueue` 에 원천세 라벨 추가. WithholdingReviewPanel 이 쓰는 키: `whTitle`, `whTxnCount`, `whTotalGross`, `whTotalTax`.

- [ ] **Step 1: Add keys via a node script (safe JSON edit)**

```bash
node <<'EOF'
const fs = require('fs');
const ns = {
  ko: { whTitle: '원천세 (PPh 23 · 4(2))', whTxnCount: '거래 수', whTotalGross: '총 지급액', whTotalTax: '원천세 합계' },
  en: { whTitle: 'Withholding Tax (PPh 23 · 4(2))', whTxnCount: 'Transactions', whTotalGross: 'Total Gross', whTotalTax: 'Total Withheld' },
  id: { whTitle: 'Pajak Potong (PPh 23 · 4(2))', whTxnCount: 'Transaksi', whTotalGross: 'Total Bruto', whTotalTax: 'Total Dipotong' },
};
for (const l of ['ko','en','id']) {
  const p = './src/i18n/messages/'+l+'.json';
  const j = JSON.parse(fs.readFileSync(p,'utf8'));
  j.operatorWorkqueue = { ...(j.operatorWorkqueue || {}), ...ns[l] };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log(l, 'ok');
}
EOF
```

- [ ] **Step 2: Verify JSON validity + build**

Run: `node -e "['ko','en','id'].forEach(l=>require('./src/i18n/messages/'+l+'.json'))" && npm run build`
Expected: no JSON parse errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/ko.json src/i18n/messages/en.json src/i18n/messages/id.json
git commit -m "i18n(operator): withholding workqueue labels ko/en/id"
```

---

## Task 6: prod smoke + runner 통합

**Files:**
- Create: `scripts/test-workqueue-withholding.ts`
- Modify: `scripts/test-smoke-all.ts`

목적: 계약 검증 — quick-create(PPh23) → GET withholding shape → request PENDING_DOCS → RBAC 403 → cleanup. `test-workqueue-pph21.ts` 패턴 복제.

- [ ] **Step 1: Write the smoke script**

```typescript
// scripts/test-workqueue-withholding.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl = process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const SENTINEL_MONTH = 12;
const SENTINEL_YEAR = 2099;

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`   ✓ ${label}`);
  else { console.error(`   ❌ ${label}`); failures++; }
}

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`); return null; }
  return data.session.access_token;
}
async function api(token: string, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try { json = await res.json(); } catch { json = { error: await res.text() }; }
  return { status: res.status, json };
}

async function main() {
  console.log('🧾 Workqueue withholding smoke test\n');
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: customer } = await admin.from('customer').select('id').eq('email', 'customer.test@example.com').maybeSingle();
  if (!customer) { console.error('❌ customer.test not found'); process.exit(1); }
  console.log(`📌 customer: ${customer.id}`);

  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);

  const operatorToken = await login('operator.test@aipajak.com');
  if (!operatorToken) process.exit(1);

  console.log('\n━━ 1. quick-create PPh23 ━━');
  const cr = await api(operatorToken!, 'POST', '/api/operator/queue', {
    customerId: customer.id, taxType: 'PPh23', month: SENTINEL_MONTH, year: SENTINEL_YEAR,
  });
  console.log(`   ${cr.status}`);
  const qid = (cr.json.data as { id?: string } | undefined)?.id;
  assert(cr.json.success === true && !!qid, 'quick-create returns queue id');
  if (!qid) { console.error('❌ no queue id'); process.exit(1); }

  console.log('\n━━ 2. GET withholding shape ━━');
  const detail = await api(operatorToken!, 'GET', `/api/operator/workqueue/${qid}/withholding`);
  console.log(`   ${detail.status}`);
  assert(detail.json.success === true, 'withholding detail success');
  const d = detail.json.data as { summary?: { txnCount?: unknown }; rows?: unknown } | undefined;
  assert(typeof d?.summary?.txnCount === 'number', 'summary.txnCount is number');
  assert(Array.isArray(d?.rows), 'rows is array');

  console.log('\n━━ 3. request → PENDING_DOCS ━━');
  const rq = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, { message: '[WQ-WH-E2E] 원천세 증빙 요청' });
  console.log(`   ${rq.status}`);
  assert(rq.json.success === true && (rq.json.data as { status?: string })?.status === 'PENDING_DOCS', 'request → PENDING_DOCS');
  const rqBad = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, {});
  assert(rqBad.status === 400, 'request without message → 400');

  console.log('\n━━ 4. RBAC: customer → 403 ━━');
  const customerToken = await login('customer.test@example.com');
  if (customerToken) {
    const forbidden = await api(customerToken, 'GET', `/api/operator/workqueue/${qid}/withholding`);
    console.log(`   ${forbidden.status}`);
    assert(forbidden.status === 403, 'non-operator gets 403');
  } else { console.error('   ⚠️ customer.test login failed'); failures++; }

  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', qid);
  console.log(`   deleted sentinel queue row ${qid}`);

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures} assertion(s) failed.`); process.exit(1); }
  console.log('\n✅ PASS — workqueue withholding contract verified.');
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
```

- [ ] **Step 2: Run against local dev server (prod Supabase)**

Start dev (`.env.local` already points at prod Supabase): `npm run dev` in one shell; wait for `/api/health` = 200.
Run: `SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-workqueue-withholding.ts`
Expected: `✅ PASS` (all asserts). Stop the dev server after.

- [ ] **Step 3: Add to integrated runner**

`scripts/test-smoke-all.ts` 의 workqueue PPh21 step 바로 아래에 추가:
```typescript
  { name: 'workqueue withholding (quick-create + detail + request + RBAC)', file: 'test-workqueue-withholding.ts' },
```

- [ ] **Step 4: Commit**

```bash
git add scripts/test-workqueue-withholding.ts scripts/test-smoke-all.ts
git commit -m "test(operator): workqueue withholding prod smoke + runner integration"
```

---

## Self-Review 결과 (작성자 체크)

- **Spec 커버리지**: 이슈 판정 4기준(T1) · GET 상세+증빙 invoice_document_id(T2) · 요약 4카드+regime/상태 필터+표+요청+증빙모달(T3) · taxView 일반화+사이드바 활성화(T4) · i18n(T5) · smoke(T6). 스펙 항목 모두 태스크 있음.
- **비범위 준수**: PPh26/22/15, AI 게이트, 승인 반려 루프 — 태스크 없음(의도).
- **타입 일관성**: `WithholdingRow`/`WithholdingDetail`(T3 types)가 T2 응답·T3 소비와 일치. `evaluateWithholdingFlags` 시그니처(T1)가 T2 호출과 일치. `TAX_VIEW_TO_TYPE`(T3)가 T4 fetch 에서 사용.
- **단순화(스펙 대비)**: 증빙 첨부 판정을 document 배치조회 → `pph23_transaction.invoice_document_id` 컬럼 직접 사용으로 축소(조인 제거). 스펙의 "확인 지점 1"은 이 컬럼 발견으로 해소.
- **확인 지점(구현 중)**: (a) invoice-photo GET 응답 key(T3 Step4). (b) build 시 route 등장 확인(T4 Step3).
```
