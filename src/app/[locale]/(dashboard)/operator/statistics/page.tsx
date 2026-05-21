'use client';

/**
 * Performance / evaluation (PDF p.12-17)
 *
 * - 5 KPIs (evaluated / rank-1 / avg score / total incentive / weight sum)
 * - 5 evaluation weights (throughput / accuracy / speed / approval / CSAT)
 * - 5 incentive-policy fields
 * - 3 menu-distinction hints
 * - 12-row comparison table
 * - Score distribution (per-operator 5-metric bar)
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface Weights { processing: number; accuracy: number; speed: number; approval: number; satisfaction: number }
interface Incentive { monthlyPool: number; perPoint: number; maxPerPerson: number; minScore: number; improvementThreshold: number }
interface Scores { processing: number; accuracy: number; speed: number; approval: number; satisfaction: number; total: number }
interface OperatorScore {
  id: string;
  employee_id: string;
  name: string;
  work_state: string;
  active_load: number;
  completed_count: number;
  avg_minutes: number | null;
  scores: Scores;
  rank: number;
  incentive_amount: number;
  evaluation_label: 'EXCELLENT' | 'PAYABLE' | 'IMPROVE' | 'HOLD';
}

interface EvaluationData {
  operators: OperatorScore[];
  weights: Weights;
  incentive: Incentive;
  summary: {
    evaluatedCount: number;
    topOperator: { name: string; employee_id: string; score: number } | null;
    avgScore: number;
    totalIncentive: number;
    weightSum: number;
  };
}

const EVAL_CLS: Record<OperatorScore['evaluation_label'], string> = {
  EXCELLENT: 'bg-emerald-100 text-emerald-700',
  PAYABLE:   'bg-blue-100 text-blue-700',
  IMPROVE:   'bg-amber-100 text-amber-800',
  HOLD:      'bg-slate-100 text-slate-500',
};

const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function StatisticsPage() {
  const t = useTranslations('operatorStatistics');
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [draftWeights, setDraftWeights] = useState<Weights | null>(null);
  const [draftIncentive, setDraftIncentive] = useState<Incentive | null>(null);

  const evalLabel = (key: OperatorScore['evaluation_label']) => {
    try { return t(`evalLabel.${key}`); } catch { return key; }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/evaluation');
      const j = await r.json();
      if (j.success) {
        setData(j.data as EvaluationData);
        setDraftWeights(j.data.weights);
        setDraftIncentive(j.data.incentive);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/operator/evaluation-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: draftWeights, incentive: draftIncentive }),
      });
      await load();
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !data || !draftWeights || !draftIncentive) {
    return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('pageTitle')} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('pageDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{t('comparisonBadge')}</span>
          <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label={t('kpi.evaluated')} value={t('personSuffix', { n: data.summary.evaluatedCount })} />
        <Kpi label={t('kpi.topOperator')} value={data.summary.topOperator?.name ?? '—'} />
        <Kpi label={t('kpi.avgScore')} value={t('scoreSuffix', { n: data.summary.avgScore })} />
        <Kpi label={t('kpi.totalIncentive')} value={fmtRp(data.summary.totalIncentive)} />
        <Kpi label={t('kpi.weightSum')} value={t('percentSuffix', { n: data.summary.weightSum })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-1">{t('weights.title')}</h2>
          <p className="text-[11px] text-slate-500 mb-3">{t('weights.desc')}</p>
          <div className="space-y-2">
            <WeightRow label={t('weights.processing')}   v={draftWeights.processing}   onChange={(n) => setDraftWeights({ ...draftWeights, processing: n })} />
            <WeightRow label={t('weights.accuracy')}     v={draftWeights.accuracy}     onChange={(n) => setDraftWeights({ ...draftWeights, accuracy: n })} />
            <WeightRow label={t('weights.speed')}        v={draftWeights.speed}        onChange={(n) => setDraftWeights({ ...draftWeights, speed: n })} />
            <WeightRow label={t('weights.approval')}     v={draftWeights.approval}     onChange={(n) => setDraftWeights({ ...draftWeights, approval: n })} />
            <WeightRow label={t('weights.satisfaction')} v={draftWeights.satisfaction} onChange={(n) => setDraftWeights({ ...draftWeights, satisfaction: n })} />
          </div>
          {(() => {
            const sum = draftWeights.processing + draftWeights.accuracy + draftWeights.speed + draftWeights.approval + draftWeights.satisfaction;
            const ok = sum === 100;
            return (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {t('weights.sumLabel', { n: sum })}
              </p>
            );
          })()}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-1">{t('incentive.title')}</h2>
          <p className="text-[11px] text-slate-500 mb-3">{t('incentive.desc')}</p>
          <MoneyRow label={t('incentive.monthlyPool')}  v={draftIncentive.monthlyPool}  onChange={(n) => setDraftIncentive({ ...draftIncentive, monthlyPool: n })} />
          <MoneyRow label={t('incentive.perPoint')}     v={draftIncentive.perPoint}     onChange={(n) => setDraftIncentive({ ...draftIncentive, perPoint: n })} />
          <MoneyRow label={t('incentive.maxPerPerson')} v={draftIncentive.maxPerPerson} onChange={(n) => setDraftIncentive({ ...draftIncentive, maxPerPerson: n })} />
          <ScoreRow label={t('incentive.minScore')}              v={draftIncentive.minScore}              onChange={(n) => setDraftIncentive({ ...draftIncentive, minScore: n })} />
          <ScoreRow label={t('incentive.improvementThreshold')}  v={draftIncentive.improvementThreshold}  onChange={(n) => setDraftIncentive({ ...draftIncentive, improvementThreshold: n })} />
          <button
            onClick={saveSettings} disabled={savingSettings}
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingSettings ? t('incentive.savingBtn') : t('incentive.saveBtn')}
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">{t('hints.title')}</h2>
          <div className="space-y-2 text-[11px]">
            <Hint title={t('hints.opsTitle')} body={t('hints.opsBody')} cls="bg-blue-50 text-blue-800" />
            <Hint title={t('hints.statsTitle')} body={t('hints.statsBody')} cls="bg-emerald-50 text-emerald-800" />
            <Hint title={t('hints.useTitle')} body={t('hints.useBody')} cls="bg-amber-50 text-amber-800" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-base font-black text-slate-900 mb-3">{t('table.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                <th className="px-2 py-2 font-bold">{t('table.rank')}</th>
                <th className="px-2 py-2 font-bold">{t('table.operator')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.totalScore')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.currentLoad')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.completedCount')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.avgMinutes')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.accuracy')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.approval')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.satisfaction')}</th>
                <th className="px-2 py-2 font-bold text-right">{t('table.incentive')}</th>
                <th className="px-2 py-2 font-bold">{t('table.evalResult')}</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map(o => {
                return (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-black text-slate-900">{o.rank}</td>
                    <td className="px-2 py-2">
                      <div className="font-bold text-slate-900">{o.name}</div>
                      <div className="text-[10px] text-slate-400">{o.employee_id}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-black text-slate-900">{o.scores.total}</td>
                    <td className="px-2 py-2 text-right">{t('caseSuffix', { n: o.active_load })}</td>
                    <td className="px-2 py-2 text-right">{t('caseSuffix', { n: o.completed_count })}</td>
                    <td className="px-2 py-2 text-right">{o.avg_minutes != null ? t('minuteSuffix', { n: o.avg_minutes }) : '—'}</td>
                    <td className="px-2 py-2 text-right">{o.scores.accuracy}%</td>
                    <td className="px-2 py-2 text-right">{o.scores.approval}</td>
                    <td className="px-2 py-2 text-right">{o.scores.satisfaction}</td>
                    <td className="px-2 py-2 text-right font-bold">{o.incentive_amount === 0 ? 'Rp 0' : fmtRp(o.incentive_amount)}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${EVAL_CLS[o.evaluation_label]}`}>{evalLabel(o.evaluation_label)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-900 mb-3">{t('distribution.title')}</h2>
        <div className="space-y-3">
          {data.operators.map(o => (
            <div key={o.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-slate-900">{o.rank}. {o.name} <span className="text-xs font-normal text-slate-400">{o.employee_id}</span></p>
                <p className="text-xs font-bold text-slate-700">{t('scoreSuffix', { n: o.scores.total })} · {o.incentive_amount === 0 ? 'Rp 0' : fmtRp(o.incentive_amount)}</p>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(o.scores.total, 100)}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                <Metric label={t('distribution.processing')}  v={o.scores.processing} />
                <Metric label={t('distribution.accuracy')}    v={o.scores.accuracy} />
                <Metric label={t('distribution.speed')}       v={o.scores.speed} />
                <Metric label={t('distribution.approval')}    v={o.scores.approval} />
                <Metric label={t('distribution.satisfaction')} v={o.scores.satisfaction} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-base font-black text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function WeightRow({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 text-xs text-slate-700">{label}</label>
      <input type="number" min={0} max={100} value={v} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-mono" />
    </div>
  );
}

function MoneyRow({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div className="mb-2">
      <label className="text-xs text-slate-700 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Rp</span>
        <input type="number" min={0} value={v} onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-mono" />
      </div>
    </div>
  );
}

function ScoreRow({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="flex-1 text-xs text-slate-700">{label}</label>
      <input type="number" min={0} max={100} value={v} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-mono" />
    </div>
  );
}

function Hint({ title, body, cls }: { title: string; body: string; cls: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${cls}`}>
      <p className="font-bold mb-0.5">{title}</p>
      <p className="text-[11px]">{body}</p>
    </div>
  );
}

function Metric({ label, v }: { label: string; v: number }) {
  const t = useTranslations('operatorStatistics');
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-slate-500">{label}</p>
      <p className="font-black text-slate-900">{t('scoreSuffix', { n: v.toFixed(1) })}</p>
    </div>
  );
}
