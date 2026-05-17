'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface RubricRow {
  label: string;
  individual: number;
  team: number;
  description: string;
}

interface TeamKpi {
  teamId: string;
  teamName: string;
  supervisorName: string | null;
  memberCount: number;
  activeMembers: number;
  customerCount: number;
  transactionsThisMonth: number;
  counterpartyContributions: number;
  completionRatePct: number;
  reviewCompletenessPct: number;
  pendingApproval: number;
  revisionCount: number;
  riskTasks: number;
  totalTaxAmount: number;
  insight: string;
}

interface MemberDetail {
  consultantId: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  teamName: string;
  customerCount: number;
  activeTasks: number;
  pendingApproval: number;
  revisionCount: number;
  avgProcessingMinutes: number;
}

interface TeamResp {
  rubric: RubricRow[];
  teams: TeamKpi[];
  members: MemberDetail[];
}

export function SupervisorTeamView() {
  const t = useTranslations('supervisorErp');
  const [data, setData] = useState<TeamResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTeam, setNewTeam] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/consultant-erp/supervisor/team');
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error || 'failed');
        return;
      }
      setData(j.data as TeamResp);
      if (!newTeam && j.data?.teams?.length > 0) setNewTeam(j.data.teams[0].teamId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [newTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMember = useCallback(async () => {
    if (!newName || !newEmail || !newTeam) return;
    setBusy(true);
    try {
      const r = await fetch('/api/consultant-erp/supervisor/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: newName, email: newEmail, taxPartnerId: newTeam }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast.error(j.error || 'failed');
      } else {
        toast.success(t('addMemberSuccess'));
        setNewName('');
        setNewEmail('');
        void load();
      }
    } finally {
      setBusy(false);
    }
  }, [newName, newEmail, newTeam, load, t]);

  const toggleActive = useCallback(
    async (consultantId: string, isActive: boolean) => {
      setBusy(true);
      try {
        const r = await fetch('/api/consultant-erp/supervisor/team', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultantId, isActive: !isActive }),
        });
        const j = await r.json();
        if (!r.ok || !j.success) toast.error(j.error || 'failed');
        else void load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-rose-600">{error ?? 'no data'}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Rubric */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950">{t('rubricHeading')}</p>
        <p className="text-xs text-slate-500 mt-1">{t('rubricIntro')}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-3 w-1/4">{t('rubricHeading')}</th>
                <th className="text-center py-2 px-3">{t('rubricRoleIndividual')}</th>
                <th className="text-center py-2 px-3">{t('rubricRoleTeam')}</th>
                <th className="text-left py-2 px-3">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rubric.map((r) => (
                <tr key={r.label}>
                  <td className="py-2 px-3 font-bold text-slate-900">{r.label}</td>
                  <td className="py-2 px-3 text-center font-mono">{r.individual || '—'}</td>
                  <td className="py-2 px-3 text-center font-mono">{r.team || '—'}</td>
                  <td className="py-2 px-3 text-slate-600">{t(r.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Team KPI */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('teamKpiHeading')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-2">{t('thTeamName')}</th>
                <th className="text-right py-2 px-2">{t('thMembers')}</th>
                <th className="text-right py-2 px-2">{t('thCustomers')}</th>
                <th className="text-right py-2 px-2">{t('thTransactions')}</th>
                <th className="text-right py-2 px-2">{t('thCounterpartyDb')}</th>
                <th className="text-right py-2 px-2">{t('thCompletionRate')}</th>
                <th className="text-right py-2 px-2">{t('thReviewCompleteness')}</th>
                <th className="text-right py-2 px-2">{t('thQueueBottleneck')}</th>
                <th className="text-right py-2 px-2">{t('thRevisions')}</th>
                <th className="text-right py-2 px-2">{t('thRiskTasks')}</th>
                <th className="text-left py-2 px-2">{t('thInsight')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.teams.map((tm) => (
                <tr key={tm.teamId}>
                  <td className="py-2 px-2 font-bold text-slate-900">
                    {tm.teamName}
                    {tm.supervisorName && <p className="text-[10px] text-slate-500">Sup. {tm.supervisorName}</p>}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {tm.activeMembers}/{tm.memberCount}
                  </td>
                  <td className="py-2 px-2 text-right">{tm.customerCount}</td>
                  <td className="py-2 px-2 text-right font-mono">{tm.transactionsThisMonth}</td>
                  <td className="py-2 px-2 text-right">{tm.counterpartyContributions}</td>
                  <td className="py-2 px-2 text-right">{tm.completionRatePct}%</td>
                  <td className="py-2 px-2 text-right">{tm.reviewCompletenessPct}%</td>
                  <td className="py-2 px-2 text-right">{tm.pendingApproval}</td>
                  <td className="py-2 px-2 text-right">
                    <span style={{ color: tm.revisionCount > 0 ? '#D55E00' : '#475569' }}>
                      {tm.revisionCount}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span style={{ color: tm.riskTasks > 0 ? '#D55E00' : '#475569' }}>
                      {tm.riskTasks}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-[11px] text-slate-700">{tm.insight}</td>
                </tr>
              ))}
              {data.teams.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm text-slate-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Member workload + manage */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('membersHeading')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-3">{t('thMemberName')}</th>
                <th className="text-center py-2 px-3">{t('thStatus')}</th>
                <th className="text-right py-2 px-3">{t('thAssignedCustomers')}</th>
                <th className="text-right py-2 px-3">{t('thActiveTasks')}</th>
                <th className="text-right py-2 px-3">{t('thPendingApproval')}</th>
                <th className="text-right py-2 px-3">{t('thRevisionCount')}</th>
                <th className="text-right py-2 px-3">{t('thAvgProcessing')}</th>
                <th className="text-center py-2 px-3">{t('thManage')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map((m) => (
                <tr key={m.consultantId}>
                  <td className="py-2 px-3">
                    <p className="font-bold text-slate-900">{m.fullName}</p>
                    <p className="text-[10px] text-slate-500">{m.email ?? '—'}</p>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={
                        m.isActive
                          ? { backgroundColor: '#D0F0E5', color: '#00684D' }
                          : { backgroundColor: '#FBE0D0', color: '#A04400' }
                      }
                    >
                      {m.isActive ? t('statusActive') : t('statusInactive')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">{m.customerCount}</td>
                  <td className="py-2 px-3 text-right">{m.activeTasks}</td>
                  <td className="py-2 px-3 text-right">{m.pendingApproval}</td>
                  <td className="py-2 px-3 text-right">
                    <span style={{ color: m.revisionCount > 0 ? '#D55E00' : '#475569' }}>
                      {m.revisionCount}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700">{m.avgProcessingMinutes}분</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => toggleActive(m.consultantId, m.isActive)}
                      disabled={busy}
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                      style={
                        m.isActive
                          ? { borderColor: '#F4A878', color: '#A04400' }
                          : { borderColor: '#7DD3A4', color: '#00684D' }
                      }
                    >
                      {m.isActive ? t('actionDeactivate') : t('actionReactivate')}
                    </button>
                  </td>
                </tr>
              ))}
              {data.members.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add member */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950">{t('addMemberHeading')}</p>
        <p className="text-xs text-slate-500 mt-1">{t('addMemberDesc')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <Label className="text-[11px] text-slate-600">{t('addMemberFullName')}</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: Novi Anggraini"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600">{t('addMemberEmail')}</Label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novi@ai-pajak.id"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600">{t('addMemberTeam')}</Label>
            <select
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {data.teams.map((tm) => (
                <option key={tm.teamId} value={tm.teamId}>
                  {tm.teamName}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={addMember}
            disabled={busy || !newName || !newEmail || !newTeam}
            className="min-h-10"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
            {t('addMemberSubmit')}
          </Button>
        </div>
      </section>
    </div>
  );
}
