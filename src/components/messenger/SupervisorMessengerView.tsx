'use client';

/**
 * Supervisor ↔ Operator 내부 메신저.
 *
 * PDF 「수퍼바이저 화면 메신저 포함 20260525」 p.21 spec:
 *   • 좌: 메신저 상담원 선택 (안내: "Supervisor의 대화 상대는 고객사가
 *     아니라 상담원입니다.")
 *   • 중상: 선택 상담원 KPI (상담원/상태/배정 현황/안 읽음)
 *   • 중대화: "Hidden from Customer" badge + 1:1 내부 대화 + composer
 *   • 하단 안내: "Supervisor 메시지는 상담원에게 내부지시로 전달됩니다.
 *     고객 메신저에는 노출되지 않습니다."
 *
 * 데이터 소스: /api/staff-messenger/threads + /messages.
 * 고객/케이스 컨텍스트는 의도적으로 표시하지 않는다 — PDF 명시 요구사항.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Search,
  Send,
  Lock,
  ShieldAlert,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientSessionContext } from '@/hooks/useSession';

interface ThreadRow {
  operator_user_id: string;
  employee_id: string | null;
  name: string;
  work_state: string | null;
  active_load: number;
  unread: number;
  last_message_at: string | null;
  last_message_body: string | null;
}

interface Message {
  id: string;
  supervisor_user_id: string;
  operator_user_id: string;
  sender_user_id: string;
  body: string;
  attachment_url: string | null;
  read_at_by_supervisor: string | null;
  read_at_by_operator: string | null;
  created_at: string;
}

interface Props {
  session: ClientSessionContext;
}

const WORK_STATE_DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  consulting: 'bg-blue-500',
  reviewing: 'bg-indigo-500',
  coretax: 'bg-purple-500',
  break: 'bg-amber-500',
  offline: 'bg-slate-400',
  resigned: 'bg-rose-500',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function SupervisorMessengerView({ session }: Props) {
  const t = useTranslations('staffMessenger');
  const tWork = useTranslations('operatorTeam.workState');

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ThreadRow | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const r = await fetch('/api/staff-messenger/threads');
      const j = await r.json();
      if (j.success && j.data?.mode === 'SUPERVISOR') {
        const list = (j.data.threads ?? []) as ThreadRow[];
        setThreads(list);
        if (!selected && list.length > 0) setSelected(list[0]);
      } else if (j.success) {
        setThreads([]);
      }
    } finally {
      setLoadingThreads(false);
    }
    // selected 의존성을 제외 — 첫 1회만 default 선택
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const loadMessages = useCallback(
    async (operatorUserId: string) => {
      setLoadingMsgs(true);
      try {
        const r = await fetch(
          `/api/staff-messenger/messages?counterpartyUserId=${operatorUserId}&limit=200`,
        );
        const j = await r.json();
        if (j.success) setMessages((j.data?.messages ?? []) as Message[]);
        else setMessages([]);
      } finally {
        setLoadingMsgs(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    void loadMessages(selected.operator_user_id);
  }, [selected, loadMessages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.employee_id ?? '').toLowerCase().includes(q),
    );
  }, [threads, search]);

  const workStateLabel = (key: string | null) => {
    if (!key) return '—';
    try {
      return tWork(key);
    } catch {
      return key;
    }
  };

  const handleSend = useCallback(async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/staff-messenger/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyUserId: selected.operator_user_id,
          body: draft.trim(),
        }),
      });
      const j = await res.json();
      if (res.ok && j.success) {
        setMessages((prev) => [...prev, j.data as Message]);
        setDraft('');
        // refresh thread last/unread
        void loadThreads();
      } else {
        // eslint-disable-next-line no-alert
        alert(j?.error ?? 'Send failed');
      }
    } finally {
      setSending(false);
    }
  }, [selected, draft, sending, loadThreads]);

  return (
    <div className="grid h-[calc(100vh-180px)] min-h-[600px] grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* ─── LEFT: staff picker ─── */}
      <aside className="flex min-h-0 flex-col rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-900">{t('pickerTitle')}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {t('subtitle')}
          </p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('pickerSearchPlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs outline-none focus:border-blue-300 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex h-32 items-center justify-center text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">{t('pickerEmpty')}</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filteredThreads.map((r) => {
                const isActive = selected?.operator_user_id === r.operator_user_id;
                return (
                  <li key={r.operator_user_id}>
                    <button
                      onClick={() => setSelected(r)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors',
                        isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                          WORK_STATE_DOT[r.work_state ?? 'offline'] ??
                            'bg-slate-300',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              'truncate text-sm font-semibold',
                              isActive ? 'text-blue-700' : 'text-slate-900',
                            )}
                          >
                            {r.name}
                          </span>
                          {r.unread > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              {r.unread}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {r.employee_id ?? '—'} · {workStateLabel(r.work_state)} · {t('kpiAssignment')} {r.active_load}건
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ─── MIDDLE: conversation ─── */}
      <section className="flex min-h-0 flex-col gap-3">
        {!selected ? (
          <div className="flex h-full items-center justify-center rounded-2xl bg-white shadow-sm">
            <p className="text-sm text-slate-400">{t('pickerEmpty')}</p>
          </div>
        ) : (
          <>
            {/* KPI strip + Supervisor↔Operator badge */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900">{selected.name}</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {t('threadIntro')}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  {t('badgeSupOp')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Kpi label={t('kpiOperator')} value={`${selected.name} (${selected.employee_id ?? '—'})`} />
                <Kpi label={t('kpiStatus')} value={workStateLabel(selected.work_state)} />
                <Kpi label={t('kpiAssignment')} value={`${selected.active_load}건`} />
                <Kpi label={t('kpiUnread')} value={`${selected.unread}건`} highlight={selected.unread > 0} />
              </div>
            </div>

            {/* Conversation panel with hidden-from-customer badge */}
            <div className="flex flex-1 min-h-0 flex-col rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                  <span>{selected.name}</span>
                </div>
                <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  {t('badgeHidden')}
                </span>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 space-y-2 overflow-y-auto bg-amber-50/30 p-4"
              >
                {loadingMsgs ? (
                  <div className="flex h-32 items-center justify-center text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="mt-12 text-center text-sm text-slate-400">
                    {t('threadEmpty')}
                  </p>
                ) : (
                  messages.map((m) => {
                    const fromSelf = m.sender_user_id === session.userId;
                    return (
                      <div
                        key={m.id}
                        className={cn('flex', fromSelf ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                            fromSelf
                              ? 'bg-slate-800 text-white'
                              : 'border border-slate-200 bg-white text-slate-800',
                          )}
                        >
                          <div
                            className={cn(
                              'mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide',
                              fromSelf ? 'text-white/80' : 'text-slate-500',
                            )}
                          >
                            <span>
                              {fromSelf
                                ? `Supervisor ${session.fullName ?? ''}`
                                : selected.name}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                            {m.body}
                          </p>
                          <div
                            className={cn(
                              'mt-1 text-[10px]',
                              fromSelf ? 'text-white/70' : 'text-slate-400',
                            )}
                          >
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-slate-100 p-3">
                <p className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                  <ShieldAlert className="h-3 w-3" />
                  {t('securityNote')}
                </p>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={t('composerPlaceholder')}
                    rows={2}
                    disabled={sending}
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!draft.trim() || sending}
                    className="flex h-[42px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sending
                      ? t('composerSending')
                      : t('composerSend', { name: selected.name })}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2',
        highlight ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50',
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm font-semibold',
          highlight ? 'text-rose-700' : 'text-slate-800',
        )}
      >
        {value}
      </p>
    </div>
  );
}
