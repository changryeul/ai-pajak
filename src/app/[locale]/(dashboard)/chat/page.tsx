'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send, Loader2, Sparkles, User, Bot, MessageCircle,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const t = useTranslations('killer');
  const tc = useTranslations('chatPage');
  const QUICK_QUESTIONS = [
    tc('q1'),
    tc('q2'),
    tc('q3'),
    tc('q4'),
    tc('q5'),
    tc('q6'),
  ];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMsg: ChatMessage = { role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.data?.response || data.response || tc('cannotGenerate'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('chat.errorMsg'),
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-indigo-700 to-purple-900 p-6 text-white mb-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-blue-300 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />{t('chat.header')}
          </p>
          <h1 className="text-2xl font-bold mt-1">{t('chat.title')}</h1>
          <p className="text-blue-300 mt-1 text-sm">{t('chat.subtitle')}</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-[450px] overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-blue-200 mx-auto mb-4" />
                <p className="text-sm text-gray-500 mb-4">{t('chat.emptyState')}</p>
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs text-left bg-blue-50 text-blue-700 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {m.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {m.role === 'user' && (
                  <div className="p-1.5 bg-gray-200 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t('chat.placeholder')}
              aria-label="Chat message input"
              className="rounded-xl"
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              size="sm"
              className="rounded-xl px-4 bg-blue-600 hover:bg-blue-700"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
