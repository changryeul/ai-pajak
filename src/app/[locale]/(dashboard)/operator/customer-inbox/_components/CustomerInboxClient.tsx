'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send, CheckCircle, MessageCircle, Sparkles, MessageSquare } from 'lucide-react';
import type { ThreadWithCustomerDTO, MessageDTO, ThreadStatus } from '@/types/customer-ai';
import type { CustomerAiTemplateDTO } from '@/types/customer-ai-template';

// Phase 2.2: draft history DTO returned by GET /drafts.
interface DraftDTO {
  id: string;
  draftText: string;
  source: 'manual' | 'auto';
  status: 'active' | 'dismissed' | 'applied';
  generatedAt: string;
}

const POLL_MS = 5_000;

function statusTone(status: ThreadStatus): string {
  if (status === 'AWAITING_OPERATOR') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'RESPONDED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';  // RESOLVED
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CustomerInboxClient() {
  const t = useTranslations('operatorCustomerInbox');
  const [threads, setThreads] = useState<ThreadWithCustomerDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafts, setDrafts] = useState<DraftDTO[]>([]);
  const [creatingSpt, setCreatingSpt] = useState(false);
  const [sptResult, setSptResult] = useState<{ ok: boolean; text: string } | null>(null);
  // SPT Masa 검토 대기 요청 (옵션 B). 운영팀이 어디부터 손대야 할지 한눈에.
  const [pendingRequests, setPendingRequests] = useState<Array<{
    id: string; customerId: string; customerName: string; taxType: string;
    taxPeriod: string; requestedAt: string; threadId: string | null; pendingSeconds: number | null;
  }>>([]);
  // Phase 2.4: snippet templates (managed by MASTER at
  // /admin/master/customer-ai-templates). One-shot fetch on mount.
  const [templates, setTemplates] = useState<CustomerAiTemplateDTO[]>([]);

  const selectedThread = threads.find((th) => th.id === selectedId) ?? null;

  const fetchThreads = useCallback(async () => {
    const r = await fetch('/api/operator/customer-inbox/threads');
    if (r.ok) {
      const j = await r.json();
      setThreads(j.data ?? []);
    }
  }, []);

  const fetchMessages = useCallback(async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const r = await fetch(`/api/operator/customer-inbox/threads/${threadId}/messages`);
      if (r.ok) {
        const j = await r.json();
        setMessages(j.data ?? []);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Phase 2.2: draft history loader.
  const loadDrafts = useCallback(async (threadId: string) => {
    try {
      const r = await fetch(`/api/operator/customer-inbox/threads/${threadId}/drafts`);
      if (r.ok) {
        const j = await r.json();
        setDrafts(j.data ?? []);
      }
    } catch {
      /* silent — next thread change re-fetches */
    }
  }, []);

  // initial
  useEffect(() => {
    setLoadingThreads(true);
    fetchThreads().finally(() => setLoadingThreads(false));
  }, [fetchThreads]);

  // Phase 2.4: one-shot fetch of templates (rarely change; MASTER manages).
  useEffect(() => {
    fetch('/api/operator/customer-inbox/templates')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setTemplates((j.data ?? []) as CustomerAiTemplateDTO[]))
      .catch(() => {
        /* silent — dropdown just renders empty */
      });
  }, []);

  // SPT Masa 검토 대기 요청 fetch + 폴링 (스레드 와 같은 주기).
  const fetchPendingRequests = useCallback(async () => {
    try {
      const r = await fetch('/api/operator/spt-masa-requests?status=PENDING&limit=50');
      if (r.ok) {
        const j = await r.json();
        setPendingRequests(j.data ?? []);
      }
    } catch { /* silent */ }
  }, []);
  useEffect(() => { void fetchPendingRequests(); }, [fetchPendingRequests]);

  // polling threads + pending requests
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchThreads();
        void fetchPendingRequests();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchThreads, fetchPendingRequests]);

  // load messages on thread select
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      loadDrafts(selectedId);
    } else {
      setMessages([]);
      setDrafts([]);
    }
  }, [selectedId, fetchMessages, loadDrafts]);

  // polling messages of selected thread
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMessages(selectedId);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, fetchMessages]);

  const send = async () => {
    if (!selectedId || !input.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/operator/customer-inbox/threads/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (r.ok) {
        const j = await r.json();
        setMessages((prev) => [...prev, j.data]);
        setInput('');
        // refresh thread list to pick up status/unread changes
        fetchThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const generateDraft = async () => {
    if (!selectedId || drafting) return;
    setDrafting(true);
    try {
      const r = await fetch(`/api/operator/customer-inbox/threads/${selectedId}/ai-draft`, {
        method: 'POST',
      });
      if (r.ok) {
        const j = await r.json();
        if (typeof j.data?.draft === 'string') setInput(j.data.draft);
        // Phase 2.2: refresh history dropdown so the new draft pops to the top.
        loadDrafts(selectedId);
      }
    } catch {
      /* silent — operator can retry */
    } finally {
      setDrafting(false);
    }
  };

  // Phase 2.2: pick a draft (any from history) → put text in input.
  const acceptDraft = (d: DraftDTO) => {
    setInput(d.draftText);
  };

  // Phase 2.2: soft-delete a single draft row (status='dismissed').
  const dismissDraft = async (id: string) => {
    if (!selectedId) return;
    // Optimistic hide
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'dismissed' } : d)),
    );
    try {
      await fetch(`/api/operator/customer-inbox/threads/${selectedId}/drafts/${id}`, {
        method: 'DELETE',
      });
    } finally {
      loadDrafts(selectedId);
    }
  };

  const resolve = async () => {
    if (!selectedId || resolving) return;
    setResolving(true);
    try {
      const r = await fetch(`/api/operator/customer-inbox/threads/${selectedId}/resolve`, {
        method: 'POST',
      });
      if (r.ok) {
        fetchThreads();
        fetchMessages(selectedId);
      }
    } finally {
      setResolving(false);
    }
  };

  // Phase 2.2/2.3 — drafts state is the single source of truth; both ✨ and
  // the auto-trigger write to customer_ai_draft. The legacy auto_draft column
  // (Phase 2.1) was dropped in Phase 2.3 migration 20260603000006.

  return (
    <>
      {/* SPT Masa 검토 대기 패널 — 옵션 B (spt_masa_submission_request) 활용 */}
      {pendingRequests.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold uppercase px-2 py-0.5">
                SPT Masa 검토 대기
              </span>
              <span className="text-sm font-bold text-amber-900">{pendingRequests.length} 건</span>
              <span className="text-[10px] text-amber-700">
                · 가장 오래된 요청: {pendingRequests.length > 0
                  ? new Date(Math.min(...pendingRequests.map((r) => new Date(r.requestedAt).getTime()))).toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingRequests.slice(0, 12).map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => { if (req.threadId) setSelectedId(req.threadId); }}
                disabled={!req.threadId}
                className="text-left rounded-lg border border-amber-200 bg-white px-3 py-2 hover:border-amber-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                title={req.threadId ? '클릭하면 thread 로 이동' : 'thread 미연결 — 직접 검색 필요'}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">{req.customerName}</span>
                  <span className="text-[9px] font-mono text-slate-400 flex-shrink-0">{req.taxType}/{req.taxPeriod}</span>
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {req.pendingSeconds !== null && req.pendingSeconds > 3600
                    ? `${Math.floor(req.pendingSeconds / 3600)}시간 대기 중`
                    : req.pendingSeconds !== null
                      ? `${Math.floor((req.pendingSeconds ?? 0) / 60)}분 대기 중`
                      : '—'}
                </div>
              </button>
            ))}
          </div>
          {pendingRequests.length > 12 && (
            <p className="mt-2 text-[10px] text-amber-700">+{pendingRequests.length - 12} 건 더…</p>
          )}
        </div>
      )}

    <div className="grid grid-cols-[260px_1fr_300px] gap-3 h-[700px]">
      {/* Left: thread list */}
      <aside className="rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
        <header className="px-3 py-2.5 border-b border-slate-200 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-700">Threads ({threads.length})</p>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <Loader2 className="h-4 w-4 mx-auto animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">{t('threadListEmpty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.map((th) => (
                <li key={th.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(th.id)}
                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 ${selectedId === th.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">{th.customerName}</span>
                      {th.operatorUnreadCount > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5">
                          {th.operatorUnreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                      {th.displayLabel}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${statusTone(th.status)}`}>
                        {th.status === 'AWAITING_OPERATOR' ? '대기' : th.status === 'RESPONDED' ? '응답' : '해결'}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {th.lastCustomerMessageAt ? formatTs(th.lastCustomerMessageAt) : '—'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Center: thread detail */}
      <section className="rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
        {!selectedThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <MessageCircle className="h-8 w-8 opacity-30" />
            <p>{t('selectThreadHint')}</p>
          </div>
        ) : (
          <>
            <header className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <p className="text-sm font-bold text-slate-900">{selectedThread.customerName}</p>
              <p className="text-[10px] text-slate-500">{selectedThread.displayLabel}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages && (
                <div className="text-center text-xs text-slate-400 py-4">
                  <Loader2 className="h-4 w-4 mx-auto animate-spin" />
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.senderRole === 'operator' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${m.senderRole === 'operator' ? 'bg-emerald-100 text-emerald-900 rounded-br-md' : 'bg-blue-100 text-blue-900 rounded-bl-md'}`}>
                    <p className="text-[9px] font-bold uppercase tracking-wide opacity-60 mb-0.5">{m.displaySender}</p>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    <p className="text-[10px] mt-1 opacity-60">
                      {new Date(m.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {selectedThread.status !== 'RESOLVED' && (
              <div className="border-t p-3 flex-shrink-0">
                {/* Phase 2.2/2.3: latest draft pill + history dropdown.
                    Source of truth = drafts state from customer_ai_draft. */}
                {(() => {
                  const activeDrafts = drafts.filter((d) => d.status === 'active');
                  const latest = activeDrafts[0];
                  if (!latest && activeDrafts.length === 0) return null;
                  return (
                    <div className="mb-2 space-y-1">
                      {latest && !drafting && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-sm">
                          <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="text-purple-900 truncate flex-1">
                            {latest.draftText.slice(0, 80)}
                            {latest.draftText.length > 80 ? '…' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => acceptDraft(latest)}
                            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
                          >
                            {t('autoDraftAccept')}
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissDraft(latest.id)}
                            className="px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-100 text-xs"
                          >
                            {t('autoDraftDismiss')}
                          </button>
                        </div>
                      )}
                      {activeDrafts.length > 1 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-purple-700 hover:text-purple-900 px-2 py-1 select-none">
                            {t('draftHistoryToggle', { count: activeDrafts.length - 1 })}
                          </summary>
                          <ul className="mt-1 space-y-1 max-h-48 overflow-y-auto bg-white border border-purple-100 rounded p-2">
                            {activeDrafts.slice(1).map((d) => (
                              <li key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-purple-50">
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {new Date(d.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] text-gray-500 shrink-0 uppercase">
                                  {d.source === 'manual' ? '✨' : t('draftSourceAuto')}
                                </span>
                                <span className="text-xs text-gray-700 flex-1 truncate">
                                  {d.draftText.slice(0, 60)}
                                  {d.draftText.length > 60 ? '…' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => acceptDraft(d)}
                                  className="text-[10px] text-purple-600 hover:underline"
                                >
                                  {t('autoDraftAccept')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dismissDraft(d.id)}
                                  className="text-[10px] text-gray-400 hover:text-red-600"
                                  aria-label={t('autoDraftDismiss')}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })()}
                {/* Phase 2.4: template snippets dropdown — same vertical
                    position as Phase 2.2 draft history (above input). Click
                    a row to load text into the input (operator can still edit
                    before sending). MASTER manages the list. */}
                {templates.length > 0 && (
                  <details className="mb-2 text-xs">
                    <summary className="cursor-pointer text-emerald-700 hover:text-emerald-900 px-2 py-1 select-none inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t('templatesDropdownToggle', { count: templates.length })}
                    </summary>
                    <ul className="mt-1 space-y-1 max-h-48 overflow-y-auto bg-white border border-emerald-100 rounded p-2">
                      {templates.map((tpl) => (
                        <li
                          key={tpl.id}
                          onClick={() => setInput(tpl.body)}
                          className="flex items-start gap-2 p-2 rounded hover:bg-emerald-50 cursor-pointer"
                        >
                          <span className="text-xs font-medium text-emerald-900 shrink-0">
                            {tpl.title}
                          </span>
                          {tpl.category && (
                            <span className="text-[10px] text-emerald-600 shrink-0">
                              [{tpl.category}]
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 flex-1 truncate">
                            {tpl.body.slice(0, 60)}
                            {tpl.body.length > 60 ? '…' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder={drafting ? t('aiDraftLoading') : t('replyPlaceholder')}
                    disabled={sending || drafting}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
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
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="rounded-xl bg-blue-600 text-white px-3 disabled:opacity-50"
                    aria-label={t('send')}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Right: customer info + resolve */}
      <aside className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
        {!selectedThread ? (
          <p className="text-xs text-slate-400 text-center mt-8">{t('selectThreadHint')}</p>
        ) : (
          <>
            <section>
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{t('customerInfoHeader')}</h2>
              <p className="text-sm font-semibold text-slate-900">{selectedThread.customerName}</p>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{selectedThread.customerId.slice(0, 13)}…</p>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{t('metadataHeader')}</h2>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between"><dt className="text-slate-500">Kind</dt><dd className="font-bold">{selectedThread.contextKind}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Period</dt><dd className="font-mono">{selectedThread.contextPeriod}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${statusTone(selectedThread.status)}`}>
                      {selectedThread.status}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-slate-500">Unread (me)</dt><dd>{selectedThread.operatorUnreadCount}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Unread (cust)</dt><dd>{selectedThread.customerUnreadCount}</dd></div>
              </dl>
            </section>
            {/* SPT Masa quick-create — pendingRequests 기반. 한 thread 에 PPh23 +
                PPh42 등 여러 type 이 동시에 PENDING 이면 각각 별도 버튼. */}
            {(() => {
              const threadPending = pendingRequests.filter((r) =>
                r.customerId === selectedThread.customerId && r.taxPeriod === selectedThread.contextPeriod,
              );
              if (threadPending.length === 0) return null;
              return (
                <section>
                  <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">SPT Masa 생성</h2>
                  <div className="space-y-1.5">
                    {threadPending.map((req) => (
                      <button
                        key={req.id}
                        type="button"
                        disabled={creatingSpt}
                        onClick={async () => {
                          setCreatingSpt(true);
                          setSptResult(null);
                          try {
                            const res = await fetch('/api/operator/spt-masa/create', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                customerId: req.customerId,
                                taxType: req.taxType,
                                period: req.taxPeriod,
                              }),
                            });
                            const j = await res.json().catch(() => ({}));
                            if (res.ok && j.success) {
                              setSptResult({ ok: true, text: `${req.taxType} 생성 완료 — Filing ${String(j.filingId).slice(0, 8)} (actor: ${j.actor?.consultantName ?? '?'})` });
                              await fetch(`/api/operator/customer-inbox/threads/${selectedThread.id}/messages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  content: `✅ SPT Masa ${req.taxType} ${req.taxPeriod} 생성 완료 — Filing ID ${String(j.filingId).slice(0, 8)}. 운영팀 큐에서 다음 단계 (eBilling/DJP) 진행합니다.`,
                                }),
                              }).catch(() => { /* silent */ });
                              await fetchMessages(selectedThread.id);
                              await fetchPendingRequests();
                            } else {
                              setSptResult({ ok: false, text: j.message || j.error || `HTTP ${res.status}` });
                            }
                          } catch (err) {
                            setSptResult({ ok: false, text: err instanceof Error ? err.message : 'unknown' });
                          } finally {
                            setCreatingSpt(false);
                          }
                        }}
                        className="w-full rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {creatingSpt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        {req.taxType} → SPT Masa 생성
                      </button>
                    ))}
                  </div>
                  {sptResult && (
                    <p className={`mt-1 text-[10px] ${sptResult.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                      {sptResult.text}
                    </p>
                  )}
                </section>
              );
            })()}

            {selectedThread.status !== 'RESOLVED' && (
              <button
                type="button"
                onClick={resolve}
                disabled={resolving}
                className="mt-auto rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {t('markResolved')}
              </button>
            )}
          </>
        )}
      </aside>
    </div>
    </>
  );
}
