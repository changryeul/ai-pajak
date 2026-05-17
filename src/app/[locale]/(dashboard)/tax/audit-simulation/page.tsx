'use client';

/**
 * Tax audit simulation — Phase 1 upgrade.
 *
 * Flow:
 *   1. Scenario selection (PPh21 / PPN / TP / UMKM / General)
 *   2. PREP screen: risks detected from the customer's filings + document
 *      checklist + predicted questions (rule-based, no AI)
 *   3. CHAT: per-turn 3-dimension score (evidence / clarity / compliance)
 *      for each taxpayer answer, plus an AI-generated follow-up question
 *      from the auditor
 *   4. REPORT: final averages + improvement actions
 *
 * Back-end: /api/tax/audit-simulation (mode=prepare | turn).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Send, Loader2, User, AlertTriangle, CheckCircle, RotateCcw,
  FileText, ChevronRight, TrendingUp, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditPrep, AuditScenarioId } from '@/lib/audit/risk-detector';
import { CHART_ACCENT_POSITIVE, CHART_ACCENT_NEGATIVE } from '@/lib/charts/palette';
import { TrendBadge } from '@/components/ui/TrendBadge';

// Score tier — "passing" baseline for the audit simulation overall score
// (out of 100). Below this is a soft-fail (vermillion delta), above is good
// (bluish-green delta). Lets the report card surface a single, glanceable
// 'how am I doing?' chip without forcing the user to read the raw number.
const SCORE_PASS_THRESHOLD = 60;

interface TurnScore {
  evidence: number;
  clarity: number;
  compliance: number;
}

interface SimMessage {
  role: 'auditor' | 'taxpayer' | 'system';
  content: string;
  score?: TurnScore;
}

const AUDIT_SCENARIOS: Array<{ id: AuditScenarioId; labelKey: string; descKey: string; icon: string }> = [
  { id: 'pph21', labelKey: 'auditSim.scenarioPph21', descKey: 'auditSim.scenarioPph21Desc', icon: '💼' },
  { id: 'ppn', labelKey: 'auditSim.scenarioPpn', descKey: 'auditSim.scenarioPpnDesc', icon: '🧾' },
  { id: 'tp', labelKey: 'auditSim.scenarioTp', descKey: 'auditSim.scenarioTpDesc', icon: '🔄' },
  { id: 'umkm', labelKey: 'auditSim.scenarioUmkm', descKey: 'auditSim.scenarioUmkmDesc', icon: '🏪' },
  { id: 'general', labelKey: 'auditSim.scenarioGeneral', descKey: 'auditSim.scenarioGeneralDesc', icon: '📋' },
];

const INITIAL_QUESTIONS: Record<AuditScenarioId, string> = {
  pph21: 'Selamat pagi, Bapak/Ibu. Saya pemeriksa pajak dari KPP. Kami akan memeriksa kepatuhan PPh 21 perusahaan Anda. Pertama, mohon jelaskan jumlah karyawan dan total gaji bruto yang dilaporkan di SPT Masa PPh 21.',
  ppn: 'Selamat pagi. Kami akan memeriksa kewajiban PPN Anda. Mohon jelaskan berapa jumlah Faktur Pajak Keluaran dan Masukan yang diterbitkan tahun pajak ini, serta total DPP masing-masing.',
  tp: 'Selamat pagi. Pemeriksaan ini terkait transaksi dengan pihak afiliasi. Mohon jelaskan hubungan Anda dengan pihak afiliasi dan jenis transaksi yang dilakukan.',
  umkm: 'Selamat pagi. Kami akan memeriksa kepatuhan PPh Final UMKM. Mohon jelaskan omzet bulanan Anda selama tahun pajak ini dan bagaimana Anda mencatatnya.',
  general: 'Selamat pagi, Bapak/Ibu. Saya pemeriksa pajak yang ditugaskan untuk memeriksa SPT Tahunan Anda. Pertama, mohon jelaskan sumber penghasilan utama Anda dan total penghasilan bruto yang dilaporkan.',
};

type Stage = 'select' | 'prep' | 'chat' | 'report';

// Colorblind-safe severity color helper. 'high' uses vermillion-derived
// fills instead of red, so deuteranopic users can distinguish high vs the
// medium amber and low blue tones.
function severityColor(sev: 'low' | 'medium' | 'high') {
  return sev === 'high'
    ? 'border'   // bg + text applied via inline style for high tier
    : sev === 'medium'
    ? 'bg-amber-50 border border-amber-200 text-amber-900'
    : 'bg-blue-50 border border-blue-200 text-blue-900';
}
function severityStyle(sev: 'low' | 'medium' | 'high'): React.CSSProperties | undefined {
  if (sev === 'high') {
    return {
      backgroundColor: '#FBE0D0',
      borderColor: '#F4A878',
      color: '#A04400',
    };
  }
  return undefined;
}
function avg(arr: number[]): number {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

export default function AuditSimulationPage() {
  const t = useTranslations('killer');
  const tSim = useTranslations('auditSimV2');

  const [stage, setStage] = useState<Stage>('select');
  const [scenario, setScenario] = useState<AuditScenarioId | null>(null);
  const [prep, setPrep] = useState<AuditPrep | null>(null);
  const [loadingPrep, setLoadingPrep] = useState(false);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const pickScenario = useCallback(async (id: AuditScenarioId) => {
    setScenario(id);
    setStage('prep');
    setPrep(null);
    setLoadingPrep(true);
    try {
      const res = await fetch('/api/tax/audit-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'prepare', scenarioId: id }),
      });
      const data = await res.json();
      if (data.success) setPrep(data.data as AuditPrep);
    } finally {
      setLoadingPrep(false);
    }
  }, []);

  const startChat = useCallback(() => {
    if (!scenario) return;
    setStage('chat');
    setDone(false);
    setMessages([
      { role: 'system', content: `시나리오: ${t(AUDIT_SCENARIOS.find((s) => s.id === scenario)!.labelKey)}` },
      { role: 'auditor', content: INITIAL_QUESTIONS[scenario] },
    ]);
  }, [scenario, t]);

  const sendResponse = useCallback(async () => {
    if (!input.trim() || !scenario) return;
    const taxpayer: SimMessage = { role: 'taxpayer', content: input };
    setMessages((prev) => [...prev, taxpayer]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, taxpayer].filter((m) => m.role !== 'system').map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch('/api/tax/audit-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'turn',
          scenarioId: scenario,
          messages: history,
          lastResponse: userInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const { score, auditorFollowup, done: isDone } = data.data as {
          score: TurnScore;
          auditorFollowup: string;
          done: boolean;
        };
        setMessages((prev) => {
          // attach score to the latest taxpayer message
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'taxpayer' && !copy[i].score) {
              copy[i] = { ...copy[i], score };
              break;
            }
          }
          copy.push({ role: 'auditor', content: auditorFollowup });
          return copy;
        });
        if (isDone) setDone(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [input, scenario, messages]);

  const finishSim = () => setStage('report');
  const reset = () => {
    setStage('select');
    setScenario(null);
    setPrep(null);
    setMessages([]);
    setInput('');
    setDone(false);
  };

  // ─── STAGE: select ───
  if (stage === 'select') {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-800 via-red-700 to-orange-900 p-6 md:p-8 text-white mb-6">
          <div className="relative z-10">
            <p className="text-red-300 text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />{t('auditSim.header')}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('auditSim.title')}</h1>
            <p className="text-red-300 mt-2 text-sm">{t('auditSim.subtitle')}</p>
          </div>
        </div>
        <h3 className="font-bold text-sm text-gray-700 mb-3">{t('auditSim.selectScenario')}</h3>
        <div className="space-y-3">
          {AUDIT_SCENARIOS.map((s) => (
            <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => pickScenario(s.id)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t(s.labelKey)}</p>
                  <p className="text-xs text-gray-500">{t(s.descKey)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── STAGE: prep ───
  if (stage === 'prep') {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{tSim('prepTitle')}</h2>
          <Button size="sm" variant="ghost" onClick={reset}>{tSim('back')}</Button>
        </div>

        {loadingPrep && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        )}

        {!loadingPrep && prep && (
          <>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {tSim('risksTitle')}
                </p>
                {prep.risks.map((r) => (
                  <div
                    key={r.id}
                    className={cn('rounded-lg p-3', severityColor(r.severity))}
                    style={severityStyle(r.severity)}
                  >
                    <p className="font-semibold text-sm">
                      <Badge className="mr-2 bg-white/50 text-current border border-current/30">
                        {tSim(`sev.${r.severity}`)}
                      </Badge>
                      {r.title}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed">{r.detail}</p>
                    {r.regulation && (
                      <p className="text-[10px] mt-1 opacity-70 font-mono">{r.regulation}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  {tSim('docsTitle')}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {prep.documents.map((d) => (
                    <li key={d.id} className="flex items-start gap-2 text-gray-700">
                      <span className="text-gray-300 mt-0.5">□</span>
                      <span>{d.label}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-purple-500" />
                  {tSim('questionsTitle')}
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {prep.questions.map((q) => (
                    <li key={q.id} className="pl-3 border-l-2 border-purple-100 py-0.5">
                      {q.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Button onClick={startChat} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white">
              {tSim('startChat')}
            </Button>
          </>
        )}
      </div>
    );
  }

  // ─── STAGE: report ───
  if (stage === 'report') {
    const evidenceAvg = avg(messages.filter((m) => m.score).map((m) => m.score!.evidence));
    const clarityAvg = avg(messages.filter((m) => m.score).map((m) => m.score!.clarity));
    const complianceAvg = avg(messages.filter((m) => m.score).map((m) => m.score!.compliance));
    const overall = Math.round((evidenceAvg + clarityAvg + complianceAvg) * 10 / 3);
    const actions: string[] = [];
    if (evidenceAvg < 6) actions.push(tSim('actionEvidence'));
    if (clarityAvg < 6) actions.push(tSim('actionClarity'));
    if (complianceAvg < 6) actions.push(tSim('actionCompliance'));
    if (!actions.length) actions.push(tSim('actionBaseline'));

    const overallDelta = overall - SCORE_PASS_THRESHOLD;
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center">
            <TrendingUp
              className="h-8 w-8 mx-auto mb-2"
              style={{ color: CHART_ACCENT_POSITIVE }}
            />
            <p className="text-xs text-gray-500 uppercase tracking-wide">{tSim('overall')}</p>
            <p className="text-5xl font-bold text-gray-900 mt-2">{overall}</p>
            <p className="text-xs text-gray-500 mt-1">/ 100</p>
            <div className="mt-2 flex justify-center">
              <TrendBadge
                value={overallDelta}
                suffix={` vs ${SCORE_PASS_THRESHOLD}`}
                precision={0}
                direction="up-good"
                size="text-xs"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { key: 'evidence', score: evidenceAvg, label: tSim('dimEvidence') },
            { key: 'clarity', score: clarityAvg, label: tSim('dimClarity') },
            { key: 'compliance', score: complianceAvg, label: tSim('dimCompliance') },
          ].map((d) => {
            // Tier color uses Okabe-Ito accents instead of emerald/red. The
            // 4-7 amber tier keeps the Tailwind amber-500 since it doesn't
            // collide with anything for red-green deficiency.
            const tierColor =
              d.score >= 7
                ? CHART_ACCENT_POSITIVE
                : d.score >= 4
                  ? '#F59E0B' // amber-500
                  : CHART_ACCENT_NEGATIVE;
            return (
              <Card key={d.key} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">{d.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{d.score}/10</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${d.score * 10}%`, backgroundColor: tierColor }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="font-semibold text-gray-900 mb-3">{tSim('actions')}</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-1 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Button onClick={reset} variant="outline" className="w-full h-11">
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          {tSim('restart')}
        </Button>
      </div>
    );
  }

  // ─── STAGE: chat ───
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{tSim('chatTitle')}</h2>
        {done && (
          <Button size="sm" onClick={finishSim} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {tSim('viewReport')}
          </Button>
        )}
      </div>

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
                    <div className="p-1.5 bg-red-100 rounded-lg h-7 w-7 flex items-center justify-center shrink-0">
                      <Shield className="h-3.5 w-3.5 text-red-600" />
                    </div>
                  )}
                  <div className={cn('max-w-[80%]')}>
                    <div className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm',
                      m.role === 'taxpayer' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-red-50 text-gray-800 rounded-bl-md'
                    )}>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                    {m.score && (
                      <div className="mt-1 flex gap-1.5 justify-end">
                        <Badge className="bg-emerald-50 text-emerald-700 text-[10px] border border-emerald-100">
                          {tSim('dimEvidenceShort')} {m.score.evidence}
                        </Badge>
                        <Badge className="bg-blue-50 text-blue-700 text-[10px] border border-blue-100">
                          {tSim('dimClarityShort')} {m.score.clarity}
                        </Badge>
                        <Badge className="bg-purple-50 text-purple-700 text-[10px] border border-purple-100">
                          {tSim('dimComplianceShort')} {m.score.compliance}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {m.role === 'taxpayer' && (
                    <div className="p-1.5 bg-blue-100 rounded-lg h-7 w-7 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg h-7 w-7 flex items-center justify-center shrink-0">
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendResponse()}
              placeholder={t('auditSim.inputPlaceholder')}
              disabled={isLoading || done}
              className="rounded-xl"
            />
            <Button onClick={sendResponse} disabled={isLoading || done || !input.trim()} size="sm" className="rounded-xl px-4 bg-red-600 hover:bg-red-700">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {done && (
        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center justify-between">
          <span>{tSim('doneHint')}</span>
          <Button size="sm" onClick={finishSim} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {tSim('viewReport')}
          </Button>
        </div>
      )}
    </div>
  );
}
