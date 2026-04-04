'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Send, Loader2, Bot, User, AlertTriangle,
  CheckCircle, RotateCcw, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimMessage {
  role: 'auditor' | 'taxpayer' | 'system';
  content: string;
}

const AUDIT_SCENARIOS = [
  { id: 'pph21', label: 'PPh 21 급여 감사', desc: 'Bukti Potong vs 급여 대장 대조', icon: '💼' },
  { id: 'ppn', label: 'PPN Faktur 감사', desc: 'e-Faktur 일치 여부 확인', icon: '🧾' },
  { id: 'tp', label: 'Transfer Pricing 감사', desc: '특수관계자 거래 arm\'s length 검증', icon: '🔄' },
  { id: 'umkm', label: 'UMKM 매출 감사', desc: '실제 매출 vs 신고 매출 대조', icon: '🏪' },
  { id: 'general', label: '일반 종합 감사', desc: '소득/공제/원천징수 전반 검토', icon: '📋' },
];

const INITIAL_QUESTIONS: Record<string, string> = {
  pph21: 'Selamat pagi, Bapak/Ibu. Saya pemeriksa pajak dari KPP. Kami akan memeriksa kepatuhan PPh 21 perusahaan Anda tahun pajak 2025. Pertama, mohon jelaskan jumlah karyawan dan total gaji bruto yang dilaporkan di SPT Masa PPh 21.',
  ppn: 'Selamat pagi. Kami akan memeriksa kewajiban PPN perusahaan Anda. Mohon jelaskan berapa jumlah Faktur Pajak Keluaran dan Masukan yang diterbitkan pada tahun pajak 2025, serta total DPP masing-masing.',
  tp: 'Selamat pagi. Pemeriksaan ini terkait transaksi dengan pihak afiliasi. Mohon jelaskan hubungan Anda dengan pihak afiliasi dan jenis transaksi yang dilakukan, beserta nilainya.',
  umkm: 'Selamat pagi. Kami akan memeriksa kepatuhan PPh Final UMKM. Mohon jelaskan omzet bulanan Anda selama tahun 2025 dan bagaimana Anda mencatatnya.',
  general: 'Selamat pagi, Bapak/Ibu. Saya pemeriksa pajak yang ditugaskan untuk memeriksa SPT Tahunan Anda. Pertama, mohon jelaskan sumber penghasilan utama Anda dan total penghasilan bruto yang dilaporkan.',
};

export default function AuditSimulationPage() {
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startScenario = (id: string) => {
    setScenario(id);
    setScore(null);
    setMessages([
      { role: 'system', content: `시나리오: ${AUDIT_SCENARIOS.find(s => s.id === id)?.label}` },
      { role: 'auditor', content: INITIAL_QUESTIONS[id] },
    ]);
  };

  const sendResponse = async () => {
    if (!input.trim() || !scenario) return;

    const taxpayerMsg: SimMessage = { role: 'taxpayer', content: input };
    setMessages(prev => [...prev, taxpayerMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, taxpayerMsg].filter(m => m.role !== 'system');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `You are a DJP tax auditor conducting a ${scenario} audit simulation in Indonesian. The taxpayer just responded. Continue the audit questioning. Be realistic but educational. After 4-5 exchanges, provide a score (0-100) and summary of how well the taxpayer handled the audit. Current exchange count: ${history.length}.\n\nConversation so far:\n${history.map(m => `${m.role === 'auditor' ? 'Pemeriksa' : 'Wajib Pajak'}: ${m.content}`).join('\n')}` },
          ],
        }),
      });

      const data = await res.json();
      const response = data.data?.response || data.response || '';

      // Check if response contains a score
      const scoreMatch = response.match(/skor[:\s]*(\d+)/i) || response.match(/score[:\s]*(\d+)/i);
      if (scoreMatch) {
        setScore(parseInt(scoreMatch[1]));
      }

      setMessages(prev => [...prev, { role: 'auditor', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'auditor', content: 'Maaf, terjadi kesalahan teknis. Silakan coba lagi.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setScenario(null);
    setMessages([]);
    setScore(null);
    setInput('');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-800 via-red-700 to-orange-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-red-300 text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />Tax Audit Simulator
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">세무조사 시뮬레이션</h1>
          <p className="text-red-300 mt-2 text-sm">AI가 DJP 감사관 역할을 합니다. 실전처럼 연습하세요.</p>
        </div>
      </div>

      {/* Scenario Selection */}
      {!scenario ? (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-gray-700">시나리오를 선택하세요</h3>
          {AUDIT_SCENARIOS.map(s => (
            <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => startScenario(s.id)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
                <Badge variant="outline" className="text-xs">시작</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Score Banner */}
          {score !== null && (
            <Card className={cn('border-0 shadow-sm mb-4 border-l-4', score >= 70 ? 'border-l-green-500' : score >= 40 ? 'border-l-yellow-500' : 'border-l-red-500')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {score >= 70 ? <CheckCircle className="h-6 w-6 text-green-500" /> : <AlertTriangle className="h-6 w-6 text-yellow-500" />}
                  <div>
                    <p className="font-bold text-sm">대응 점수: {score}/100</p>
                    <p className="text-xs text-gray-500">{score >= 70 ? '양호한 대응입니다' : score >= 40 ? '보완이 필요합니다' : '준비가 부족합니다'}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={reset}>
                  <RotateCcw className="h-3 w-3 mr-1" />다시 시작
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Chat */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => {
                  if (m.role === 'system') {
                    return (
                      <div key={i} className="text-center">
                        <Badge className="text-[10px] bg-gray-100 text-gray-500">{m.content}</Badge>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`flex gap-2 ${m.role === 'taxpayer' ? 'justify-end' : ''}`}>
                      {m.role === 'auditor' && (
                        <div className="p-1.5 bg-red-100 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-3.5 w-3.5 text-red-600" />
                        </div>
                      )}
                      <div className={cn('rounded-2xl px-4 py-2.5 max-w-[80%] text-sm',
                        m.role === 'taxpayer' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-red-50 text-gray-800 rounded-bl-md'
                      )}>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      </div>
                      {m.role === 'taxpayer' && (
                        <div className="p-1.5 bg-blue-100 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex gap-2">
                    <div className="p-1.5 bg-red-100 rounded-lg h-7 w-7 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <div className="bg-red-50 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="border-t p-3 flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendResponse()}
                  placeholder="답변을 입력하세요 (인도네시아어/한국어)..."
                  disabled={isLoading}
                  className="rounded-xl"
                />
                <Button onClick={sendResponse} disabled={isLoading || !input.trim()} size="sm" className="rounded-xl px-4 bg-red-600 hover:bg-red-700">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="border-0 shadow-sm mt-4">
            <CardContent className="p-4">
              <h3 className="font-bold text-xs text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />대응 팁
              </h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>- 서류를 준비하고 정확한 숫자를 제시하세요</li>
                <li>- 모르는 것은 &quot;확인 후 답변드리겠습니다&quot;로 대응</li>
                <li>- 감사관의 질문에 직접적으로 답변하세요</li>
                <li>- 법적 근거를 인용하면 신뢰도가 올라갑니다</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
