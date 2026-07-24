'use client';

/**
 * 상담원 소속관리 (v13 §6) — 이동 요청 → 상대 수퍼바이저 승인 워크플로우.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ArrowRightLeft } from 'lucide-react';

interface TeamMember { id: string; employeeId: string; name: string; status: string; workState: string | null; supervisorId: string | null; supervisorName: string | null; isMine: boolean; }
interface Supervisor { id: string; name: string; employeeId: string; }
interface Transfer { id: string; operatorName: string; fromSupervisorName: string | null; toSupervisorName: string; clientMode: string; reason: string; status: string; decisionComment: string | null; direction: string; }
interface Data { meId: string | null; team: TeamMember[]; supervisors: Supervisor[]; incoming: Transfer[]; transfers: Transfer[]; }

const MODES = ['WITH_CLIENTS', 'OPERATOR_ONLY', 'REASSIGN_CLIENTS'] as const;

export function SupervisorAffiliation() {
  const t = useTranslations('supervisorErp');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ operatorId: string; toSupervisorId: string; clientMode: string; reason: string }>({
    operatorId: '', toSupervisorId: '', clientMode: 'WITH_CLIENTS', reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/consultant-erp/supervisor/affiliation');
      const j = await r.json();
      if (j.success) setData(j.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitRequest = async () => {
    if (!form.operatorId || !form.toSupervisorId || !form.reason.trim()) return;
    setBusy('create');
    try {
      const r = await fetch('/api/consultant-erp/supervisor/affiliation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.success) { toast.success(t('affRequested')); setForm({ operatorId: '', toSupervisorId: '', clientMode: 'WITH_CLIENTS', reason: '' }); load(); }
      else toast.error(j.error ?? 'error');
    } finally { setBusy(null); }
  };

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setBusy(id);
    try {
      const r = await fetch(`/api/consultant-erp/supervisor/affiliation/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (j.success) { toast.success(action === 'APPROVE' ? t('affApproved', { n: j.data.reassignedCount ?? 0 }) : t('affRejected')); load(); }
      else toast.error(j.error ?? 'error');
    } finally { setBusy(null); }
  };

  if (loading || !data) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={load} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> {t('handoverRefresh')}
        </button>
      </div>

      {/* 나에게 온 이동 요청 */}
      {data.incoming.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="mb-3 text-sm font-black text-slate-950">{t('affIncomingTitle')} <span className="text-amber-700">({data.incoming.length})</span></p>
          <div className="space-y-2">
            {data.incoming.map(tr => (
              <div key={tr.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-800">
                  {tr.operatorName} <ArrowRightLeft className="inline h-3 w-3 text-slate-400" /> {tr.toSupervisorName}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">{t(`affMode.${tr.clientMode}`)}</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-600">{tr.reason}</p>
                <div className="mt-2 flex gap-2">
                  <button className="h-7 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={busy === tr.id} onClick={() => decide(tr.id, 'APPROVE')}>{t('affApproveBtn')}</button>
                  <button className="h-7 rounded-lg bg-rose-600 px-3 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50" disabled={busy === tr.id} onClick={() => decide(tr.id, 'REJECT')}>{t('affRejectBtn')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 이동 요청 생성 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-black text-slate-950">{t('affNewTitle')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="h-9 rounded-lg border border-slate-200 px-2 text-sm" value={form.operatorId} onChange={e => setForm({ ...form, operatorId: e.target.value })}>
            <option value="">{t('affSelectOperator')}</option>
            {data.team.map(m => <option key={m.id} value={m.id}>{m.name} ({m.employeeId}) — {m.supervisorName ?? t('affNoSupervisor')}</option>)}
          </select>
          <select className="h-9 rounded-lg border border-slate-200 px-2 text-sm" value={form.toSupervisorId} onChange={e => setForm({ ...form, toSupervisorId: e.target.value })}>
            <option value="">{t('affSelectSupervisor')}</option>
            {data.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="h-9 rounded-lg border border-slate-200 px-2 text-sm" value={form.clientMode} onChange={e => setForm({ ...form, clientMode: e.target.value })}>
            {MODES.map(m => <option key={m} value={m}>{t(`affMode.${m}`)}</option>)}
          </select>
          <input className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm" placeholder={t('affReasonPlaceholder')} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </div>
        <button className="mt-3 h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={busy === 'create' || !form.operatorId || !form.toSupervisorId || !form.reason.trim()}
          onClick={submitRequest}>
          {busy === 'create' ? '…' : t('affRequestBtn')}
        </button>
        <p className="mt-2 text-[10px] text-slate-400">{t('affWorkflowNote')}</p>
      </section>

      {/* 팀 소속 현황 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-black text-slate-950">{t('affTeamTitle')}</p>
        <div className="overflow-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2">{t('affColOperator')}</th>
                <th className="px-2 py-2">{t('affColSupervisor')}</th>
                <th className="px-2 py-2">{t('affColState')}</th>
              </tr>
            </thead>
            <tbody>
              {data.team.map(m => (
                <tr key={m.id} className={`border-t border-slate-100 ${m.isMine ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-2 py-2.5"><span className="font-semibold text-slate-800">{m.name}</span> <span className="text-slate-400">{m.employeeId}</span></td>
                  <td className="px-2 py-2.5">{m.supervisorName ?? <span className="text-amber-600">{t('affNoSupervisor')}</span>}</td>
                  <td className="px-2 py-2.5">{m.workState ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
