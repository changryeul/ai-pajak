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
      const m = await fetch(`/api/customer-ai/threads/${j.data.id}/messages`);
      const mj = await m.json();
      setMessages(mj.data ?? []);
      setUnreadCount(0);
    } catch {
      // silent — could add toast later
    } finally {
      setLoading(false);
    }
  }, [ctx.kind, ctx.period]);

  // Polling while panel open + tab visible
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // silent for v1
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
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm">{t('title')}</h3>
          <p className="text-xs text-blue-200 mt-0.5">{statusLabel}</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5 truncate">{t('linkedTask')}: {ctx.label}</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded flex-shrink-0"
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="text-center text-xs text-gray-400 py-4">{t('loading')}</div>
        )}
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
          <button
            type="button"
            onClick={send}
            disabled={sending || !input.trim() || !thread}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 disabled:opacity-50"
            aria-label={t('send')}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerAiChat;
