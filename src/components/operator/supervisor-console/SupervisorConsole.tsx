'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './console.module.css';

// ── 타입 ─────────────────────────────────────────────
interface ConsoleData {
  kpis: { pendingManual: number; autoAssigned: number; excludedOffline: number; changes: number };
  assignedCustomers: Array<{ customerId: string; name: string; operator: string; method: string; taxTypes: string[]; assignedAt: string | null }>;
  history: Array<{ name: string; operator: string; method: string; at: string }>;
  team: Array<{ id: string; name: string; workState: string; load: number; maxClients: number; score: number; autoAssign: boolean }>;
  ranking: Array<{ id: string; name: string; score: number; load: number }>;
  teamCompare: Array<{ team: string; members: number; avgScore: number; totalLoad: number }>;
  operators: Array<{ id: string; name: string }>;
  approvalPending: Array<{ id: string; company: string; taxType: string; period: string; amount: number }>;
  audit: Array<{ activity: string; role: string; taxType: string | null; company: string; at: string }>;
}
type View = 'dashboard' | 'approval' | 'evaluation' | 'affiliation' | 'assignment' | 'billing' | 'audit';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const timeOf = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const methodBadge = (m: string) => m === 'AUTO' ? { c: 'green', t: '자동배정' } : { c: 'amber', t: '수동변경' };

const VIEW_META: Record<View, { title: string; desc: string }> = {
  dashboard: { title: '대시보드', desc: '팀 성과·상담원 순위 한눈에' },
  approval: { title: '승인대기', desc: '상담원 승인요청 검토' },
  evaluation: { title: '상담원 평가', desc: '반려율·승인통과율 실측 (제안값)' },
  affiliation: { title: '상담원 소속관리', desc: '소속 이동 요청/승인' },
  assignment: { title: '고객 배정관리', desc: '신규 자동배정 + 수동 변경' },
  billing: { title: 'ID Billing 이관현황', desc: '발행대상/발행완료 추적' },
  audit: { title: '전체 이력 / 감사로그', desc: '배정·승인·발행 감사' },
};

export function SupervisorConsole({ name, role }: { name?: string; role?: string }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<ConsoleData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

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
      showToast(j.success ? '신규 접수 자동배정 실행 완료' : (j.error || '자동배정 실패'));
      await load();
    } catch { showToast('네트워크 오류'); }
  };

  const navBtn = (v: View, label: string, count?: number | string) => (
    <button className={`${styles.nav} ${view === v ? styles.active : ''}`} onClick={() => setView(v)}>
      <span>{label}</span>{count != null && <span className={styles.cnt}>{count}</span>}
    </button>
  );

  const meta = VIEW_META[view];

  return (
    <div className={styles.root}>
      <div className={styles.app}>
        {/* ── 사이드바 ── */}
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>SP</div>
            <div><b>AI Pajak Supervisor</b><span>JTC 내부 관리 콘솔</span></div>
          </div>
          <div className={styles.loginCard}>
            <b>{name || '수퍼바이저'}</b>
            <span>{role === 'TAX_OPERATOR_MASTER' ? 'Master · 승인권한' : '팀 관리 · 승인권한'}</span>
          </div>
          <div className={styles.navSection}>MAIN</div>
          {navBtn('dashboard', '대시보드', '팀비교')}
          {navBtn('approval', '승인대기', data?.kpis.changes ?? 0)}
          <div className={styles.navSection}>PEOPLE</div>
          {navBtn('evaluation', '상담원 평가', '순위')}
          {navBtn('affiliation', '상담원 소속관리', '실행')}
          {navBtn('assignment', '고객 배정관리', data?.assignedCustomers.length ?? 0)}
          <div className={styles.navSection}>PROCESS</div>
          {navBtn('billing', 'ID Billing 이관현황', data?.kpis.changes ?? 0)}
          {navBtn('audit', '전체 이력 / 감사로그', 'log')}
        </aside>

        {/* ── 메인 ── */}
        <main className={styles.main}>
          <div className={styles.topbar}>
            <div className={styles.title}><h1>{meta.title}</h1><p>{meta.desc}</p></div>
            <div className={styles.topActions}>
              {data && <button className={`${styles.btn} ${styles.blue}`} onClick={() => setShowReport(true)}>📄 월간 리포트</button>}
              <a className={styles.btn} href={`/${locale}/operator/workqueue`}>← 업무함</a>
              <button className={styles.btn} onClick={logout}>로그아웃</button>
            </div>
          </div>

          {!data ? <div className={styles.card}><div className={styles.placeholder}>불러오는 중…</div></div>
            : view === 'dashboard' ? <DashboardView d={data} />
            : view === 'assignment' ? <AssignmentView d={data} onAuto={runAutoAssign} onReassigned={async (m) => { showToast(m); await load(); }} />
            : view === 'approval' ? <ApprovalView d={data} onChanged={load} />
            : view === 'evaluation' ? <EvaluationView />
            : view === 'affiliation' ? <AffiliationView onToast={showToast} />
            : view === 'billing' ? <BillingView locale={locale} />
            : <AuditView d={data} />}
        </main>
      </div>
      {showReport && data && <ReportModal name={name} d={data} onClose={() => setShowReport(false)} />}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

// ── 월간 리포트 모달 ──
function ReportModal({ name, d, onClose }: { name?: string; d: ConsoleData; onClose: () => void }) {
  const now = new Date();
  const ym = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const rejects = d.audit.filter(a => /reject|반려|REJECT/i.test(a.activity)).length;
  const comment = `${ym} 운영 요약: 자동배정 원칙에 따라 신규 고객 ${d.kpis.autoAssigned}건이 자동 배정되었고, 배정/변경 ${d.kpis.changes}건이 발생했습니다. 승인대기 ${d.approvalPending.length}건이 검토 대기 중이며, 오프라인 상담원은 ${d.kpis.excludedOffline}명입니다. 팀 상담원 ${d.team.length}명 기준 상위 품질점수 상담원은 ${d.ranking[0]?.name ?? '—'} 입니다.`;
  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>AI Pajak 월간 수퍼바이저 리포트</h2>
        <div className={styles.modalBody}>
          <div className={styles.reportCover}>
            <h3>{ym} 수퍼바이저 운영 리포트</h3>
            <p>{name || '수퍼바이저'} 기준 · 팀 성과/상담원 순위/승인 요약 포함</p>
          </div>
          <div className={styles.reportGrid}>
            <div className={styles.reportKpi}><span>자동배정 완료</span><b>{d.kpis.autoAssigned}</b></div>
            <div className={styles.reportKpi}><span>배정/변경</span><b>{d.kpis.changes}</b></div>
            <div className={styles.reportKpi}><span>승인대기</span><b>{d.approvalPending.length}</b></div>
            <div className={styles.reportKpi}><span>팀 상담원</span><b>{d.team.length}</b></div>
          </div>

          <div className={styles.reportSection}>
            <h4>1. 팀 성과 비교</h4>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>상담원</th><th>담당</th><th>정원</th><th>품질</th><th>자동배정</th></tr></thead>
                <tbody>
                  {d.team.map(t => <tr key={t.id}><td><b>{t.name}</b></td><td>{t.load}</td><td>{t.maxClients}</td><td>{t.score.toFixed(0)}</td><td>{t.autoAssign ? 'ON' : 'OFF'}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>2. 상담원 순위</h4>
            <div className={styles.rs}>
              <div className={styles.rankCard}>
                {d.ranking.map((r, i) => (
                  <div key={r.id} className={styles.rankRow}><div className={styles.avatar}>{i + 1}</div><div><b>{r.name}</b><div style={{ color: '#64748b', fontSize: 12 }}>담당 {r.load}건</div></div><div className={styles.score}>{r.score.toFixed(0)}</div></div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>3. 승인 / 반려 요약</h4>
            <div className={styles.rs}>
              <ul>
                <li>승인대기: {d.approvalPending.length}건</li>
                <li>최근 반려(감사 기준): {rejects}건</li>
                <li>총 감사 이벤트(최근): {d.audit.length}건</li>
              </ul>
            </div>
          </div>

          <div className={styles.reportSection}>
            <h4>4. 운영 코멘트</h4>
            <div className={styles.rs}><p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#334155' }}>{comment}</p></div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>닫기</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={() => window.print()}>인쇄 / PDF</button>
        </div>
      </div>
    </div>
  );
}

// ── 대시보드 ──
function DashboardView({ d }: { d: ConsoleData }) {
  return (
    <>
      <div className={`${styles.grid} ${styles.kpi}`}>
        <Kpi label="배정 대기" value={String(d.kpis.pendingManual)} sub="수동 배정대기 없음" />
        <Kpi label="자동배정 완료 고객" value={String(d.kpis.autoAssigned)} sub="신규 고객 자동배정 원칙" />
        <Kpi label="자동배정 제외" value={String(d.kpis.excludedOffline)} sub="오프라인" />
        <Kpi label="배정/변경" value={String(d.kpis.changes)} sub="배정/변경 이력" />
      </div>
      <div className={`${styles.grid} ${styles.two}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>팀 성과</h2><p>상담원별 담당 고객 · 승인 품질</p></div></div>
          <div className={styles.cardBody}>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>상담원</th><th>상태</th><th>담당 고객</th><th>정원</th><th>품질점수</th><th>자동배정</th></tr></thead>
                <tbody>
                  {d.team.map(t => (
                    <tr key={t.id}>
                      <td><b>{t.name}</b></td>
                      <td><span className={styles.statusDot + ' ' + (t.workState === 'offline' ? styles.off : t.workState === 'rest' ? styles.rest : '')} />{t.workState}</td>
                      <td>{t.load}</td><td>{t.maxClients}</td>
                      <td><b>{t.score.toFixed(0)}</b></td>
                      <td>{t.autoAssign ? <span className={`${styles.badge} ${styles.green}`}>ON</span> : <span className={`${styles.badge} ${styles.red}`}>OFF</span>}</td>
                    </tr>
                  ))}
                  {d.team.length === 0 && <tr><td colSpan={6} style={{ color: '#94a3b8' }}>팀 상담원 데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>상담원 순위 · 팀비교</h2><p>품질점수 기준</p></div></div>
          <div className={styles.cardBody}>
            {d.teamCompare.length > 0 && (
              <div className={styles.tableWrap} style={{ marginBottom: 12 }}>
                <table>
                  <thead><tr><th>팀(수퍼바이저)</th><th>인원</th><th>평균 품질</th><th>총 담당</th></tr></thead>
                  <tbody>
                    {d.teamCompare.map((t, i) => <tr key={i}><td><b>{t.team}</b></td><td>{t.members}</td><td>{t.avgScore}</td><td>{t.totalLoad}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.rankCard}>
              {d.ranking.map((r, i) => (
                <div key={r.id} className={styles.rankRow}>
                  <div className={styles.avatar}>{i + 1}</div>
                  <div><b>{r.name}</b><div style={{ color: '#64748b', fontSize: 12 }}>담당 {r.load}건</div></div>
                  <div className={styles.score}>{r.score.toFixed(0)}</div>
                </div>
              ))}
              {d.ranking.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>순위 데이터 없음</div>}
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
const RULES = [
  { n: '1. 기존 상담이력 우선', t: '이전 상담원이 있고 자동배정 제외 대상이 아니면 기존 상담원에게 자동 배정합니다.' },
  { n: '2. 팀 자동 결정', t: '기존 이력이 없으면 고객 언어·세목·위험도·팀 업무량 기준으로 수퍼바이저 그룹을 정합니다.' },
  { n: '3. 상담원 자동 결정', t: '팀 내 로그인 상태·담당 고객 수·승인대기 수·전문 세목·품질점수로 상담원을 정합니다.' },
  { n: '4. 수퍼바이저 예외 변경', t: '자동배정 후 필요 시에만 수퍼바이저가 팀/상담원을 변경하고 사유를 남깁니다.' },
];
function AssignmentView({ d, onAuto, onReassigned }: { d: ConsoleData; onAuto: () => void; onReassigned: (m: string) => void }) {
  const [sel, setSel] = useState<string | null>(d.assignedCustomers[0]?.customerId ?? null);
  const [op, setOp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const selCust = d.assignedCustomers.find(c => c.customerId === sel) ?? null;
  const submit = async () => {
    if (!sel || !op || reason.trim().length < 1) { onReassigned('고객·상담원·사유를 입력하세요'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/operator/supervisor/console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sel, operatorId: op, reason: reason.trim() }),
      });
      const j = await r.json();
      onReassigned(j.success ? '변경 완료' : (j.error || '변경 실패'));
      if (j.success) { setReason(''); }
    } finally { setBusy(false); }
  };
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div><h2>신규 고객 자동배정 원칙</h2><p>신규 고객은 접수 즉시 시스템이 자동으로 팀과 상담원을 배정합니다.</p></div>
          <button className={`${styles.btn} ${styles.blue}`} onClick={onAuto}>신규 접수 자동배정 실행</button>
        </div>
        <div className={styles.cardBody}>
          <div className={`${styles.grid} ${styles.three}`}>
            {RULES.map(r => <div key={r.n} className={styles.assignmentRule}><b>{r.n}</b><p>{r.t}</p></div>)}
          </div>
        </div>
      </div>

      <div className={styles.assignmentLayout}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>자동배정 완료 고객</h2><p>필요 건만 수퍼바이저가 수동으로 변경</p></div></div>
          <div className={styles.cardBody} style={{ display: 'grid', gap: 10 }}>
            {d.assignedCustomers.map(c => {
              const b = methodBadge(c.method);
              return (
                <div key={c.customerId} className={`${styles.customerCard} ${sel === c.customerId ? styles.active : ''}`}
                  role="button" tabIndex={0} onClick={() => setSel(c.customerId)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b>{c.name}</b><span className={`${styles.badge} ${styles.blue}`}>정상</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>현재 배정: {c.operator} · {timeOf(c.assignedAt)}</div>
                  <div className={styles.customerMeta}>
                    {c.taxTypes.map(tt => <span key={tt} className={`${styles.badge} ${styles.purple}`}>{tt}</span>)}
                    <span className={`${styles.badge} ${styles[b.c]}`}>{b.t}</span>
                  </div>
                </div>
              );
            })}
            {d.assignedCustomers.length === 0 && <div className={styles.placeholder}>배정된 고객이 없습니다</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}><div><h2>팀/상담원 수동변경</h2><p>변경 사유는 감사로그에 남습니다.</p></div></div>
          <div className={styles.cardBody} style={{ display: 'grid', gap: 12 }}>
            {selCust ? (
              <>
                <div className={styles.assignmentRule}><b>{selCust.name}</b><p>현재 배정: {selCust.operator}</p></div>
                <label>상담원
                  <select value={op} onChange={e => setOp(e.target.value)}>
                    <option value="">상담원 선택</option>
                    {d.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <label>변경 사유<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="변경 사유" /></label>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={submit}>변경 확정</button>
                </div>
              </>
            ) : <div className={styles.placeholder}>왼쪽에서 고객을 선택하세요</div>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>배정/변경 이력</h2><p>최근 배정·변경 감사</p></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>고객</th><th>상담원</th><th>배정 방식</th><th>일시</th></tr></thead>
              <tbody>
                {d.history.map((h, i) => {
                  const b = methodBadge(h.method);
                  return <tr key={i}><td><b>{h.name}</b></td><td>{h.operator}</td><td><span className={`${styles.badge} ${styles[b.c]}`}>{b.t}</span></td><td>{timeOf(h.at)}</td></tr>;
                })}
                {d.history.length === 0 && <tr><td colSpan={4} style={{ color: '#94a3b8' }}>이력 없음</td></tr>}
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
// 세목 → 워크큐 상세 endpoint + 미러 컬럼
const DETAIL_MAP: Record<string, { ep: string; cols: Array<{ key: string; label: string; money?: boolean }> }> = {
  PPh21: { ep: 'pph21', cols: [{ key: 'name', label: '직원' }, { key: 'totalGross', label: '총지급', money: true }, { key: 'pph21', label: 'PPh21', money: true }] },
  PPh23: { ep: 'withholding', cols: [{ key: 'counterpartyName', label: '거래처' }, { key: 'grossAmount', label: '지급액', money: true }, { key: 'taxAmount', label: '세액', money: true }] },
  PPh4_2: { ep: 'withholding', cols: [{ key: 'counterpartyName', label: '거래처' }, { key: 'grossAmount', label: '지급액', money: true }, { key: 'taxAmount', label: '세액', money: true }] },
  PPN: { ep: 'ppn', cols: [{ key: 'fakturNumber', label: 'Faktur' }, { key: 'dpp', label: 'DPP', money: true }, { key: 'ppn', label: 'PPN', money: true }] },
};
function ApprovalView({ d, onChanged }: { d: ConsoleData; onChanged: () => void }) {
  const [sel, setSel] = useState<ApprovalItem | null>(null);
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>승인대기 리스트</h2><p>상담원 검토완료 → 수퍼바이저 최종 승인 대상. 행을 클릭하면 고객화면 미러 상세가 열립니다.</p></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>고객</th><th>세목</th><th>귀속</th><th>세액</th><th></th></tr></thead>
              <tbody>
                {d.approvalPending.map(a => (
                  <tr key={a.id} role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setSel(a)}>
                    <td><b>{a.company}</b></td><td>{a.taxType}</td><td>{a.period}</td>
                    <td className={styles.money}>{rp(a.amount)}</td>
                    <td><span className={`${styles.badge} ${styles.blue}`}>상세 열기 →</span></td>
                  </tr>
                ))}
                {d.approvalPending.length === 0 && <tr><td colSpan={5} style={{ color: '#94a3b8' }}>승인대기 건이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {sel && <ApprovalDetail item={sel} onClose={() => setSel(null)} onDecided={() => { setSel(null); onChanged(); }} />}
    </>
  );
}

interface DetailResp { rows?: Array<Record<string, unknown>>; summary?: Record<string, number> }
interface ApprovalState { status: string; requestNote?: string | null; canApprove: boolean; rejectedReason?: string | null }
function ApprovalDetail({ item, onClose, onDecided }: { item: ApprovalItem; onClose: () => void; onDecided: () => void }) {
  const cfg = DETAIL_MAP[item.taxType];
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [appr, setAppr] = useState<ApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

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
      if (!r.ok) { setErr((j as { error?: string }).error || `실패 (${r.status})`); return; }
      onDecided();
    } catch { setErr('네트워크 오류'); }
    finally { setBusy(false); }
  };

  const rows = detail?.rows ?? [];
  const editedCount = rows.filter(r => r.operatorEdits && Object.keys(r.operatorEdits as object).length > 0).length;

  return (
    <div className={styles.modalBg} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{item.company} · {item.taxType} · {item.period}</h2>
        <div className={styles.modalBody}>
          <div className={styles.assignmentRule}>
            <p>아래는 고객이 입력한 자료를 고객 화면과 같은 구조로 보여주는 미러입니다. 상세자료·상담원 수정값을 비교하고, 세금 계산이 맞다고 판단될 때만 승인완료를 누르세요.</p>
          </div>

          {appr?.requestNote && (
            <div className={styles.reviewRequestBox}>
              <b>상담원 검토요청</b>
              <p>{appr.requestNote}</p>
            </div>
          )}
          {appr?.rejectedReason && <div className={styles.assignmentRule}><b>이전 반려사유</b><p>{appr.rejectedReason}</p></div>}

          {cfg ? (
            <div className={styles.customerUi}>
              <div className={styles.customerUiHead}>
                <div><h3>{item.taxType} 고객 입력화면 미러</h3><p>{rows.length}건 · 상담원 수정 {editedCount}건 (표시된 값 기준)</p></div>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr>{cfg.cols.map(c => <th key={c.key}>{c.label}</th>)}<th>상태</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => {
                      const edited = r.operatorEdits && Object.keys(r.operatorEdits as object).length > 0;
                      const flags = r.flags as { level?: string; label?: string } | undefined;
                      return (
                        <tr key={i} style={edited ? { background: '#fff7ed' } : undefined}>
                          {cfg.cols.map(c => <td key={c.key}>{c.money ? rp(Number(r[c.key] ?? 0)) : String(r[c.key] ?? '—')}</td>)}
                          <td><span className={`${styles.badge} ${flags?.level === 'red' ? styles.red : flags?.level === 'amber' ? styles.amber : styles.green}`}>{flags?.label ?? '—'}</span></td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={cfg.cols.length + 1} style={{ color: '#94a3b8' }}>불러오는 중 또는 데이터 없음</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={styles.assignmentRule}><p>이 세목({item.taxType})은 표 미러가 아직 없습니다. 워크큐 상세에서 확인하세요.</p></div>}

          {err && <div className={styles.assignmentRule} style={{ borderColor: '#fecaca', background: '#fef2f2' }}><p>{err}</p></div>}

          {rejecting && (
            <div className={styles.reviewRequestBox}>
              <b>상담원에게 반려</b>
              <p>반려 사유를 입력하면 해당 건은 상담원 업무함으로 돌아가고, 감사로그에 기록됩니다.</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="반려 사유" />
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose} disabled={busy}>닫기</button>
          {appr?.canApprove && appr.status === 'PENDING_APPROVAL' ? (
            rejecting ? (
              <>
                <button className={styles.btn} onClick={() => setRejecting(false)} disabled={busy}>취소</button>
                <button className={`${styles.btn} ${styles.red}`} disabled={busy || reason.trim().length < 1} onClick={() => decide('reject', reason.trim())}>반려 확정</button>
              </>
            ) : (
              <>
                <button className={styles.btn} onClick={() => setRejecting(true)} disabled={busy}>반려</button>
                <button className={`${styles.btn} ${styles.green}`} disabled={busy} onClick={() => decide('approve')}>승인완료</button>
              </>
            )
          ) : <span className={`${styles.badge} ${styles.amber}`}>{appr?.status === 'APPROVED' ? '승인완료' : '승인 권한/상태 아님'}</span>}
        </div>
      </div>
    </div>
  );
}

// ── lazy fetch 훅 ──
function useLazy<T>(url: string): { data: T | null; err: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(() => {
    setErr(null);
    fetch(url).then(r => r.json()).then(j => { if (j.success) setData(j.data as T); else setErr(j.error || '불러오지 못했습니다.'); })
      .catch(() => setErr('네트워크 오류'));
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload };
}

// ── 상담원 평가 ──
interface EvalRow { name: string; reject_rate: number | null; approval_pass_rate: number | null; scores: { total: number; accuracy: number; speed: number; approval: number; satisfaction: number }; suggested_incentive_amount?: number; evaluation_label?: string }
function EvaluationView() {
  const { data, err } = useLazy<{ operators: EvalRow[]; disclaimer?: string; isSuggestionOnly?: boolean }>('/api/operator/evaluation');
  if (err) return <ErrCard msg={err} />;
  if (!data) return <LoadingCard />;
  const rows = data.operators ?? [];
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>상담원 평가</h2><p>{data.disclaimer || '반려율·승인통과율 실측. 인센티브는 제안값이며 자동 상벌 없음.'}</p></div>
        {data.isSuggestionOnly && <span className={`${styles.badge} ${styles.amber}`}>제안값</span>}</div>
      <div className={styles.cardBody}>
        {rows.length > 0 && (
          <div className={styles.evalCards}>
            {rows.slice(0, 3).map((r, i) => (
              <div key={i} className={styles.evalCard}>
                <div className={styles.top}><b>{r.name}</b><span className={styles.score}>{r.scores.total.toFixed(0)}</span></div>
                <div className={styles.evalMetrics}>
                  <div className={styles.metric}><span>정확도</span><b>{r.scores.accuracy.toFixed(0)}</b></div>
                  <div className={styles.metric}><span>속도</span><b>{r.scores.speed.toFixed(0)}</b></div>
                  <div className={styles.metric}><span>승인품질</span><b>{r.scores.approval.toFixed(0)}</b></div>
                  <div className={styles.metric}><span>고객응대</span><b>{r.scores.satisfaction.toFixed(0)}</b></div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>상담원</th><th>총점</th><th>반려율</th><th>승인통과율</th><th>정확도</th><th>속도</th><th>제안 인센티브</th></tr></thead>
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
              {rows.length === 0 && <tr><td colSpan={7} style={{ color: '#94a3b8' }}>평가 데이터 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 상담원 소속관리 ──
interface Transfer { id: string; operatorName: string; fromSupervisorName: string | null; toSupervisorName: string; clientMode: string; reason: string | null; status: string; direction: string; createdAt: string }
function AffiliationView({ onToast }: { onToast: (m: string) => void }) {
  const { data, err, reload } = useLazy<{ incoming: Transfer[]; transfers: Transfer[] }>('/api/operator/supervisor/affiliation');
  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const r = await fetch(`/api/operator/supervisor/affiliation/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: action === 'APPROVE' ? '승인' : '반려' }),
      });
      const j = await r.json();
      onToast(j.success ? (action === 'APPROVE' ? '이동 승인됨' : '반려됨') : (j.error || '실패'));
      reload();
    } catch { onToast('네트워크 오류'); }
  };
  if (err) return <ErrCard msg={err} />;
  if (!data) return <LoadingCard />;
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>소속 이동 요청 (수신)</h2><p>받는 쪽 수퍼바이저가 승인합니다.</p></div></div>
        <div className={styles.cardBody} style={{ display: 'grid', gap: 10 }}>
          {data.incoming.map(t => (
            <div key={t.id} className={styles.assignmentRule}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{t.operatorName}</b><span className={`${styles.badge} ${styles.amber}`}>{t.status}</span>
              </div>
              <p>{t.fromSupervisorName ?? '—'} → {t.toSupervisorName} · {t.clientMode} · {t.reason ?? ''}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className={`${styles.btn} ${styles.green}`} onClick={() => decide(t.id, 'APPROVE')}>승인</button>
                <button className={styles.btn} onClick={() => decide(t.id, 'REJECT')}>반려</button>
              </div>
            </div>
          ))}
          {data.incoming.length === 0 && <div className={styles.placeholder}>수신 대기 요청이 없습니다</div>}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>이동 이력</h2></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>상담원</th><th>방향</th><th>모드</th><th>상태</th><th>일시</th></tr></thead>
              <tbody>
                {data.transfers.map(t => (
                  <tr key={t.id}><td><b>{t.operatorName}</b></td><td>{t.direction === 'incoming' ? '수신' : '발신'}</td><td>{t.clientMode}</td><td>{t.status}</td><td>{timeOf(t.createdAt)}</td></tr>
                ))}
                {data.transfers.length === 0 && <tr><td colSpan={5} style={{ color: '#94a3b8' }}>이력 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── ID Billing 이관현황 ──
interface HandoverPending { company: string; approver: string; consultant: string }
interface HandoverIssued { serialNo: string; company: string; amount: number; sendStatus: string; ntpnStatus: string }
function BillingView({ locale }: { locale: string }) {
  const { data, err } = useLazy<{ pending: HandoverPending[]; issued: HandoverIssued[] }>('/api/operator/supervisor/billing-handover');
  if (err) return <ErrCard msg={err} />;
  if (!data) return <LoadingCard />;
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>발행대상 (승인완료 · 미발행)</h2><p>발행은 발행 보드에서 처리합니다.</p></div>
          <a className={`${styles.btn} ${styles.blue}`} href={`/${locale}/operator/billing-issuance`}>발행 보드 →</a></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>고객</th><th>승인 수퍼바이저</th><th>담당 상담원</th></tr></thead>
              <tbody>
                {data.pending.map((p, i) => <tr key={i}><td><b>{p.company}</b></td><td>{p.approver}</td><td>{p.consultant}</td></tr>)}
                {data.pending.length === 0 && <tr><td colSpan={3} style={{ color: '#94a3b8' }}>발행대상 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>발행완료</h2></div></div>
        <div className={styles.cardBody}>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>일련번호</th><th>고객</th><th>세액</th><th>전송</th><th>NTPN</th></tr></thead>
              <tbody>
                {data.issued.map((r, i) => (
                  <tr key={i}><td>{r.serialNo}</td><td><b>{r.company}</b></td><td className={styles.money}>{rp(r.amount)}</td>
                    <td><span className={`${styles.badge} ${r.sendStatus === 'SENT' ? styles.green : styles.amber}`}>{r.sendStatus === 'SENT' ? '전송됨' : '미전송'}</span></td>
                    <td><span className={`${styles.badge} ${r.ntpnStatus === 'PAID' ? styles.green : styles.amber}`}>{r.ntpnStatus === 'PAID' ? '납부' : '대기'}</span></td></tr>
                ))}
                {data.issued.length === 0 && <tr><td colSpan={5} style={{ color: '#94a3b8' }}>발행완료 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 감사로그 ──
function AuditView({ d }: { d: ConsoleData }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>전체 이력 / 감사로그</h2><p>최근 활동</p></div></div>
      <div className={styles.cardBody}>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>활동</th><th>역할</th><th>세목</th><th>고객</th><th>일시</th></tr></thead>
            <tbody>
              {d.audit.map((a, i) => (
                <tr key={i}><td><b>{a.activity}</b></td><td>{a.role}</td><td>{a.taxType ?? '—'}</td><td>{a.company}</td><td>{timeOf(a.at)}</td></tr>
              ))}
              {d.audit.length === 0 && <tr><td colSpan={5} style={{ color: '#94a3b8' }}>감사 이력 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoadingCard() { return <div className={styles.card}><div className={styles.placeholder}>불러오는 중…</div></div>; }
function ErrCard({ msg }: { msg: string }) { return <div className={styles.card}><div className={styles.placeholder}>{msg}</div></div>; }
