'use client';
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './console.module.css';
import { makeT, LANGS, type Lang, type T } from './console-i18n';

// ── 타입 ─────────────────────────────────────────────
interface ConsoleData {
  kpis: { pendingManual: number; autoAssigned: number; excludedOffline: number; changes: number };
  dashKpis: { completed: number; completedRank: number; pendingApproval: number; rejectRate: number; avgMinutes: number };
  assignedCustomers: Array<{ customerId: string; name: string; operator: string; method: string; taxTypes: string[]; assignedAt: string | null }>;
  history: Array<{ name: string; operator: string; method: string; at: string }>;
  team: Array<{ id: string; name: string; load: number; maxClients: number; score: number; autoAssign: boolean }>;
  ranking: Array<{ id: string; name: string; taxLabel: string; approvalPass: number; rejectRate: number; score: number; load: number }>;
  teamCompare: Array<{ team: string; supervisor: string; members: number; completed: number; pendingApproval: number; rejectRate: number; avgMinutes: number; teamScore: number; rank: number }>;
  operators: Array<{ id: string; name: string }>;
  roster: Array<{ supervisorId: string | null; supervisor: string; staff: Array<{ id: string; name: string; workState: string; customers: number; pending: number; specialty: string }> }>;
  supervisorOptions: Array<{ id: string; name: string }>;
  approvalPending: Array<{ id: string; customerId: string; company: string; npwp: string | null; counselor: string; taxType: string; period: string; amount: number; note: string | null }>;
  audit: Array<{ activity: string; role: string; taxType: string | null; company: string; at: string }>;
}
type View = 'dashboard' | 'approval' | 'evaluation' | 'affiliation' | 'assignment' | 'billing' | 'audit';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const timeOf = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// 수정요청 1 — 콘솔 언어팩. t 를 Context 로 전 뷰에 전달.
const TCtx = createContext<T>(makeT('ko'));
const useT = () => useContext(TCtx);
const methodInfo = (m: string) => m === 'AUTO' ? { c: 'green', k: 'autoAssigned' } : { c: 'amber', k: 'manualChange' };

const VIEW_KEYS: Record<View, { t: string; d: string }> = {
  dashboard: { t: 'dashTitle', d: 'dashDesc' },
  approval: { t: 'apprTitle', d: 'apprDesc' },
  evaluation: { t: 'evalTitle', d: 'evalDesc' },
  affiliation: { t: 'affTitle', d: 'affDesc' },
  assignment: { t: 'asgTitle', d: 'asgDesc' },
  billing: { t: 'billTitle', d: 'billDesc' },
  audit: { t: 'audTitle', d: 'audDesc' },
};

export function SupervisorConsole({ name, role }: { name?: string; role?: string }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<ConsoleData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const nowP = new Date();
  const [period, setPeriod] = useState(`${nowP.getFullYear()}-${String(nowP.getMonth() + 1).padStart(2, '0')}`);
  // 초기 언어 = URL 로케일(ko/en/id) 우선, 그 외는 한국어(내부 콘솔).
  const [lang, setLang] = useState<Lang>(['ko', 'en', 'id'].includes(locale) ? (locale as Lang) : 'ko');
  const t = useMemo(() => makeT(lang), [lang]);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/operator/supervisor/console');
      const j = await r.json();
      if (j.success) setData(j.data as ConsoleData);
    } catch { /* keep */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const logout = async () => { await createClient().auth.signOut(); router.push(`/${locale}/login`); router.refresh(); };

  const runAutoAssign = async () => {
    try {
      const r = await fetch('/api/operator/auto-assign', { method: 'POST' });
      const j = await r.json();
      showToast(j.success ? t('toastAutoDone') : (j.error || t('toastAutoFail')));
      await load();
    } catch { showToast(t('toastNet')); }
  };

  const navBtn = (v: View, label: string, count?: number | string) => (
    <button className={`${styles.nav} ${view === v ? styles.active : ''}`} onClick={() => setView(v)}>
      <span>{label}</span>{count != null && <span className={styles.cnt}>{count}</span>}
    </button>
  );

  return (
    <TCtx.Provider value={t}>
    <div className={styles.root}>
      <div className={styles.app}>
        {/* ── 사이드바 ── */}
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>SP</div>
            <div><b>{t('brandTitle')}</b><span>{t('brandSub')}</span></div>
          </div>
          <div className={styles.loginCard}>
            <b>{name || t('navDashboard')}</b>
            <span>{role === 'TAX_OPERATOR_MASTER' ? t('roleMaster') : t('roleSup')}</span>
          </div>
          <div className={styles.navSection}>{t('secMain')}</div>
          {navBtn('dashboard', t('navDashboard'), t('badgeTeamCompare'))}
          {navBtn('approval', t('navApproval'), data?.approvalPending.length ?? 0)}
          <div className={styles.navSection}>{t('secPeople')}</div>
          {navBtn('evaluation', t('navEvaluation'), t('badgeRank'))}
          {navBtn('affiliation', t('navAffiliation'), t('badgeRun'))}
          {navBtn('assignment', t('navAssignment'), data?.assignedCustomers.length ?? 0)}
          <div className={styles.navSection}>{t('secProcess')}</div>
          {navBtn('billing', t('navBilling'), data?.kpis.changes ?? 0)}
          {navBtn('audit', t('navAudit'), t('badgeLog'))}
        </aside>

        {/* ── 메인 ── */}
        <main className={styles.main}>
          <div className={styles.topbar}>
            <div className={styles.title}><h1>{t(VIEW_KEYS[view].t)}</h1><p>{t(VIEW_KEYS[view].d)}</p></div>
            <div className={styles.topActions}>
              {/* 수정요청 1 — 언어 드롭다운 */}
              <select className={styles.periodInput} value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="language">
                {LANGS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
              </select>
              {/* 수정요청 2 — 기간 표시/선택 */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900, color: '#475569' }}>
                {t('period')}
                <input type="month" className={styles.periodInput} value={period} onChange={e => setPeriod(e.target.value)} />
              </label>
              {data && <button className={`${styles.btn} ${styles.blue}`} onClick={() => setShowReport(true)}>📄 {t('report')}</button>}
              <a className={styles.btn} href={`/${locale}/operator/workqueue`}>{t('backWorkqueue')}</a>
              <button className={styles.btn} onClick={logout}>{t('logout')}</button>
            </div>
          </div>

          {!data ? <div className={styles.card}><div className={styles.placeholder}>{t('loading')}</div></div>
            : view === 'dashboard' ? <DashboardView d={data} />
            : view === 'assignment' ? <AssignmentView d={data} onAuto={runAutoAssign} onReassigned={async (m) => { showToast(m); await load(); }} />
            : view === 'approval' ? <ApprovalView d={data} onChanged={load} />
            : view === 'evaluation' ? <EvaluationView />
            : view === 'affiliation' ? <AffiliationView d={data} onToast={showToast} onChanged={load} />
            : view === 'billing' ? <BillingView locale={locale} />
            : <AuditView d={data} />}
        </main>
      </div>
      {showReport && data && <ReportModal name={name} d={data} onClose={() => setShowReport(false)} />}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
    </TCtx.Provider>
  );
}

// ── 월간 리포트 모달 ──
function ReportModal({ name, d, onClose }: { name?: string; d: ConsoleData; onClose: () => void }) {
  const t = useT();
  const now = new Date();
  const ym = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rejects = d.audit.filter(a => /reject|반려|REJECT/i.test(a.activity)).length;
  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{t('reportTitle')}</h2>
        <div className={styles.modalBody}>
          <div className={styles.reportCover}>
            <h3>{t('reportCover', { ym })}</h3>
            <p>{t('reportCoverSub', { name: name || t('navDashboard') })}</p>
          </div>
          <div className={styles.reportGrid}>
            <div className={styles.reportKpi}><span>{t('rkCompleted')}</span><b>{d.dashKpis.completed}</b></div>
            <div className={styles.reportKpi}><span>{t('rkChanges')}</span><b>{d.kpis.changes}</b></div>
            <div className={styles.reportKpi}><span>{t('rkPending')}</span><b>{d.approvalPending.length}</b></div>
            <div className={styles.reportKpi}><span>{t('rkTeam')}</span><b>{d.team.length}</b></div>
          </div>

          <div className={styles.reportSection}>
            <h4>{t('rsTeamPerf')}</h4>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>{t('colTeam')}</th><th>{t('colSupervisor')}</th><th>{t('colCompleted')}</th><th>{t('colReject')}</th><th>{t('colTeamScore')}</th></tr></thead>
                <tbody>
                  {d.teamCompare.map((tc, i) => <tr key={i}><td><b>{tc.team}</b></td><td>{tc.supervisor}</td><td>{tc.completed}</td><td>{tc.rejectRate}%</td><td>{tc.teamScore}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>{t('rsRank')}</h4>
            <div className={styles.rs}>
              <div className={styles.rankCard}>
                {d.ranking.map((r, i) => (
                  <div key={r.id} className={styles.rankRow}><div className={styles.avatar}>{i + 1}</div><div><b>{r.name}</b><div style={{ color: '#64748b', fontSize: 12 }}>{t('rankDuty', { n: r.load })}</div></div><div className={styles.score}>{r.score.toFixed(0)}</div></div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>{t('rsApproval')}</h4>
            <div className={styles.rs}>
              <ul>
                <li>{t('rkPending')}: {d.approvalPending.length}</li>
                <li>{t('colReject')}: {rejects}</li>
                <li>{t('audHeadTitle')}: {d.audit.length}</li>
              </ul>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>{t('rsComment')}</h4>
            <div className={styles.rs}><p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
              {`${ym} — ${t('kpiCompleted')} ${d.dashKpis.completed}, ${t('rkChanges')} ${d.kpis.changes}, ${t('rkPending')} ${d.approvalPending.length}, ${t('rankTitle')} #1 ${d.ranking[0]?.name ?? '—'}.`}
            </p></div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>{t('close')}</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={() => window.print()}>{t('print')}</button>
        </div>
      </div>
    </div>
  );
}

// ── 대시보드 ──
function DashboardView({ d }: { d: ConsoleData }) {
  const t = useT();
  const k = d.dashKpis;
  const maxScore = Math.max(1, ...d.teamCompare.map(tc => tc.teamScore));
  return (
    <>
      <div className={`${styles.grid} ${styles.kpi}`}>
        <Kpi label={t('kpiCompleted')} value={String(k.completed)} sub={t('kpiCompletedSub', { n: k.completedRank })} />
        <Kpi label={t('kpiPending')} value={String(k.pendingApproval)} sub={t('kpiPendingSub')} />
        <Kpi label={t('kpiReject')} value={`${k.rejectRate}%`} sub={t('kpiRejectSub')} />
        <Kpi label={t('kpiAvg')} value={String(k.avgMinutes)} sub={t('kpiAvgSub')} />
      </div>
      <div className={`${styles.grid} ${styles.two}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>{t('teamPerfTitle')}</h2><p>{t('teamPerfDesc')}</p></div></div>
          <div className={styles.cardBody}>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>{t('colTeam')}</th><th>{t('colSupervisor')}</th><th>{t('colCounselor')}</th><th>{t('colCompleted')}</th><th>{t('colPending')}</th><th>{t('colReject')}</th><th>{t('colAvgTime')}</th><th>{t('colTeamScore')}</th></tr></thead>
                <tbody>
                  {d.teamCompare.map((tc, i) => (
                    <tr key={i}>
                      <td><b>{tc.team}</b> <span className={`${styles.badge} ${tc.rank === 1 ? styles.green : tc.rank === 2 ? styles.amber : styles.red}`}>#{tc.rank}</span></td>
                      <td>{tc.supervisor}</td><td>{tc.members}</td><td>{tc.completed}</td><td>{tc.pendingApproval}</td>
                      <td>{tc.rejectRate}%</td><td>{tc.avgMinutes}</td>
                      <td><b>{tc.teamScore}</b><div className={styles.progress}><i style={{ width: `${Math.round((tc.teamScore / maxScore) * 100)}%` }} /></div></td>
                    </tr>
                  ))}
                  {d.teamCompare.length === 0 && <tr><td colSpan={8} style={{ color: '#94a3b8' }}>{t('noTeam')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>{t('rankTitle')}</h2><p>{t('rankDesc')}</p></div></div>
          <div className={styles.cardBody}>
            <div className={styles.rankCard}>
              {d.ranking.map((r, i) => (
                <div key={r.id} className={styles.rankRow}>
                  <div className={styles.avatar}>{i + 1}</div>
                  <div>
                    <b>{r.name}</b>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{r.taxLabel} · {t('rankApprovalPass')} {r.approvalPass.toFixed(0)}% · {t('rankReject')} {r.rejectRate}%</div>
                  </div>
                  <div className={styles.score}>{r.score.toFixed(0)}</div>
                </div>
              ))}
              {d.ranking.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>{t('noRank')}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className={styles.kpiCard}><div className={styles.kpiLabel}>{label}</div><div className={styles.kpiValue}>{value}</div><div className={styles.kpiSub}>{sub}</div></div>;
}

// ── 고객 배정관리 ──
const RULE_KEYS = [1, 2, 3, 4];
function AssignmentView({ d, onAuto, onReassigned }: { d: ConsoleData; onAuto: () => void; onReassigned: (m: string) => void }) {
  const t = useT();
  const [sel, setSel] = useState<string | null>(d.assignedCustomers[0]?.customerId ?? null);
  const [op, setOp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const selCust = d.assignedCustomers.find(c => c.customerId === sel) ?? null;
  const RULES = RULE_KEYS.map(n => ({ n: t(`asgRule${n}` as string) || '', tt: t(`asgRule${n}Desc` as string) || '' }));
  const submit = async () => {
    if (!sel || !op || reason.trim().length < 1) { onReassigned(t('toastNeedFields')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/operator/supervisor/console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sel, operatorId: op, reason: reason.trim() }),
      });
      const j = await r.json();
      onReassigned(j.success ? t('toastChangeDone') : (j.error || t('toastChangeFail')));
      if (j.success) setReason('');
    } finally { setBusy(false); }
  };
  return (
    <>
      {/* #9 PPT — 배정 KPI 4 (배정대기 / 자동배정 완료 / 자동배정 제외 / 수동변경) */}
      <div className={`${styles.grid} ${styles.kpi}`}>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiWaiting')}</div><div className={styles.kpiValue}>{d.kpis.pendingManual}</div><div className={styles.kpiSub}>{t('asgKpiWaitingSub')}</div></div>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiAuto')}</div><div className={styles.kpiValue}>{d.assignedCustomers.length}</div><div className={styles.kpiSub}>{t('asgKpiAutoSub')}</div></div>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiExcluded')}</div><div className={styles.kpiValue}>{d.kpis.excludedOffline}</div><div className={styles.kpiSub}>{t('asgKpiExcludedSub')}</div></div>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiManual')}</div><div className={styles.kpiValue}>{d.kpis.changes}</div><div className={styles.kpiSub}>{t('asgKpiManualSub')}</div></div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div><h2>{t('asgRulesTitle')}</h2><p>{t('asgRulesDesc')}</p></div>
          <button className={`${styles.btn} ${styles.blue}`} onClick={onAuto}>{t('asgRun')}</button>
        </div>
        <div className={styles.cardBody}>
          <div className={`${styles.grid} ${styles.three}`}>
            {RULES.map((r, i) => <div key={i} className={styles.assignmentRule}><b>{r.n}</b><p>{r.tt}</p></div>)}
          </div>
        </div>
      </div>

      <div className={styles.assignmentLayout}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>{t('asgDoneTitle')}</h2><p>{t('asgDoneDesc')}</p></div></div>
          <div className={styles.cardBody} style={{ display: 'grid', gap: 10 }}>
            {d.assignedCustomers.map(c => {
              const b = methodInfo(c.method);
              return (
                <div key={c.customerId} className={`${styles.customerCard} ${sel === c.customerId ? styles.active : ''}`}
                  role="button" tabIndex={0} onClick={() => setSel(c.customerId)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b>{c.name}</b><span className={`${styles.badge} ${styles.blue}`}>{t('normal')}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{t('curAssign')}: {c.operator} · {timeOf(c.assignedAt)}</div>
                  <div className={styles.customerMeta}>
                    {c.taxTypes.map(tt => <span key={tt} className={`${styles.badge} ${styles.purple}`}>{tt}</span>)}
                    <span className={`${styles.badge} ${styles[b.c]}`}>{t(b.k)}</span>
                  </div>
                </div>
              );
            })}
            {d.assignedCustomers.length === 0 && <div className={styles.placeholder}>{t('noAssigned')}</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>{t('asgManualTitle')}</h2><p>{t('asgManualDesc')}</p></div></div>
          <div className={styles.cardBody} style={{ display: 'grid', gap: 12 }}>
            {selCust ? (
              <>
                <div className={styles.assignmentRule}><b>{selCust.name}</b><p>{t('curAssign')}: {selCust.operator}</p></div>
                <label>{t('colCounselor')}
                  <select value={op} onChange={e => setOp(e.target.value)}>
                    <option value="">{t('selectCounselor')}</option>
                    {d.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <label>{t('changeReason')}<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('changeReason')} /></label>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={submit}>{t('confirmChange')}</button>
                </div>
              </>
            ) : <div className={styles.placeholder}>{t('selectCustomerFirst')}</div>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>{t('asgHistTitle')}</h2><p>{t('asgHistDesc')}</p></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>{t('colCustomer')}</th><th>{t('colCounselor')}</th><th>{t('colMethod')}</th><th>{t('colDate')}</th></tr></thead>
              <tbody>
                {d.history.map((h, i) => {
                  const b = methodInfo(h.method);
                  return <tr key={i}><td><b>{h.name}</b></td><td>{h.operator}</td><td><span className={`${styles.badge} ${styles[b.c]}`}>{t(b.k)}</span></td><td>{timeOf(h.at)}</td></tr>;
                })}
                {d.history.length === 0 && <tr><td colSpan={4} style={{ color: '#94a3b8' }}>{t('noAsgHist')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 승인대기 + 승인 상세(고객화면 미러) ──
type ApprovalItem = ConsoleData['approvalPending'][number];
const DETAIL_MAP: Record<string, { ep: string; cols: Array<{ key: string; label: string; money?: boolean }> }> = {
  PPh21: { ep: 'pph21', cols: [{ key: 'name', label: '직원' }, { key: 'totalGross', label: '총지급', money: true }, { key: 'pph21', label: 'PPh21', money: true }] },
  PPh23: { ep: 'withholding', cols: [{ key: 'counterpartyName', label: '거래처' }, { key: 'grossAmount', label: '지급액', money: true }, { key: 'taxAmount', label: '세액', money: true }] },
  PPh4_2: { ep: 'withholding', cols: [{ key: 'counterpartyName', label: '거래처' }, { key: 'grossAmount', label: '지급액', money: true }, { key: 'taxAmount', label: '세액', money: true }] },
  PPN: { ep: 'ppn', cols: [{ key: 'fakturNumber', label: 'Faktur' }, { key: 'dpp', label: 'DPP', money: true }, { key: 'ppn', label: 'PPN', money: true }] },
};
type MirrorField = { key: string; label: string; money?: boolean };
type MirrorSection = { title: string; fields: MirrorField[] };
const MIRROR_SECTIONS: Record<string, MirrorSection[]> = {
  pph21: [
    { title: '직원 정보', fields: [{ key: 'employeeNumber', label: '사번' }, { key: 'npwp', label: 'NPWP' }, { key: 'nik', label: 'NIK' }, { key: 'ptkp', label: 'PTKP' }, { key: 'employmentStatus', label: '고용형태' }, { key: 'workerType', label: '직군' }, { key: 'position', label: '직책' }, { key: 'department', label: '부서' }] },
    { title: '근태', fields: [{ key: 'workingDays', label: '근무일' }, { key: 'absentDays', label: '결근일' }, { key: 'overtimeHours', label: '초과근무(시간)' }] },
    { title: '기본급 + 수당', fields: [{ key: 'baseSalary', label: '기본급', money: true }, { key: 'overtimePay', label: '초과근무수당', money: true }, { key: 'mealAllowance', label: '식대', money: true }, { key: 'transportAllowance', label: '교통비', money: true }, { key: 'positionAllowance', label: '직책수당', money: true }, { key: 'otherAllowances', label: '기타수당', money: true }, { key: 'laptopAllowance', label: '노트북', money: true }, { key: 'medicalAllowance', label: '의료', money: true }, { key: 'taxAllowance', label: '세금(Gross-up)', money: true }, { key: 'annualLeavePay', label: '연차', money: true }] },
    { title: '특수 지급', fields: [{ key: 'severanceAllowance', label: '퇴직금', money: true }, { key: 'pkwtCompensation', label: 'PKWT 보상', money: true }] },
    { title: '보너스', fields: [{ key: 'bonusOnly', label: '보너스', money: true }, { key: 'thrOnly', label: 'THR', money: true }, { key: 'commission', label: '커미션', money: true }] },
    { title: '공제', fields: [{ key: 'bpjsKesehatan', label: 'BPJS 건강', money: true }, { key: 'bpjsKetenagakerjaan', label: 'BPJS 고용', money: true }, { key: 'jhtEmployee', label: 'JHT', money: true }, { key: 'jpEmployee', label: 'JP', money: true }, { key: 'loanDeduction', label: '대출상환', money: true }, { key: 'otherDeductions', label: '기타공제', money: true }] },
    { title: '자동 계산', fields: [{ key: 'totalGross', label: '총지급', money: true }, { key: 'pph21', label: 'PPh21', money: true }, { key: 'netSalary', label: '실수령', money: true }] },
  ],
  withholding: [
    { title: '거래 정보', fields: [{ key: 'transactionDate', label: '거래일자' }, { key: 'counterpartyName', label: '거래처명' }, { key: 'counterpartyNpwp', label: 'NPWP' }, { key: 'serviceType', label: '세목' }, { key: 'counterpartyAddress', label: '거래처 주소' }] },
    { title: '인보이스 · 지급', fields: [{ key: 'invoiceNumber', label: '인보이스 번호' }, { key: 'invoiceDate', label: '인보이스 일자' }, { key: 'paymentDate', label: '지급일' }, { key: 'description', label: '설명' }, { key: 'notes', label: '메모' }] },
    { title: '증빙 · 금액', fields: [{ key: 'buktiPotongNumber', label: 'Bukti Potong 번호' }, { key: 'buktiPotongDate', label: 'Bukti Potong 일자' }, { key: 'grossAmount', label: '총지급액', money: true }, { key: 'taxAmount', label: '세액', money: true }] },
  ],
  ppn: [
    { title: 'Faktur 정보', fields: [{ key: 'fakturNumber', label: 'faktur 번호' }, { key: 'fakturDate', label: 'faktur 일자' }, { key: 'counterpartyName', label: '거래처명' }, { key: 'counterpartyNpwp', label: 'NPWP' }, { key: 'counterpartyAddress', label: '거래처 주소' }] },
    { title: '인보이스 · 설명', fields: [{ key: 'invoiceNumber', label: '인보이스 번호' }, { key: 'description', label: '설명' }, { key: 'notes', label: '메모' }] },
    { title: '금액', fields: [{ key: 'dpp', label: 'DPP', money: true }, { key: 'dppNilaiLain', label: 'DPP Nilai Lain', money: true }, { key: 'ppn', label: 'PPN', money: true }] },
  ],
};

// PPT 승인대기 — 4 세목 탭
const APPR_TABS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'pph21', label: 'PPh 21', types: ['PPh21'] },
  { key: 'wht', label: 'Withholding', types: ['PPh23', 'PPh4_2', 'PPh15', 'PPh22', 'PPh26'] },
  { key: 'cit', label: 'PPh 25', types: ['PPh25', 'PPh_FINAL'] },
  { key: 'ppn', label: 'PPN', types: ['PPN'] },
];
type ApprGroup = { customerId: string; company: string; npwp: string | null; counselor: string; period: string; note: string | null; items: ApprovalItem[] };

function ApprovalView({ d, onChanged }: { d: ConsoleData; onChanged: () => void }) {
  const t = useT();
  const groups = useMemo(() => {
    const m = new Map<string, ApprGroup>();
    for (const a of d.approvalPending) {
      const g = m.get(a.customerId) ?? { customerId: a.customerId, company: a.company, npwp: a.npwp, counselor: a.counselor, period: a.period, note: a.note, items: [] as ApprovalItem[] };
      g.items.push(a);
      if (a.note && !g.note) g.note = a.note;
      m.set(a.customerId, g);
    }
    return [...m.values()];
  }, [d.approvalPending]);
  const [selCust, setSelCust] = useState<string | null>(groups[0]?.customerId ?? null);
  const [tab, setTab] = useState('pph21');
  const cur = groups.find(g => g.customerId === selCust) ?? null;
  const tabTypes = APPR_TABS.find(x => x.key === tab)?.types ?? [];
  const curItem = cur?.items.find(it => tabTypes.includes(it.taxType)) ?? null;

  return (
    <div className={styles.assignmentLayout}>
      {/* 좌: 승인대기 리스트 (고객 단위) */}
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>{t('apprListTitle')}</h2><p>{t('apprListDesc')}</p></div><span className={styles.cnt} style={{ background: '#dbeafe', color: '#1d4ed8' }}>{groups.length}</span></div>
        <div className={styles.cardBody} style={{ display: 'grid', gap: 10 }}>
          {groups.map(g => (
            <div key={g.customerId} className={`${styles.customerCard} ${selCust === g.customerId ? styles.active : ''}`}
              role="button" tabIndex={0} onClick={() => setSelCust(g.customerId)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <b>{g.company}</b>
                {g.note && <span className={`${styles.badge} ${styles.amber}`}>{String(g.note).slice(0, 24)}</span>}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                {g.items.map(it => it.taxType).join(', ')} · {g.period} · {g.counselor}
              </div>
            </div>
          ))}
          {groups.length === 0 && <div className={styles.placeholder}>{t('noApproval')}</div>}
        </div>
      </div>

      {/* 우: 선택 고객 상세 (4 세목 탭) */}
      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        {cur ? (
          <>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div><h2>{cur.company}</h2><p>NPWP {cur.npwp ?? '—'} · {cur.period} · {cur.counselor}</p></div>
                <span className={`${styles.badge} ${styles.amber}`}>{t('supPending')}</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.assignmentRule}><p>{t('apprPrinciple')}</p></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {APPR_TABS.map(x => {
                    const has = cur.items.some(it => x.types.includes(it.taxType));
                    return (
                      <button key={x.key} onClick={() => setTab(x.key)}
                        className={`${styles.btn} ${tab === x.key ? styles.blue : ''}`}
                        style={{ opacity: has ? 1 : 0.5 }}>{x.label}{has ? '' : ' ·'}</button>
                    );
                  })}
                </div>
              </div>
            </div>
            {curItem
              ? <ApprovalTaxWork key={curItem.id} item={curItem} onDecided={onChanged} />
              : <div className={styles.card}><div className={styles.placeholder}>{t('noTaxWork')}</div></div>}
          </>
        ) : <div className={styles.card}><div className={styles.placeholder}>{t('selectCustomerFirst')}</div></div>}
      </div>
    </div>
  );
}

interface DetailResp { rows?: Array<Record<string, unknown>>; summary?: Record<string, number> }
interface ApprovalState { status: string; requestNote?: string | null; canApprove: boolean; rejectedReason?: string | null }
// 세목별 요약 KPI 매핑
const SUMMARY_MAP: Record<string, Array<{ k: string; label: string; money?: boolean }>> = {
  pph21: [{ k: 'employeeCount', label: 'kEmployees' }, { k: 'totalGross', label: 'kTotalPay', money: true }, { k: 'totalPph21', label: 'colAmount', money: true }],
  withholding: [{ k: 'txnCount', label: 'kCount' }, { k: 'totalGross', label: 'kTotalPay', money: true }, { k: 'totalTax', label: 'colAmount', money: true }],
  ppn: [{ k: 'fakturCount', label: 'kCount' }, { k: 'totalDpp', label: 'kTotalPay', money: true }, { k: 'totalPpn', label: 'colAmount', money: true }],
};
function ApprovalTaxWork({ item, onDecided }: { item: ApprovalItem; onDecided: () => void }) {
  const t = useT();
  const cfg = DETAIL_MAP[item.taxType];
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [appr, setAppr] = useState<ApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (cfg) fetch(`/api/operator/workqueue/${item.id}/${cfg.ep}`).then(r => r.json()).then(j => { if (j.success) setDetail(j.data); }).catch(() => {});
    fetch(`/api/operator/workqueue/${item.id}/approval`).then(r => r.json()).then(j => { if (j.success) setAppr(j.data as ApprovalState); }).catch(() => {});
  }, [item.id, cfg]);

  const decide = async (action: 'approve' | 'reject', rejectedReason?: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/operator/queue', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action, ...(rejectedReason ? { rejectedReason } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((j as { error?: string }).error || `${t('reject')} (${r.status})`); return; }
      onDecided();
    } catch { setErr(t('toastNet')); }
    finally { setBusy(false); }
  };

  const rows = detail?.rows ?? [];
  const editedCount = rows.filter(r => r.operatorEdits && Object.keys(r.operatorEdits as object).length > 0).length;
  const summary = detail?.summary ?? {};
  const summaryCells = cfg ? (SUMMARY_MAP[cfg.ep] ?? []) : [];

  return (
    <div className={styles.card}>
      <div className={styles.cardBody} style={{ display: 'grid', gap: 12 }}>
          {/* 고객 입력 요약 */}
          {summaryCells.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>{t('summaryTitle')}</b>
                <span className={`${styles.badge} ${styles.green}`}>{t('confirmedData')}</span>
              </div>
              <div className={`${styles.grid} ${styles.three}`}>
                {summaryCells.map(c => (
                  <div key={c.k} className={styles.kpiCard} style={{ padding: 12 }}>
                    <div className={styles.kpiLabel}>{t(c.label)}</div>
                    <div style={{ fontSize: 18, fontWeight: 1000, marginTop: 4 }}>{c.money ? rp(Number(summary[c.k] ?? 0)) : String(summary[c.k] ?? 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appr?.requestNote && (
            <div className={styles.reviewRequestBox}><b>{t('reviewReqTitle')}</b><p style={{ color: '#78350f', fontSize: 12 }}>{t('reviewReqDesc')}</p><p>{appr.requestNote}</p></div>
          )}
          {appr?.rejectedReason && <div className={styles.assignmentRule}><b>{t('prevReject')}</b><p>{appr.rejectedReason}</p></div>}

          {cfg ? (
            <div className={styles.customerUi}>
              <div className={styles.customerUiHead}>
                <div><h3>{t('mirrorScreenTitle', { tax: item.taxType })}</h3><p>{t('mirrorSub', { rows: rows.length, edited: editedCount })}</p></div>
                <span className={`${styles.badge} ${styles.green}`}>{t('counselorReviewed')}</span>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr>{cfg.cols.map(c => <th key={c.key}>{c.label}</th>)}<th>{t('colStatus')}</th><th></th></tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => {
                      const edits = (r.operatorEdits as Record<string, unknown> | null) ?? null;
                      const edited = edits && Object.keys(edits).length > 0;
                      const flags = r.flags as { level?: string; label?: string } | undefined;
                      const sections = MIRROR_SECTIONS[cfg.ep] ?? [];
                      return (
                        <Fragment key={i}>
                          <tr style={edited ? { background: '#fff7ed' } : undefined}>
                            {cfg.cols.map(c => <td key={c.key}>{c.money ? rp(Number(r[c.key] ?? 0)) : String(r[c.key] ?? '—')}</td>)}
                            <td><span className={`${styles.badge} ${flags?.level === 'red' ? styles.red : flags?.level === 'amber' ? styles.amber : styles.green}`}>{flags?.label ?? '—'}</span></td>
                            <td>{sections.length > 0 && <button className={styles.mirrorRowBtn} onClick={() => setExpanded(expanded === i ? null : i)}>{expanded === i ? t('collapse') : t('allFields')}</button>}</td>
                          </tr>
                          {expanded === i && sections.map(sec => (
                            <tr key={sec.title}>
                              <td colSpan={cfg.cols.length + 2} style={{ padding: 0 }}>
                                <div className={styles.formSection}>
                                  <div className={styles.formSectionTitle}>{sec.title}</div>
                                  <div className={styles.formGrid}>
                                    {sec.fields.map(f => {
                                      const isEdited = !!edits && f.key in edits;
                                      return (
                                        <div key={f.key} className={`${styles.formCell} ${isEdited ? styles.edited : ''}`}>
                                          <span>{f.label}{isEdited ? ' ✎' : ''}</span>
                                          <b>{f.money ? rp(Number(r[f.key] ?? 0)) : String(r[f.key] ?? '—')}</b>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={cfg.cols.length + 2} style={{ color: '#94a3b8' }}>{t('loadingOrEmpty')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={styles.assignmentRule}><p>{t('noMirror', { tax: item.taxType })}</p></div>}

          {err && <div className={styles.assignmentRule} style={{ borderColor: '#fecaca', background: '#fef2f2' }}><p>{err}</p></div>}

          {rejecting && (
            <div className={styles.reviewRequestBox}>
              <b>{t('rejectTitle')}</b>
              <p>{t('rejectBody')}</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('rejectPlaceholder')} />
            </div>
          )}

          {/* 수퍼바이저 최종 판단 (인라인) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            {appr?.canApprove && appr.status === 'PENDING_APPROVAL' ? (
              rejecting ? (
                <>
                  <button className={styles.btn} onClick={() => setRejecting(false)} disabled={busy}>{t('cancel')}</button>
                  <button className={`${styles.btn} ${styles.red}`} disabled={busy || reason.trim().length < 1} onClick={() => decide('reject', reason.trim())}>{t('rejectConfirm')}</button>
                </>
              ) : (
                <>
                  <button className={styles.btn} onClick={() => setRejecting(true)} disabled={busy}>{t('reject')}</button>
                  <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={() => decide('approve')}>{t('approve')}</button>
                </>
              )
            ) : <span className={`${styles.badge} ${styles.amber}`}>{appr?.status === 'APPROVED' ? t('approve') : t('noAuth')}</span>}
          </div>
      </div>
    </div>
  );
}

// ── lazy fetch 훅 ──
function useLazy<TD>(url: string): { data: TD | null; err: string | null; reload: () => void } {
  const [data, setData] = useState<TD | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(() => {
    setErr(null);
    fetch(url).then(r => r.json()).then(j => { if (j.success) setData(j.data as TD); else setErr(j.error || 'error'); })
      .catch(() => setErr('network'));
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload };
}

// ── 상담원 평가 ──
interface EvalRow { name: string; reject_rate: number | null; approval_pass_rate: number | null; scores: { total: number; accuracy: number; speed: number; approval: number; satisfaction: number }; suggested_incentive_amount?: number; evaluation_label?: string }
function EvaluationView() {
  const t = useT();
  const { data, err } = useLazy<{ operators: EvalRow[]; disclaimer?: string; isSuggestionOnly?: boolean }>('/api/operator/evaluation');
  if (err) return <ErrCard msg={t('toastNet')} />;
  if (!data) return <LoadingCard />;
  const rows = data.operators ?? [];
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>{t('evalHeadTitle')}</h2><p>{data.disclaimer || t('evalDefaultDisclaimer')}</p></div>
        {data.isSuggestionOnly && <span className={`${styles.badge} ${styles.amber}`}>{t('evalSuggestBadge')}</span>}</div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>{t('colCounselor')}</th><th>{t('colScore')}</th><th>{t('colRejectRate')}</th><th>{t('colApprovalPass')}</th><th>{t('colAccuracy')}</th><th>{t('colSpeed')}</th><th>{t('colIncentive')}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.name}</b> {r.evaluation_label && <span className={`${styles.badge} ${styles.green}`}>{r.evaluation_label}</span>}</td>
                  <td><b>{r.scores.total.toFixed(0)}</b></td>
                  <td>{r.reject_rate == null ? '—' : r.reject_rate.toFixed(1) + '%'}</td>
                  <td>{r.approval_pass_rate == null ? '—' : r.approval_pass_rate.toFixed(1) + '%'}</td>
                  <td>{r.scores.accuracy.toFixed(0)}</td><td>{r.scores.speed.toFixed(0)}</td>
                  <td className={styles.money}>{r.suggested_incentive_amount ? rp(r.suggested_incentive_amount) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ color: '#94a3b8' }}>{t('noEval')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 상담원 소속관리 ──
interface Transfer { id: string; operatorName: string; fromSupervisorName: string | null; toSupervisorName: string; clientMode: string; reason: string | null; status: string; direction: string; createdAt: string }
const CLIENT_MODES = ['WITH_CLIENTS', 'OPERATOR_ONLY', 'REASSIGN_CLIENTS'] as const;
// #8 소속관리 — PPT: 수퍼바이저별 상담원 로스터(이동요청) + 협의 요청함 테이블(승인/거절)
function AffiliationView({ d, onToast, onChanged }: { d: ConsoleData; onToast: (m: string) => void; onChanged: () => void }) {
  const t = useT();
  const { data, err, reload } = useLazy<{ incoming: Transfer[]; transfers: Transfer[] }>('/api/operator/supervisor/affiliation');
  const [xfer, setXfer] = useState<{ operatorId: string; name: string } | null>(null);
  const [toSup, setToSup] = useState('');
  const [mode, setMode] = useState<typeof CLIENT_MODES[number]>('OPERATOR_ONLY');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const r = await fetch(`/api/operator/supervisor/affiliation/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: action === 'APPROVE' ? t('approveWord') : t('reject') }),
      });
      const j = await r.json();
      onToast(j.success ? (action === 'APPROVE' ? t('toastChangeDone') : t('reject')) : (j.error || t('toastChangeFail')));
      reload(); onChanged();
    } catch { onToast(t('toastNet')); }
  };
  const submitXfer = async () => {
    if (!xfer || !toSup || reason.trim().length < 2) { onToast(t('toastNeedFields')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/operator/supervisor/affiliation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: xfer.operatorId, toSupervisorId: toSup, clientMode: mode, reason: reason.trim() }),
      });
      const j = await r.json();
      onToast(j.success ? t('affReqSent') : (typeof j.error === 'string' ? j.error : t('toastChangeFail')));
      if (j.success) { setXfer(null); setToSup(''); setReason(''); setMode('OPERATOR_ONLY'); reload(); }
    } catch { onToast(t('toastNet')); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* 수퍼바이저별 상담원 로스터 */}
      <div className={styles.supervisorGrid}>
        {d.roster.map(g => (
          <div key={g.supervisorId ?? 'none'} className={styles.supervisorCard}>
            <h2 style={{ margin: 0 }}>{g.supervisor}</h2>
            <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 8px' }}>{t('affStaffCount', { n: g.staff.length })}</p>
            {g.staff.map(c => (
              <div key={c.id} className={styles.staffPill}>
                <span>
                  <b><i className={`${styles.statusDot} ${c.workState === 'offline' ? styles.offline : c.workState === 'busy' ? styles.busy : styles.online}`} />{c.name}</b><br />
                  <small>{t(`ws_${c.workState}` as string) || c.workState} · {t('customer')} {c.customers} · {t('supPendingShort')} {c.pending} · {c.specialty}</small>
                </span>
                <button className={`${styles.btn} ${styles.blue}`} onClick={() => { setXfer({ operatorId: c.id, name: c.name }); setToSup(''); setReason(''); }}>{t('transferRequest')}</button>
              </div>
            ))}
            {g.staff.length === 0 && <div className={styles.placeholder}>{t('noStaff')}</div>}
          </div>
        ))}
        {d.roster.length === 0 && <div className={styles.placeholder}>{t('noStaff')}</div>}
      </div>

      {/* 협의 요청함 (나에게 온 이동요청) */}
      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardHead}><div><h2>{t('coordinationBox')}</h2><p>{t('affiliationDesc')}</p></div></div>
        <div className={styles.cardBody}>
          {err && <div className={styles.placeholder}>{t('toastNet')}</div>}
          {!data && !err && <div className={styles.placeholder}>{t('loading')}</div>}
          {data && (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>{t('requester')}</th><th>{t('target')}</th><th>{t('current')}</th><th>{t('changeTo')}</th><th>{t('customerScope')}</th><th>{t('reason')}</th><th>{t('status')}</th><th>{t('action')}</th></tr></thead>
                <tbody>
                  {data.incoming.map(tr => (
                    <tr key={tr.id}>
                      <td>{tr.fromSupervisorName ?? '—'}</td><td><b>{tr.operatorName}</b></td>
                      <td>{tr.fromSupervisorName ?? '—'}</td><td>{tr.toSupervisorName}</td>
                      <td>{tr.clientMode}</td><td>{tr.reason ?? '—'}</td>
                      <td><span className={`${styles.badge} ${styles.amber}`}>{tr.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className={`${styles.btn} ${styles.green}`} onClick={() => decide(tr.id, 'APPROVE')}>{t('approveWord')}</button>{' '}
                        <button className={`${styles.btn} ${styles.red}`} onClick={() => decide(tr.id, 'REJECT')}>{t('reject')}</button>
                      </td>
                    </tr>
                  ))}
                  {data.incoming.length === 0 && <tr><td colSpan={8} style={{ color: '#94a3b8' }}>{t('noIncoming')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 이동요청 모달 */}
      {xfer && (
        <div className={styles.modalBg} onClick={() => setXfer(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{t('transferRequest')} · {xfer.name}</h2>
            <div className={styles.modalBody} style={{ display: 'grid', gap: 12 }}>
              <label>{t('changeTo')}
                <select value={toSup} onChange={e => setToSup(e.target.value)}>
                  <option value="">{t('selectCounselor')}</option>
                  {d.supervisorOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>{t('customerScope')}
                <select value={mode} onChange={e => setMode(e.target.value as typeof CLIENT_MODES[number])}>
                  {CLIENT_MODES.map(m => <option key={m} value={m}>{t(`mode_${m}` as string) || m}</option>)}
                </select>
              </label>
              <label>{t('reason')}<textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} /></label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btn} onClick={() => setXfer(null)}>{t('cancel')}</button>
              <button className={`${styles.btn} ${styles.blue}`} disabled={busy} onClick={submitXfer}>{t('transferRequest')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── #10 ID Billing 이관현황 (PPT: 단일 테이블 + 고객/승인수퍼바이저/상담원 정렬) ──
interface HandoverPending { company: string; taxPeriod: string; approver: string; consultant: string; approvedAt: string | null }
interface HandoverIssued { serialNo: string; company: string; taxType: string; taxPeriod: string; amount: number; approver: string; consultant: string; approvedAt: string | null; sendStatus: string; ntpnStatus: string; ntpn: string | null }
type BillRow = { company: string; taxType: string; period: string; approver: string; approvedAt: string | null; consultant: string; billing: 'TARGET' | 'ISSUED'; sent: string; ntpn: string; ntpnValue: string | null };
type BillSort = 'company' | 'approver' | 'consultant';
function BillingView({ locale }: { locale: string }) {
  const t = useT();
  const { data, err } = useLazy<{ pending: HandoverPending[]; issued: HandoverIssued[] }>('/api/operator/supervisor/billing-handover');
  const [sortKey, setSortKey] = useState<BillSort>('company');
  if (err) return <ErrCard msg={t('toastNet')} />;
  if (!data) return <LoadingCard />;

  const rows: BillRow[] = [
    ...data.issued.map<BillRow>(r => ({
      company: r.company, taxType: r.taxType || '—', period: r.taxPeriod || '—',
      approver: r.approver, approvedAt: r.approvedAt, consultant: r.consultant,
      billing: 'ISSUED', sent: r.sendStatus === 'SENT' ? t('sent') : t('notSent'),
      ntpn: r.ntpnStatus === 'PAID' ? t('paid') : t('awaiting'), ntpnValue: r.ntpn,
    })),
    ...data.pending.map<BillRow>(p => ({
      company: p.company, taxType: '—', period: p.taxPeriod || '—',
      approver: p.approver, approvedAt: p.approvedAt, consultant: p.consultant,
      billing: 'TARGET', sent: '—', ntpn: '—', ntpnValue: null,
    })),
  ].sort((a, b) => (a[sortKey] || '').localeCompare(b[sortKey] || '', 'ko'));

  const sortBtn = (k: BillSort, label: string) => (
    <button className={`${styles.btn} ${sortKey === k ? styles.blue : ''}`} onClick={() => setSortKey(k)}>{label}</button>
  );
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div><h2>{t('billTitle')}</h2><p>{t('billFlow')}</p></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{t('sortBy')}:</span>
          {sortBtn('company', t('colCustomer'))}
          {sortBtn('approver', t('colApprover'))}
          {sortBtn('consultant', t('colCounselor'))}
          <a className={`${styles.btn} ${styles.blue}`} href={`/${locale}/operator/billing-issuance`}>{t('billBoard')}</a>
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr>
              <th>{t('colCustomer')}</th><th>{t('colTaxType')}</th><th>{t('period')}</th>
              <th>{t('colApprover')}</th><th>{t('approvedTime')}</th><th>{t('colCounselor')}</th>
              <th>ID Billing</th><th>{t('colSend')}</th><th>NTPN</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.company}</b></td><td>{r.taxType}</td><td>{r.period}</td>
                  <td>{r.approver}</td><td>{r.approvedAt ? timeOf(r.approvedAt) : '—'}</td><td>{r.consultant}</td>
                  <td><span className={`${styles.badge} ${r.billing === 'ISSUED' ? styles.green : styles.amber}`}>{r.billing === 'ISSUED' ? t('billIssued') : t('billTarget')}</span></td>
                  <td>{r.sent === '—' ? '—' : <span className={`${styles.badge} ${r.sent === t('sent') ? styles.green : styles.amber}`}>{r.sent}</span>}</td>
                  <td>{r.ntpnValue ? <span className={`${styles.badge} ${styles.cyan}`}>{r.ntpnValue}</span> : (r.ntpn === '—' ? '—' : <span className={`${styles.badge} ${r.ntpn === t('paid') ? styles.green : styles.amber}`}>{r.ntpn}</span>)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ color: '#94a3b8' }}>{t('noBillIssued')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 감사로그 ──
function AuditView({ d }: { d: ConsoleData }) {
  const t = useT();
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>{t('audHeadTitle')}</h2><p>{t('audHeadDesc')}</p></div></div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>{t('colTime')}</th><th>{t('colCustomer')}</th><th>{t('colActivity')}</th><th>{t('colRole')}</th><th>{t('colTaxType')}</th></tr></thead>
            <tbody>
              {d.audit.map((a, i) => (
                <tr key={i}><td>{timeOf(a.at)}</td><td><b>{a.company}</b></td><td>{a.activity}</td><td>{a.role}</td><td>{a.taxType ?? '—'}</td></tr>
              ))}
              {d.audit.length === 0 && <tr><td colSpan={5} style={{ color: '#94a3b8' }}>{t('noAudit')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoadingCard() { const t = useT(); return <div className={styles.card}><div className={styles.placeholder}>{t('loading')}</div></div>; }
function ErrCard({ msg }: { msg: string }) { return <div className={styles.card}><div className={styles.placeholder}>{msg}</div></div>; }
