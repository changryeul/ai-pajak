'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send, CheckCircle, MessageCircle } from 'lucide-react';
import type { ThreadWithCustomerDTO, MessageDTO, ThreadStatus } from '@/types/customer-ai';

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

  // initial
  useEffect(() => {
    setLoadingThreads(true);
    fetchThreads().finally(() => setLoadingThreads(false));
  }, [fetchThreads]);

  // polling threads
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchThreads();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchThreads]);

  // load messages on thread select
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, fetchMessages]);

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

  return (
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder={t('replyPlaceholder')}
                    disabled={sending}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
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
  );
}
