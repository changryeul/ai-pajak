'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './workqueue.module.css';
import { EmployeeReviewTable } from './EmployeeReviewTable';
import { CustomerMirrorToggle } from './CustomerMirrorToggle';
import type { Pph21Detail, Pph21Row } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const LEVEL_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };

export function Pph21ReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<Pph21Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empStatus, setEmpStatus] = useState<'' | 'red' | 'amber' | 'green'>('');
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] = useState<Pph21Row | 'BULK' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/pph21`);
      const j = await r.json();
      if (j.success) setDetail(j.data as Pph21Detail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    try {
      await fetch('/api/operator/queue', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, action }),
      });
      await load(); onChanged();
    } catch { setError('상태 변경에 실패했습니다.'); }
  };

  const rows = useMemo(() => {
    const list = (detail?.rows ?? []).filter(r =>
      (!empStatus || r.flags.level === empStatus) &&
      (!empSearch || r.name.toLowerCase().includes(empSearch.toLowerCase())));
    return [...list].sort((a, b) => LEVEL_ORDER[a.flags.level] - LEVEL_ORDER[b.flags.level]);
  }, [detail, empStatus, empSearch]);

  const selected = useMemo(
    () => detail?.rows.find(r => r.employeeId === selectedEmp) ?? detail?.rows[0] ?? null,
    [detail, selectedEmp]);

  if (error) return (
    <div className={styles.card}>
      <div className={styles.body}>
        <div className={styles.blocked}>{error}</div>
        <button className={styles.btn} onClick={() => load()}>다시 시도</button>
      </div>
    </div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>불러오는 중…</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div><h1>개인소득세 (PPh 21)</h1><p>{detail.period} 귀속분 · 고객 제출자료 전체 검토</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <button className={styles.btn} onClick={() => setMirror(m => !m)}>
            {mirror ? '검토 표로' : '고객이 보는 그대로 보기'}
          </button>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>직원 수</small><b>{s.employeeCount}명</b></div>
          <div className={styles.metric2}><small>총 지급</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>PPh 21 합계</small><b>{rp(s.totalPph21)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        {mirror ? <CustomerMirrorToggle customerId={detail.customerId} /> : (
          <>
            <div className={styles.toolbar}>
              <div>
                <input placeholder="직원명 검색" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                <select value={empStatus} onChange={e => setEmpStatus(e.target.value as '' | 'red' | 'amber' | 'green')}>
                  <option value="">전체 상태</option>
                  <option value="red">요청 필요</option>
                  <option value="amber">검토 필요</option>
                  <option value="green">확인 완료</option>
                </select>
              </div>
              <div>
                <button className={`${styles.btn} ${styles.blue}`} onClick={() => setRequestTarget('BULK')}>일괄 요청</button>
                <button className={`${styles.btn} ${styles.purple}`} onClick={() => act('request-approval')}>고객 검토완료</button>
              </div>
            </div>

            <EmployeeReviewTable rows={rows} selectedId={selected?.employeeId ?? null}
              onSelect={setSelectedEmp} onRequest={setRequestTarget} />

            {selected && (
              <div className={styles.section}>
                <h3>선택 직원 상세보기: {selected.name}</h3>
                <div className={styles.body}>
                  <div className={styles.detail}>
                    <div className={styles.di}><label>상태</label><b>{selected.payslipStatus === 'FINALIZED' || selected.payslipStatus === 'FILED' ? '완료' : '작성중'}</b></div>
                    <div className={styles.di}><label>NPWP</label><b>{selected.npwp ?? 'NPWP 없음'}</b></div>
                    <div className={styles.di}><label>PTKP / TER</label><b>{selected.ptkp} · {selected.terCategory}</b></div>
                    <div className={styles.di}><label>총 지급</label><b>{rp(selected.totalGross)}</b></div>
                    <div className={styles.di}><label>BPJS</label><b>{selected.bpjs > 0 ? '입력완료' : '미입력'}</b></div>
                    <div className={styles.di}><label>PPh 21</label><b>{rp(selected.pph21)}</b></div>
                  </div>
                  <div className={styles.ai}>
                    <b>직원별 AI 분석</b>
                    <ul>
                      <li>{selected.flags.label}</li>
                      <li>요청 버튼은 고객 화면의 해당 직원 행에 요청으로 표시됩니다.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {requestTarget && (
        <RequestModal key={requestTarget === 'BULK' ? 'bulk' : requestTarget.employeeId}
          target={requestTarget} queueId={queueId}
          onClose={() => setRequestTarget(null)}
          onSent={async () => { setRequestTarget(null); await load(); onChanged(); }} />
      )}
    </div>
  );
}

function RequestModal({ target, queueId, onClose, onSent }:
  { target: Pph21Row | 'BULK'; queueId: string; onClose: () => void; onSent: () => void }) {
  const isBulk = target === 'BULK';
  const defaultMsg = isBulk
    ? '직원 자료 일괄 보완을 부탁드립니다.'
    : `${(target as Pph21Row).name}님의 ${(target as Pph21Row).flags.label} 관련 자료를 확인 부탁드립니다.`;
  const [msg, setMsg] = useState(defaultMsg);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setSending(true);
    try {
      await fetch(`/api/operator/workqueue/${queueId}/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: isBulk ? undefined : (target as Pph21Row).employeeId, message: msg }),
      });
      onSent();
    } finally { setSending(false); }
  };

  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>고객에게 요청</h2>
        <div className={styles.mb}>
          <label>대상<input readOnly value={isBulk ? '직원 자료 일괄' : (target as Pph21Row).name} /></label>
          <label>고객에게 보낼 메시지<textarea value={msg} onChange={e => setMsg(e.target.value)} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={send} disabled={sending}>고객에게 표시</button>
        </div>
      </div>
    </div>
  );
}
