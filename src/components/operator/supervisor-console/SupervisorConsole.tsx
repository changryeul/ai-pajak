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
  operators: Array<{ id: string; name: string }>;
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
              <a className={styles.btn} href={`/${locale}/operator/workqueue`}>← 업무함</a>
              <button className={styles.btn} onClick={logout}>로그아웃</button>
            </div>
          </div>

          {!data ? <div className={styles.card}><div className={styles.placeholder}>불러오는 중…</div></div>
            : view === 'dashboard' ? <DashboardView d={data} />
            : view === 'assignment' ? <AssignmentView d={data} onAuto={runAutoAssign} onReassigned={async (m) => { showToast(m); await load(); }} />
            : <PlaceholderView title={meta.title} />}
        </main>
      </div>
      {toast && <div className={styles.toast}>{toast}</div>}
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
          <div className={styles.cardHead}><div><h2>상담원 순위</h2><p>품질점수 기준</p></div></div>
          <div className={styles.cardBody}>
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

// ── 아직 미연동 뷰 ──
function PlaceholderView({ title }: { title: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>{title}</h2><p>이 뷰는 다음 단계에서 실데이터로 연동됩니다.</p></div></div>
      <div className={styles.placeholder}>준비 중 — 기존 화면은 /operator/supervisor 에서 계속 사용할 수 있습니다.</div>
    </div>
  );
}
