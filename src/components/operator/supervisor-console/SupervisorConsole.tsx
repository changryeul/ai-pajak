'use client';
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardCheck, Star, Users, UserCog, Receipt, ScrollText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './console.module.css';
import { makeT, LANGS, type Lang, type T } from './console-i18n';

const VIEW_ICON: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} />, approval: <ClipboardCheck size={18} />,
  evaluation: <Star size={18} />, affiliation: <Users size={18} />, assignment: <UserCog size={18} />,
  billing: <Receipt size={18} />, audit: <ScrollText size={18} />,
};

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
// workState 라벨 — 사전에 있으면 번역, 없으면 원문(ws_ 접두 노출 방지).
const wsLabel = (t: T, ws: string) => { const s = t(`ws_${ws}`); return s.startsWith('ws_') ? ws : s; };

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


  const navBtn = (v: View, label: string, count?: number | string) => (
    <button className={`${styles.nav} ${view === v ? styles.active : ''}`} onClick={() => setView(v)} title={label}>
      <span className={styles.navIco}>{VIEW_ICON[v]}</span>
      <span className={styles.navLbl}>{label}</span>
      {count != null && <span className={styles.cnt}>{count}</span>}
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
              {/* 수정요청 8/21 #23,24,27,29,33,39,40 — 월간 리포트 전 뷰 삭제 */}
              <button className={styles.btn} onClick={logout}>{t('logout')}</button>
            </div>
          </div>

          {!data ? <div className={styles.card}><div className={styles.placeholder}>{t('loading')}</div></div>
            : view === 'dashboard' ? <DashboardView d={data} />
            : view === 'assignment' ? <AssignmentView d={data} onReassigned={async (m) => { showToast(m); await load(); }} />
            : view === 'approval' ? <ApprovalView d={data} onChanged={async () => { showToast(t('toastChangeDone')); await load(); }} />
            : view === 'evaluation' ? <EvaluationView />
            : view === 'affiliation' ? <AffiliationView d={data} onToast={showToast} onChanged={load} />
            : view === 'billing' ? <BillingView locale={locale} />
            : <AuditView d={data} />}
        </main>
      </div>
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
    </TCtx.Provider>
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
function AssignmentView({ d, onReassigned }: { d: ConsoleData; onReassigned: (m: string) => void }) {
  const t = useT();
  const [sel, setSel] = useState<string | null>(d.assignedCustomers[0]?.customerId ?? null);
  const [op, setOp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // #36 — 고객명 직접 검색해 배정 변경 대상 선택
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ customerId: string; name: string; operator: string | null }>>([]);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const runSearch = async (val: string) => {
    setQ(val);
    if (val.trim().length < 1) { setResults([]); return; }
    try {
      const r = await fetch(`/api/operator/supervisor/console/customer-search?q=${encodeURIComponent(val.trim())}`);
      const j = await r.json();
      if (j.success) setResults(j.data.customers);
    } catch { /* keep */ }
  };
  const selCust = d.assignedCustomers.find(c => c.customerId === sel)
    ?? (sel && pickedName ? { name: pickedName, operator: '—' } : null);
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
      {/* #38 — 배정대기/자동배정제외(항상 0) 삭제. 자동배정완료·수동변경 KPI + 팀별/상담원별 배정 고객 수. */}
      <div className={`${styles.grid} ${styles.kpi}`}>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiAuto')}</div><div className={styles.kpiValue}>{d.assignedCustomers.length}</div><div className={styles.kpiSub}>{t('asgKpiAutoSub')}</div></div>
        <div className={styles.kpiCard}><div className={styles.kpiLabel}>{t('asgKpiManual')}</div><div className={styles.kpiValue}>{d.kpis.changes}</div><div className={styles.kpiSub}>{t('asgKpiManualSub')}</div></div>
      </div>

      {/* #38 — 팀별/상담원별 배정 고객 수 (수동변경 판단용) */}
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>{t('asgLoadTitle')}</h2><p>{t('asgLoadDesc')}</p></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>{t('colTeam')}</th><th>{t('colCounselor')}</th><th>{t('asgLoadCount')}</th></tr></thead>
              <tbody>
                {d.roster.flatMap(g => g.staff.map(s => (
                  <tr key={s.id}><td>{g.supervisor}</td><td><b>{s.name}</b></td><td>{s.customers}</td></tr>
                )))}
                {d.roster.every(g => g.staff.length === 0) && <tr><td colSpan={3} style={{ color: '#94a3b8' }}>{t('noStaff')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* #37 — 모든 고객은 기본 자동배정. "신규 접수 자동배정 실행" 버튼 삭제. */}
          <div><h2>{t('asgRulesTitle')}</h2><p>{t('asgRulesDesc')}</p></div>
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

        {/* #19 — 우측 컬럼: 수동변경 + (그 아래로 이동한) 배정/변경 이력 */}
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className={styles.card}>
            <div className={styles.cardHead}><div><h2>{t('asgManualTitle')}</h2><p>{t('asgManualDesc')}</p></div></div>
            <div className={styles.cardBody} style={{ display: 'grid', gap: 12 }}>
              {/* #36 — 고객명 직접 검색 */}
              <div style={{ position: 'relative' }}>
                <label>{t('searchCustomer')}
                  <input value={q} onChange={e => runSearch(e.target.value)} placeholder={t('searchCustomerPh')} />
                </label>
                {results.length > 0 && (
                  <div style={{ marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {results.map(r => (
                      <button key={r.customerId} className={styles.searchRow}
                        onClick={() => { setSel(r.customerId); setPickedName(r.name); setResults([]); setQ(''); }}>
                        <b>{r.name}</b>{r.operator ? <span style={{ color: '#64748b', fontSize: 11 }}> · {t('curAssign')} {r.operator}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
        </div>
      </div>
    </>
  );
}

// ── 승인대기 + 승인 상세(고객화면 미러) ──
type ApprovalItem = ConsoleData['approvalPending'][number];
const DETAIL_MAP: Record<string, { ep: string; cols: Array<{ key: string; label: string; money?: boolean }> }> = {
  PPh21: { ep: 'pph21', cols: [{ key: 'name', label: '직원' }, { key: 'totalGross', label: '총지급', money: true }, { key: 'pph21', label: 'PPh21', money: true }] },
  // 원천세 거래리스트 — PPT: 일자/거래처/NPWP/증빙번호/거래내용/DPP/세율/세액
  PPh23: { ep: 'withholding', cols: [{ key: 'transactionDate', label: '일자' }, { key: 'counterpartyName', label: '거래처' }, { key: 'counterpartyNpwp', label: 'NPWP' }, { key: 'buktiPotongNumber', label: '증빙번호' }, { key: 'description', label: '거래내용' }, { key: 'grossAmount', label: 'DPP', money: true }, { key: 'taxRate', label: '세율' }, { key: 'taxAmount', label: '세액', money: true }] },
  PPh4_2: { ep: 'withholding', cols: [{ key: 'transactionDate', label: '일자' }, { key: 'counterpartyName', label: '거래처' }, { key: 'counterpartyNpwp', label: 'NPWP' }, { key: 'buktiPotongNumber', label: '증빙번호' }, { key: 'description', label: '거래내용' }, { key: 'grossAmount', label: 'DPP', money: true }, { key: 'taxRate', label: '세율' }, { key: 'taxAmount', label: '세액', money: true }] },
  PPN: { ep: 'ppn', cols: [{ key: 'fakturNumber', label: 'Faktur' }, { key: 'dpp', label: 'DPP', money: true }, { key: 'ppn', label: 'PPN', money: true }] },
  // 선납법인세 — umkm(tax_monthly_payment) 실납부 데이터
  PPh25: { ep: 'umkm', cols: [{ key: 'taxType', label: '세목' }, { key: 'amountDue', label: '당월 세액', money: true }, { key: 'kodeBilling', label: 'Kode Billing' }, { key: 'paymentStatus', label: '납부상태' }] },
  PPh_FINAL: { ep: 'umkm', cols: [{ key: 'taxType', label: '세목' }, { key: 'amountDue', label: '당월 세액', money: true }, { key: 'kodeBilling', label: 'Kode Billing' }, { key: 'paymentStatus', label: '납부상태' }] },
};
// 세목별 상세 화면 제목 (PPT 헤더)
const SECTION_TITLE: Record<string, { tk: string }> = {
  pph21: { tk: 'secPph21' }, withholding: { tk: 'secWht' }, ppn: { tk: 'secPpn' }, umkm: { tk: 'secCit' },
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
  // #26 — 승인/반려 후 해당 고객이 목록에서 빠지면 다음 고객으로 자동 이동(빈 화면·오해 방지).
  useEffect(() => {
    if (groups.length === 0) { if (selCust !== null) setSelCust(null); return; }
    if (!groups.some(g => g.customerId === selCust)) setSelCust(groups[0].customerId);
  }, [groups, selCust]);
  const cur = groups.find(g => g.customerId === selCust) ?? null;
  const tabTypes = APPR_TABS.find(x => x.key === tab)?.types ?? [];
  const curItem = cur?.items.find(it => tabTypes.includes(it.taxType)) ?? null;

  return (
    <div className={styles.approvalLayout}>
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
interface FourValue { kind: string; customerInput: number | null; ai: number | null; consultant: number | null; approved: number | null }
interface ReviewReq { id: string; calcKind: string | null; itemLabel: string; reason: string; status: string; supervisorComment: string | null }
interface ApprovalExtra { session: { id: string; status: string; period: string } | null; fourValues: FourValue[]; reviewRequests: ReviewReq[] }
const KIND_LABEL: Record<string, string> = {
  PPH21_TER: 'PPh 21', WITHHOLDING_SUMMARY: 'Withholding', CORP_TAX_MONTHLY: 'PPh 25', PPN_NET: 'PPN', BANK_RECON: 'Bank',
};
// 세목별 요약 KPI 매핑
const SUMMARY_MAP: Record<string, Array<{ k: string; label: string; money?: boolean }>> = {
  pph21: [{ k: 'employeeCount', label: 'kEmployees' }, { k: 'totalGross', label: 'kTotalPay', money: true }, { k: 'totalPph21', label: 'colAmount', money: true }],
  withholding: [{ k: 'txnCount', label: 'kCount' }, { k: 'totalGross', label: 'kTotalPay', money: true }, { k: 'totalTax', label: 'colAmount', money: true }],
  ppn: [{ k: 'fakturCount', label: 'kCount' }, { k: 'totalDpp', label: 'kTotalPay', money: true }, { k: 'totalPpn', label: 'colAmount', money: true }],
  umkm: [{ k: 'recordCount', label: 'kCount' }, { k: 'totalDue', label: 'kTotalDue', money: true }, { k: 'totalPaid', label: 'kTotalPaid', money: true }],
};
// PPN 매출/매입 Coretax 대조 (PPT: 매출 PPN 대조 + 매입 PPN 대조 + 부가세 계산 로직)
type PpnRow = Record<string, unknown>;
function reconBadge(t: T, s: string | null): { c: string; label: string } {
  if (s === 'MATCH') return { c: 'green', label: t('reconMatch') };
  if (s === 'DIFF') return { c: 'red', label: t('reconDiff') };
  if (s === 'MISSING_CORETAX' || s === 'MISSING_CUSTOMER') return { c: 'amber', label: t('reconMissing') };
  return { c: 'green', label: t('reconNormal') };
}
function PpnReconView({ rows }: { rows: PpnRow[] }) {
  const t = useT();
  const out = rows.filter(r => r.fakturType === 'KELUARAN');
  const inp = rows.filter(r => r.fakturType === 'MASUKAN');
  const outPpn = out.reduce((s, r) => s + Number(r.ppn ?? 0), 0);
  const inCreditable = inp.filter(r => r.reconStatus !== 'DIFF' && r.reconStatus !== 'MISSING_CORETAX').reduce((s, r) => s + Number(r.ppn ?? 0), 0);
  const payable = outPpn - inCreditable;
  const reconTable = (title: string, list: PpnRow[]) => (
    <div className={styles.card} style={{ boxShadow: 'none' }}>
      <div className={styles.cardHead}><div><h2 style={{ fontSize: 14 }}>{title}</h2></div></div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>{t('colDate')}</th><th>FAKTUR</th><th>{t('colCounterparty')}</th><th>{t('custDpp')}</th><th>{t('coretaxDpp')}</th><th>{t('custPpn')}</th><th>{t('coretaxPpn')}</th><th>{t('reconResult')}</th></tr></thead>
            <tbody>
              {list.map((r, i) => { const b = reconBadge(t, (r.reconStatus as string) ?? null); return (
                <tr key={i}>
                  <td>{String(r.fakturDate ?? '—')}</td><td>{String(r.fakturNumber ?? '—')}</td><td><b>{String(r.counterpartyName ?? '—')}</b></td>
                  <td className={styles.money}>{rp(Number(r.dpp ?? 0))}</td>
                  <td className={styles.money}>{r.coretaxDpp != null ? rp(Number(r.coretaxDpp)) : '—'}</td>
                  <td className={styles.money}>{rp(Number(r.ppn ?? 0))}</td>
                  <td className={styles.money}>{r.coretaxPpn != null ? rp(Number(r.coretaxPpn)) : '—'}</td>
                  <td><span className={`${styles.badge} ${styles[b.c]}`}>{b.label}</span></td>
                </tr>
              ); })}
              {list.length === 0 && <tr><td colSpan={8} style={{ color: '#94a3b8' }}>—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {reconTable(t('ppnOut'), out)}
      {reconTable(t('ppnIn'), inp)}
      <div className={styles.reviewRequestBox} style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
        <b>{t('vatCalcTitle')}</b>
        <p style={{ color: '#1e3a5f', fontSize: 13 }}>{t('vatCalcBody', { out: rp(outPpn), input: rp(inCreditable), payable: rp(payable) })}</p>
      </div>
    </div>
  );
}
function ApprovalTaxWork({ item, onDecided }: { item: ApprovalItem; onDecided: () => void }) {
  const t = useT();
  const cfg = DETAIL_MAP[item.taxType];
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [appr, setAppr] = useState<ApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  // ERP(consultant_session) 파이프라인 보강 — 4-값 비교 + 검토요청 카드
  const [extra, setExtra] = useState<ApprovalExtra | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const loadExtra = useCallback(() => {
    const qs = new URLSearchParams({ customerId: item.customerId, taxType: item.taxType, period: item.period });
    fetch(`/api/operator/supervisor/console/approval-extra?${qs}`).then(r => r.json()).then(j => { if (j.success) setExtra(j.data as ApprovalExtra); }).catch(() => {});
  }, [item.customerId, item.taxType, item.period]);

  useEffect(() => {
    if (cfg) fetch(`/api/operator/workqueue/${item.id}/${cfg.ep}`).then(r => r.json()).then(j => { if (j.success) setDetail(j.data); }).catch(() => {});
    fetch(`/api/operator/workqueue/${item.id}/approval`).then(r => r.json()).then(j => { if (j.success) setAppr(j.data as ApprovalState); }).catch(() => {});
    loadExtra();
  }, [item.id, cfg, loadExtra]);

  const submitComment = async (id: string) => {
    if (commentText.trim().length < 1) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/operator/supervisor/review-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorComment: commentText.trim(), status: 'ANSWERED' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((j as { error?: string }).error || `(${r.status})`); return; }
      setCommentFor(null); setCommentText(''); loadExtra();
    } catch { setErr(t('toastNet')); }
    finally { setBusy(false); }
  };

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

  const secTitle = cfg ? SECTION_TITLE[cfg.ep] : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardBody} style={{ display: 'grid', gap: 12 }}>
          {/* 세목별 상세 화면 제목 (PPT 헤더) */}
          {secTitle && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div><h3 style={{ margin: 0, fontSize: 15 }}>{t(secTitle.tk)}</h3><p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 12 }}>{t('secSub')}</p></div>
              <span className={`${styles.badge} ${styles.green}`}>{t('counselorReviewed')}</span>
            </div>
          )}
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

          {/* 상담원 수퍼바이저 검토요청 (PPT: 카드 + 의견 작성/회신) — ERP 세션 매칭 시 */}
          {extra && extra.reviewRequests.length > 0 ? (
            <div className={styles.reviewRequestBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>{t('reviewReqTitle')}</b>
                <span className={styles.cnt} style={{ background: '#fde68a', color: '#78350f' }}>{extra.reviewRequests.length}</span>
              </div>
              <p style={{ color: '#78350f', fontSize: 12 }}>{t('reviewReqDesc')}</p>
              <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                {extra.reviewRequests.map(rr => (
                  <div key={rr.id} style={{ border: '1px solid #fcd34d', borderRadius: 12, background: '#fff', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <b style={{ fontSize: 13 }}>{rr.itemLabel}</b>
                      {rr.calcKind && <span className={`${styles.badge} ${styles.amber}`}>{KIND_LABEL[rr.calcKind] ?? rr.calcKind}</span>}
                    </div>
                    <p style={{ color: '#92400e', fontSize: 12, margin: '6px 0 0' }}>{t('counselorMemo')}: {rr.reason}</p>
                    {rr.supervisorComment && <p style={{ color: '#065f46', fontSize: 12, margin: '6px 0 0' }}>💬 {rr.supervisorComment}</p>}
                    {commentFor === rr.id ? (
                      <div style={{ marginTop: 8 }}>
                        <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={t('writeComment')} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                          <button className={styles.btn} onClick={() => { setCommentFor(null); setCommentText(''); }} disabled={busy}>{t('cancel')}</button>
                          <button className={`${styles.btn} ${styles.green}`} disabled={busy || commentText.trim().length < 1} onClick={() => submitComment(rr.id)}>{t('replyCounselor')}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <span className={`${styles.badge} ${rr.status === 'ANSWERED' ? styles.green : styles.amber}`}>{rr.status}</span>
                        <button className={`${styles.btn} ${styles.blue}`} onClick={() => { setCommentFor(rr.id); setCommentText(rr.supervisorComment ?? ''); }}>{t('writeComment')}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : appr?.requestNote && (
            <div className={styles.reviewRequestBox}><b>{t('reviewReqTitle')}</b><p style={{ color: '#78350f', fontSize: 12 }}>{t('reviewReqDesc')}</p><p>{appr.requestNote}</p></div>
          )}
          {appr?.rejectedReason && <div className={styles.assignmentRule}><b>{t('prevReject')}</b><p>{appr.rejectedReason}</p></div>}

          {cfg && cfg.ep === 'ppn' ? (
            <PpnReconView rows={rows} />
          ) : cfg ? (
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

          {/* 고객 입력값 / AI 계산값 / 상담원 처리값 / 최종값 비교 (PPT) — ERP 세션 매칭 시 */}
          {extra && extra.fourValues.length > 0 && (
            <div>
              <b style={{ fontSize: 14 }}>{t('fourValTitle')}</b>
              <div className={styles.tableWrap} style={{ marginTop: 8 }}>
                <table>
                  <thead><tr><th>{t('fvItem')}</th><th>{t('fvCustomer')}</th><th>{t('fvAi')}</th><th>{t('fvConsultant')}</th><th>{t('fvApproved')}</th></tr></thead>
                  <tbody>
                    {extra.fourValues.map((fv, i) => (
                      <tr key={i}>
                        <td><b>{KIND_LABEL[fv.kind] ?? fv.kind}</b></td>
                        <td className={styles.money}>{fv.customerInput != null ? rp(fv.customerInput) : '—'}</td>
                        <td className={styles.money}>{fv.ai != null ? rp(fv.ai) : '—'}</td>
                        <td className={styles.money} style={{ background: '#fff7ed' }}>{fv.consultant != null ? rp(fv.consultant) : '—'}</td>
                        <td className={styles.money} style={{ background: '#f0fdf4', fontWeight: 800 }}>{fv.approved != null ? rp(fv.approved) : t('fvPending')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {err && <div className={styles.assignmentRule} style={{ borderColor: '#fecaca', background: '#fef2f2' }}><p>{err}</p></div>}

          {mode && (
            <div className={styles.reviewRequestBox}>
              <b>{t('rejectTitle')}</b>
              <p>{t('rejectBody')}</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('rejectPlaceholder')} />
            </div>
          )}

          {/* 수퍼바이저 최종 판단 (인라인) — #25: 상담원에게 반려 / 승인완료 (고객추가요청 버튼 삭제) */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <b style={{ fontSize: 14 }}>{t('finalDecision')}</b>
            <p style={{ margin: '2px 0 10px', color: '#64748b', fontSize: 12 }}>{t('finalDecisionSub')}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {appr?.canApprove && appr.status === 'PENDING_APPROVAL' ? (
                mode ? (
                  <>
                    <button className={styles.btn} onClick={() => { setMode(null); setReason(''); }} disabled={busy}>{t('cancel')}</button>
                    <button className={`${styles.btn} ${styles.red}`} disabled={busy || reason.trim().length < 1}
                      onClick={() => decide('reject', reason.trim())}>{t('rejectConfirm')}</button>
                  </>
                ) : (
                  <>
                    <button className={`${styles.btn} ${styles.red}`} onClick={() => setMode('reject')} disabled={busy}>{t('rejectToCounselor')}</button>
                    <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={() => decide('approve')}>{t('approveDone')}</button>
                  </>
                )
              ) : <span className={`${styles.badge} ${styles.amber}`}>{appr?.status === 'APPROVED' ? t('approve') : t('noAuth')}</span>}
            </div>
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
interface EvalRow { name: string; reject_rate: number | null; approval_pass_rate: number | null; completed_count?: number; avg_minutes?: number | null; scores: { total: number; accuracy: number; speed: number; approval: number; satisfaction: number }; suggested_incentive_amount?: number; evaluation_label?: string }
interface Incentive { monthlyPool: number; perPoint: number; maxPerPerson: number; minScore: number; improvementThreshold: number }
function EvaluationView() {
  const t = useT();
  const { data, err, reload } = useLazy<{ operators: EvalRow[]; disclaimer?: string; isSuggestionOnly?: boolean; incentive?: Incentive }>('/api/operator/evaluation');
  // #28 — 인센티브 산출근거(정책) 편집 → 수퍼바이저가 결정
  const [pol, setPol] = useState<Incentive | null>(null);
  const [editInc, setEditInc] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.incentive) setPol(data.incentive); }, [data]);
  const savePol = async () => {
    if (!pol) return;
    setBusy(true);
    try {
      await fetch('/api/operator/evaluation-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incentive: pol }),
      });
      setEditInc(false); reload();
    } finally { setBusy(false); }
  };
  const setPolField = (k: keyof Incentive, v: number) => setPol(p => p ? { ...p, [k]: v } : p);
  if (err) return <ErrCard msg={t('toastNet')} />;
  if (!data) return <LoadingCard />;
  const rows = data.operators ?? [];
  const inc = data.incentive;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>{t('evalHeadTitle')}</h2><p>{data.disclaimer || t('evalDefaultDisclaimer')}</p></div>
        {data.isSuggestionOnly && <span className={`${styles.badge} ${styles.amber}`}>{t('evalSuggestBadge')}</span>}</div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>{t('colCounselor')}</th><th>{t('colProcessed')}</th><th>{t('colAvgTime')}</th><th>{t('colScore')}</th><th>{t('colRejectRate')}</th><th>{t('colApprovalPass')}</th><th>{t('colAccuracy')}</th><th>{t('colSpeed')}</th><th>{t('colIncentive')}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.name}</b> {r.evaluation_label && <span className={`${styles.badge} ${styles.green}`}>{r.evaluation_label}</span>}</td>
                  <td>{r.completed_count ?? 0}</td>
                  <td>{r.avg_minutes != null ? `${r.avg_minutes}${t('minUnit')}` : '—'}</td>
                  <td><b>{r.scores.total.toFixed(0)}</b></td>
                  <td>{r.reject_rate == null ? '—' : r.reject_rate.toFixed(1) + '%'}</td>
                  <td>{r.approval_pass_rate == null ? '—' : r.approval_pass_rate.toFixed(1) + '%'}</td>
                  <td>{r.scores.accuracy.toFixed(0)}</td><td>{r.scores.speed.toFixed(0)}</td>
                  <td className={styles.money}>{r.suggested_incentive_amount ? rp(r.suggested_incentive_amount) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ color: '#94a3b8' }}>{t('noEval')}</td></tr>}
            </tbody>
          </table>
        </div>
        {/* #18 산출근거 + #28 편집 */}
        {inc && pol && (
          <div className={styles.reviewRequestBox} style={{ borderColor: '#bfdbfe', background: '#eff6ff', marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>{t('incentiveBasisTitle')}</b>
              {!editInc && <button className={`${styles.btn} ${styles.blue}`} onClick={() => setEditInc(true)}>{t('editIncentive')}</button>}
            </div>
            {editInc ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <div className={`${styles.grid} ${styles.two}`}>
                  <label>{t('incPerPoint')}<input type="number" value={pol.perPoint} onChange={e => setPolField('perPoint', Number(e.target.value))} /></label>
                  <label>{t('incMinScore')}<input type="number" value={pol.minScore} onChange={e => setPolField('minScore', Number(e.target.value))} /></label>
                  <label>{t('incMaxPerson')}<input type="number" value={pol.maxPerPerson} onChange={e => setPolField('maxPerPerson', Number(e.target.value))} /></label>
                  <label>{t('incPool')}<input type="number" value={pol.monthlyPool} onChange={e => setPolField('monthlyPool', Number(e.target.value))} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className={styles.btn} disabled={busy} onClick={() => { setEditInc(false); setPol(inc); }}>{t('cancel')}</button>
                  <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={savePol}>{t('confirmChange')}</button>
                </div>
                <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{t('incEditNote')}</p>
              </div>
            ) : (
              <p style={{ color: '#1e3a5f', fontSize: 12, margin: '4px 0 0', lineHeight: 1.7 }}>
                {t('incentiveBasisBody', { perPoint: rp(inc.perPoint), minScore: inc.minScore, maxPerPerson: rp(inc.maxPerPerson), pool: rp(inc.monthlyPool) })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 상담원 소속관리 ──
interface Transfer { id: string; operatorName: string; fromSupervisorName: string | null; toSupervisorName: string; clientMode: string; reason: string | null; status: string; direction: string; createdAt: string }
// #8 소속관리 — PPT: 수퍼바이저별 상담원 로스터(이동요청) + 협의 요청함 테이블(승인/거절)
function AffiliationView({ d, onToast, onChanged }: { d: ConsoleData; onToast: (m: string) => void; onChanged: () => void }) {
  const t = useT();
  const { data, err, reload } = useLazy<{ incoming: Transfer[]; transfers: Transfer[] }>('/api/operator/supervisor/affiliation');
  const [xfer, setXfer] = useState<{ operatorId: string; name: string } | null>(null);
  const [toSup, setToSup] = useState('');
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
  // #30/#32 — 요청→승인 대신 콘솔에서 즉시 소속 이동.
  const submitXfer = async () => {
    if (!xfer || !toSup) { onToast(t('toastNeedFields')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/operator/supervisor/console/move-operator', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: xfer.operatorId, toSupervisorId: toSup, reason: reason.trim() || undefined }),
      });
      const j = await r.json();
      onToast(j.success ? t('affMoved') : (typeof j.error === 'string' ? j.error : t('toastChangeFail')));
      if (j.success) { setXfer(null); setToSup(''); setReason(''); reload(); onChanged(); }
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
                  <b><i className={`${styles.statusDot} ${c.workState === 'offline' ? styles.offline : (c.workState === 'busy' || c.workState === 'away') ? styles.busy : styles.online}`} />{c.name}</b><br />
                  <small>{wsLabel(t, c.workState)} · {t('customer')} {c.customers} · {t('supPendingShort')} {c.pending} · {c.specialty}</small>
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
                  <option value="">{t('selectSupervisor')}</option>
                  {d.supervisorOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>{t('reason')}<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('reason')} /></label>
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
