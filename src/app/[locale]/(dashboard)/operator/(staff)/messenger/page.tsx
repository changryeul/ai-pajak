'use client';

/**
 * 운영팀 메신저 — 3-pane.
 *
 * PDF 「Ai Pajak 상담원화면 (메신저)」 ⑤번 메뉴.
 *
 * 좌:  내 케이스 리스트 (검색 + unread)
 * 중:  채널 탭 (CUSTOMER / INTERNAL) + 메시지 + composer
 * 우:  고객 컨텍스트 카드
 *
 * 보안: 모든 마스킹/RLS 는 서버사이드. 이 페이지는 API 가 돌려주는 row 를
 * 그대로 표시할 뿐이며, INTERNAL/CUSTOMER 채널 분리는 표시 필터일 뿐
 * 권한 게이트가 아니다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Search,
  Send,
  Lock,
  Eye,
  Building2,
  User as UserIcon,
  FileText,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Channel = 'CUSTOMER' | 'INTERNAL';

interface CaseItem {
  id: string;
  case_code: string | null;
  service_label: string;
  status: string;
  priority: string;
  due_date: string | null;
  customer: { id: string; name: string; type: string | null };
}

interface Message {
  id: string;
  customer_id: string;
  case_id: string | null;
  channel: Channel;
  sender_user_id: string;
  sender_role: 'OPERATOR' | 'SUPERVISOR' | 'CUSTOMER' | 'SYSTEM';
  display_sender: 'AI_PAJAK' | 'OPERATOR' | 'SUPERVISOR' | 'CUSTOMER' | 'SYSTEM';
  body: string;
  reason_code: string | null;
  attachment_url: string | null;
  read_at_by_operator: string | null;
  read_at_by_customer: string | null;
  created_at: string;
}

interface CustomerSummary {
  id: string;
  name: string;
  npwp: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY' | null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function MessengerPage() {
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('messenger');
  const tStatus = useTranslations('operatorStaff.caseStatus');

  // ── left pane: assigned cases ──
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);

  // ── middle pane: messages ──
  const [channel, setChannel] = useState<Channel>('CUSTOMER');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── right pane: customer detail ──
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);

  // Load my cases once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCases(true);
      try {
        const r = await fetch('/api/operator/my-cases');
        const j = await r.json();
        if (!cancelled && j.success) {
          const items = (j.data?.items ?? []) as CaseItem[];
          setCases(items);
          if (items.length > 0 && !selectedCase) setSelectedCase(items[0]);
        }
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selected case changes, refresh messages + customer card.
  const loadMessages = useCallback(async (customerId: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/operator/messages?customerId=${customerId}&limit=200`);
      const j = await r.json();
      if (j.success) setMessages((j.data?.messages ?? []) as Message[]);
      else setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCase) {
      setMessages([]);
      setCustomer(null);
      return;
    }
    void loadMessages(selectedCase.customer.id);
    // best-effort customer summary; non-blocking
    (async () => {
      try {
        const r = await fetch(`/api/customers/${selectedCase.customer.id}`);
        const j = await r.json();
        if (j?.data) {
          setCustomer({
            id: j.data.id,
            name: j.data.name ?? selectedCase.customer.name,
            npwp: j.data.npwp ?? null,
            customer_type: j.data.customer_type ?? selectedCase.customer.type ?? null,
          });
        } else {
          setCustomer({
            id: selectedCase.customer.id,
            name: selectedCase.customer.name,
            npwp: null,
            customer_type: (selectedCase.customer.type as 'INDIVIDUAL' | 'COMPANY' | null) ?? null,
          });
        }
      } catch {
        setCustomer({
          id: selectedCase.customer.id,
          name: selectedCase.customer.name,
          npwp: null,
          customer_type: (selectedCase.customer.type as 'INDIVIDUAL' | 'COMPANY' | null) ?? null,
        });
      }
    })();
  }, [selectedCase, loadMessages]);

  // Auto-scroll to newest on channel/message change.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, channel]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      c.customer.name.toLowerCase().includes(q) ||
      (c.case_code ?? '').toLowerCase().includes(q),
    );
  }, [cases, search]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.channel === channel),
    [messages, channel],
  );

  const handleSend = useCallback(async () => {
    if (!selectedCase || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/operator/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCase.customer.id,
          caseId: selectedCase.id,
          channel,
          body: draft.trim(),
          ...(reasonCode.trim() ? { reasonCode: reasonCode.trim().slice(0, 50) } : {}),
        }),
      });
      const j = await res.json();
      if (res.ok && j.success) {
        setMessages((prev) => [...prev, j.data as Message]);
        setDraft('');
        setReasonCode('');
      } else {
        // surface the server error inline; cheap toast — keep one line
        // eslint-disable-next-line no-alert
        alert(j?.error ?? 'Send failed');
      }
    } finally {
      setSending(false);
    }
  }, [selectedCase, draft, sending, channel, reasonCode]);

  const renderSender = (m: Message): string => {
    return t(`sender.${m.display_sender}`);
  };

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[560px] grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* ─── LEFT: cases ─── */}
      <aside className="flex min-h-0 flex-col rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3">
          <h2 className="text-sm font-bold text-slate-800">{t('list.title')}</h2>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs outline-none focus:border-blue-300 focus:bg-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingCases ? (
            <div className="flex h-32 items-center justify-center text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filteredCases.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">{t('empty.noCases')}</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filteredCases.map((c) => {
                const isActive = selectedCase?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedCase(c)}
                      className={cn(
                        'flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors',
                        isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="flex w-full items-center gap-2">
                        {c.customer.type === 'COMPANY' ? (
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span className={cn('flex-1 truncate text-xs font-semibold', isActive ? 'text-blue-700' : 'text-slate-800')}>
                          {c.customer.name}
                        </span>
                      </div>
                      <div className="flex w-full items-center gap-1.5">
                        {c.case_code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                            {c.case_code}
                          </span>
                        )}
                        <span className="truncate text-[10px] text-slate-500">{tStatus(c.status)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ─── MIDDLE: messages ─── */}
      <section className="flex min-h-0 flex-col rounded-2xl bg-white shadow-sm">
        {/* channel tabs */}
        <div className="border-b border-slate-100 px-4 pt-3">
          <div className="flex items-center gap-1">
            {(['CUSTOMER', 'INTERNAL'] as Channel[]).map((ch) => {
              const active = channel === ch;
              const Icon = ch === 'CUSTOMER' ? Eye : Lock;
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors',
                    active
                      ? ch === 'CUSTOMER'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`channel.${ch.toLowerCase()}`)}
                </button>
              );
            })}
          </div>
          <p className="pb-2 pt-1 text-[11px] text-slate-500">
            {channel === 'CUSTOMER' ? t('channel.customerHint') : t('channel.internalHint')}
          </p>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50/40 p-4">
          {!selectedCase ? (
            <p className="mt-12 text-center text-sm text-slate-400">{t('empty.pickThread')}</p>
          ) : loadingMsgs ? (
            <div className="flex h-32 items-center justify-center text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <p className="mt-12 text-center text-sm text-slate-400">{t('empty.noMessages')}</p>
          ) : (
            visibleMessages.map((m) => {
              // 발신측 정렬: CUSTOMER 채널이면 OPERATOR/SUPERVISOR/SYSTEM = 우측, CUSTOMER = 좌측
              //              INTERNAL  채널이면 SUPERVISOR = 좌측, OPERATOR/SYSTEM = 우측 (관점: operator)
              const isCustomer = m.sender_role === 'CUSTOMER';
              const isRight = !isCustomer && (m.channel === 'CUSTOMER' || m.sender_role === 'OPERATOR');
              return (
                <div
                  key={m.id}
                  className={cn('flex', isRight ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                      isRight
                        ? m.channel === 'CUSTOMER'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-white'
                        : 'bg-white text-slate-800 border border-slate-200',
                    )}
                  >
                    <div className={cn('mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide', isRight ? 'text-white/80' : 'text-slate-500')}>
                      <span>{renderSender(m)}</span>
                      {m.reason_code && (
                        <span className={cn('rounded px-1 py-px font-mono', isRight ? 'bg-white/15' : 'bg-slate-100 text-slate-600')}>
                          {m.reason_code}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{m.body}</p>
                    {m.attachment_url && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn('mt-1 inline-block text-[11px] underline', isRight ? 'text-white' : 'text-blue-600')}
                      >
                        {t('composer.attach')}
                      </a>
                    )}
                    <div className={cn('mt-1 text-[10px]', isRight ? 'text-white/70' : 'text-slate-400')}>
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* composer */}
        <div className="border-t border-slate-100 p-3">
          {selectedCase && channel === 'CUSTOMER' && (
            <p className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              <Info className="h-3 w-3" />
              {t('maskNotice')}
            </p>
          )}
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
              placeholder={channel === 'CUSTOMER' ? t('composer.placeholderCustomer') : t('composer.placeholderInternal')}
              disabled={!selectedCase || sending}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!selectedCase || !draft.trim() || sending}
              className="flex h-[42px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? t('composer.sending') : t('composer.send')}
            </button>
          </div>
          {channel === 'CUSTOMER' && (
            <input
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder={t('composer.reasonCode')}
              disabled={!selectedCase || sending}
              maxLength={50}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-blue-300 focus:bg-white"
            />
          )}
        </div>
      </section>

      {/* ─── RIGHT: customer context ─── */}
      <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <UserIcon className="h-4 w-4" />
            {t('context.title')}
          </h2>
          {!customer ? (
            <p className="text-xs text-slate-400">{t('empty.pickThread')}</p>
          ) : (
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400">Name</dt>
                <dd className="font-semibold text-slate-800">{customer.name}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('context.type')}</dt>
                <dd className="text-slate-700">{customer.customer_type ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('context.npwp')}</dt>
                <dd className="font-mono text-slate-700">{customer.npwp ?? '—'}</dd>
              </div>
              <div className="pt-1">
                <Link
                  href={`/${locale}/customers/${customer.id}`}
                  className="inline-block rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  → Customer profile
                </Link>
              </div>
            </dl>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <FileText className="h-4 w-4" />
            {t('context.caseCode')}
          </h2>
          {!selectedCase ? (
            <p className="text-xs text-slate-400">{t('context.noCase')}</p>
          ) : (
            <div className="space-y-2 text-xs">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400">Code</dt>
                <dd className="font-mono text-slate-700">{selectedCase.case_code ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400">Status</dt>
                <dd className="text-slate-700">{tStatus(selectedCase.status)}</dd>
              </div>
              {selectedCase.due_date && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400">Due</dt>
                  <dd className="text-slate-700">{selectedCase.due_date}</dd>
                </div>
              )}
              <Link
                href={`/${locale}/operator/review-case/${selectedCase.id}`}
                className="mt-1 inline-block rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                → {t('context.openCase')}
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
