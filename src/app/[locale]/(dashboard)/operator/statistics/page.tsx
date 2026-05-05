'use client';

/**
 * 성과/평가 (PDF p.12-17 명세 기준)
 *
 * - 5 KPI (평가대상/1위/평균점수/인센티브 총액/가중치 합계)
 * - 평가 가중치 5개 입력 (처리량/정확도/처리속도/Supervisor 승인품질/고객응대)
 * - 인센티브 정책 5개 입력
 * - 메뉴 구분 안내 박스 3개
 * - 12명 비교 평가표 (rank/종합점수/배정/완료/시간/정확도/승인품질/고객응대/인센티브/평가결과)
 * - 점수 분포 (각 operator 별 5지표 막대)
 */

import { useCallback, useEffect, useState } from 'react';
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

const EVAL_LABEL: Record<OperatorScore['evaluation_label'], { text: string; cls: string }> = {
  EXCELLENT: { text: '우수', cls: 'bg-emerald-100 text-emerald-700' },
  PAYABLE:   { text: '지급대상', cls: 'bg-blue-100 text-blue-700' },
  IMPROVE:   { text: '보류', cls: 'bg-amber-100 text-amber-800' },
  HOLD:      { text: '보류', cls: 'bg-slate-100 text-slate-500' },
};

const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function StatisticsPage() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [draftWeights, setDraftWeights] = useState<Weights | null>(null);
  const [draftIncentive, setDraftIncentive] = useState<Incentive | null>(null);

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
      <PageTitle title="성과/평가" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">성과/평가</h1>
          <p className="text-sm text-slate-500 mt-1">상담원 비교 + 가중치 기반 점수와 인센티브를 산정합니다. 상담원 관리와 달리 상태 변경이 아니라 평가 기준과 보상 계산이 핵심입니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Comparison / Incentive</span>
          <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> 새로고침
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label="평가대상" value={`${data.summary.evaluatedCount}명`} />
        <Kpi label="1위 상담원" value={data.summary.topOperator?.name ?? '—'} />
        <Kpi label="평균점수" value={`${data.summary.avgScore}점`} />
        <Kpi label="인센티브 총액" value={fmtRp(data.summary.totalIncentive)} />
        <Kpi label="가중치 합계" value={`${data.summary.weightSum}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-1">평가 가중치</h2>
          <p className="text-[11px] text-slate-500 mb-3">각 지표의 비중을 입력합니다. 합계 100%를 권장합니다.</p>
          <div className="space-y-2">
            <WeightRow label="처리량"        v={draftWeights.processing}   onChange={(n) => setDraftWeights({ ...draftWeights, processing: n })} />
            <WeightRow label="정확도"        v={draftWeights.accuracy}     onChange={(n) => setDraftWeights({ ...draftWeights, accuracy: n })} />
            <WeightRow label="처리속도"      v={draftWeights.speed}        onChange={(n) => setDraftWeights({ ...draftWeights, speed: n })} />
            <WeightRow label="Supervisor 승인품질" v={draftWeights.approval}     onChange={(n) => setDraftWeights({ ...draftWeights, approval: n })} />
            <WeightRow label="고객응대"      v={draftWeights.satisfaction} onChange={(n) => setDraftWeights({ ...draftWeights, satisfaction: n })} />
          </div>
          {(() => {
            const sum = draftWeights.processing + draftWeights.accuracy + draftWeights.speed + draftWeights.approval + draftWeights.satisfaction;
            const ok = sum === 100;
            return (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                가중치 합계: {sum}%
              </p>
            );
          })()}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-1">인센티브 정책</h2>
          <p className="text-[11px] text-slate-500 mb-3">성과점수에 따른 월별 보상 산정 기준을 입력합니다.</p>
          <MoneyRow label="월 인센티브 풀" v={draftIncentive.monthlyPool} onChange={(n) => setDraftIncentive({ ...draftIncentive, monthlyPool: n })} />
          <MoneyRow label="점수 1점당 보상" v={draftIncentive.perPoint} onChange={(n) => setDraftIncentive({ ...draftIncentive, perPoint: n })} />
          <MoneyRow label="1인 최대 지급액" v={draftIncentive.maxPerPerson} onChange={(n) => setDraftIncentive({ ...draftIncentive, maxPerPerson: n })} />
          <ScoreRow label="지급 최소점수" v={draftIncentive.minScore} onChange={(n) => setDraftIncentive({ ...draftIncentive, minScore: n })} />
          <ScoreRow label="개선관리 기준점수" v={draftIncentive.improvementThreshold} onChange={(n) => setDraftIncentive({ ...draftIncentive, improvementThreshold: n })} />
          <button
            onClick={saveSettings} disabled={savingSettings}
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingSettings ? '저장중…' : '가중치 / 인센티브 저장'}
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">메뉴 구분</h2>
          <div className="space-y-2 text-[11px]">
            <Hint title="상담원 관리" body="상담원 상태, 근무 가능 여부, 계정/권한, 퇴사 상태를 관리합니다." cls="bg-blue-50 text-blue-800" />
            <Hint title="성과/평가" body="상담원 간 처리량, 정확도, 속도, 승인품질, 고객응대를 비교하고 인센티브를 산정합니다." cls="bg-emerald-50 text-emerald-800" />
            <Hint title="평가 결과 활용" body="우수 상담원 보상, 교육대상 선정, 과부하 조정, 업무 재배정 판단에 사용합니다." cls="bg-amber-50 text-amber-800" />
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-base font-black text-slate-900 mb-3">상담원 비교 평가표</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                <th className="px-2 py-2 font-bold">Rank</th>
                <th className="px-2 py-2 font-bold">상담원</th>
                <th className="px-2 py-2 font-bold text-right">종합점수</th>
                <th className="px-2 py-2 font-bold text-right">현재 배정</th>
                <th className="px-2 py-2 font-bold text-right">처리완료</th>
                <th className="px-2 py-2 font-bold text-right">평균시간</th>
                <th className="px-2 py-2 font-bold text-right">정확도</th>
                <th className="px-2 py-2 font-bold text-right">승인품질</th>
                <th className="px-2 py-2 font-bold text-right">고객응대</th>
                <th className="px-2 py-2 font-bold text-right">인센티브</th>
                <th className="px-2 py-2 font-bold">평가결과</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map(o => {
                const lbl = EVAL_LABEL[o.evaluation_label];
                return (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-black text-slate-900">{o.rank}</td>
                    <td className="px-2 py-2">
                      <div className="font-bold text-slate-900">{o.name}</div>
                      <div className="text-[10px] text-slate-400">{o.employee_id}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-black text-slate-900">{o.scores.total}</td>
                    <td className="px-2 py-2 text-right">{o.active_load}건</td>
                    <td className="px-2 py-2 text-right">{o.completed_count}건</td>
                    <td className="px-2 py-2 text-right">{o.avg_minutes ?? '—'}분</td>
                    <td className="px-2 py-2 text-right">{o.scores.accuracy}%</td>
                    <td className="px-2 py-2 text-right">{o.scores.approval}</td>
                    <td className="px-2 py-2 text-right">{o.scores.satisfaction}</td>
                    <td className="px-2 py-2 text-right font-bold">{o.incentive_amount === 0 ? 'Rp 0' : fmtRp(o.incentive_amount)}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${lbl.cls}`}>{lbl.text}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-900 mb-3">성과 점수 분포</h2>
        <div className="space-y-3">
          {data.operators.map(o => (
            <div key={o.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-slate-900">{o.rank}. {o.name} <span className="text-xs font-normal text-slate-400">{o.employee_id}</span></p>
                <p className="text-xs font-bold text-slate-700">{o.scores.total}점 · {o.incentive_amount === 0 ? 'Rp 0' : fmtRp(o.incentive_amount)}</p>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(o.scores.total, 100)}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                <Metric label="처리량" v={o.scores.processing} />
                <Metric label="정확도" v={o.scores.accuracy} />
                <Metric label="처리속도" v={o.scores.speed} />
                <Metric label="승인품질" v={o.scores.approval} />
                <Metric label="고객응대" v={o.scores.satisfaction} />
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
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-slate-500">{label}</p>
      <p className="font-black text-slate-900">{v.toFixed(1)}점</p>
    </div>
  );
}
