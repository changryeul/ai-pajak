'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageCircle, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Message { id: string; sender_user_id: string; message_text: string; created_at: string; }

export default function ChatPage() {
  const t = useTranslations('pages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/messages?limit=50').then(r => r.json()).then(d => {
      if (d.success) setMessages(d.data.messages || []);
    }).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      // For demo, send to self (in production, select recipient)
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId: 'demo', message: input }),
      });
      const data = await res.json();
      if (data.success) { setMessages(prev => [...prev, data.data]); setInput(''); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <MessageCircle className="h-6 w-6 text-blue-600" />{t('messagesTitle')}
      </h1>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('noMessages')}</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className="flex gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[80%]">
                  <p className="text-sm">{m.message_text}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3 flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={t('typeMessage')} className="rounded-xl" disabled={isLoading} />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="sm" className="rounded-xl px-3">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
