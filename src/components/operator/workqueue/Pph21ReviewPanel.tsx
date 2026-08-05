'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { EmployeeReviewTable } from './EmployeeReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { Pph21Detail, Pph21Row } from './types';
import { RowDetailModal, type FieldDef } from './RowDetailModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const LEVEL_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };

// 팝업 편집 필드 (요청 10). putKey = monthly_payslip 컬럼명 — 저장 시 서버가
// computePayslipTotals 로 총액/PPh21 재계산.
const PPH21_FIELDS: FieldDef[] = [
  { key: 'baseSalary', label: '기본급', type: 'number', putKey: 'base_salary' },
  { key: 'mealAllowance', label: '식대', type: 'number', putKey: 'meal_allowance' },
  { key: 'transportAllowance', label: '교통비', type: 'number', putKey: 'transport_allowance' },
  { key: 'positionAllowance', label: '직책수당', type: 'number', putKey: 'position_allowance' },
  { key: 'otherAllowances', label: '기타수당', type: 'number', putKey: 'other_allowances' },
  { key: 'bonusOnly', label: '보너스', type: 'number', putKey: 'bonus' },
  { key: 'thrOnly', label: 'THR', type: 'number', putKey: 'thr' },
  { key: 'bpjsKesehatan', label: 'BPJS 건강', type: 'number', putKey: 'bpjs_kesehatan' },
  { key: 'jhtEmployee', label: 'JHT (직원)', type: 'number', putKey: 'jht_employee' },
  { key: 'jpEmployee', label: 'JP (직원)', type: 'number', putKey: 'jp_employee' },
  { key: 'otherDeductions', label: '기타공제', type: 'number', putKey: 'other_deductions' },
  { key: 'totalGross', label: '총 지급 (자동계산)', type: 'number', readOnly: true },
  { key: 'pph21', label: 'PPh 21 (자동계산)', type: 'number', readOnly: true },
];

export function Pph21ReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<Pph21Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empStatus, setEmpStatus] = useState<'' | 'red' | 'amber' | 'green'>('');
  const [detailRow, setDetailRow] = useState<Pph21Row | null>(null); // 팝업 상세 (요청 10)
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


  const rows = useMemo(() => {
    const list = (detail?.rows ?? []).filter(r =>
      (!empStatus || r.flags.level === empStatus) &&
      (!empSearch || r.name.toLowerCase().includes(empSearch.toLowerCase())));
    return [...list].sort((a, b) => LEVEL_ORDER[a.flags.level] - LEVEL_ORDER[b.flags.level]);
  }, [detail, empStatus, empSearch]);


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
        <div><h1>{t('pph21Title')}</h1><p>{detail.period} 귀속분 · 고객 제출자료 전체 검토</p></div>
        <ApprovalActions queueId={queueId} onChanged={load} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>직원 수</small><b>{s.employeeCount}명</b></div>
          <div className={styles.metric2}><small>총 지급</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>PPh 21 합계</small><b>{rp(s.totalPph21)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="pph21" period={detail.period} summary={s} rows={detail.rows} />

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
            </div>

            <EmployeeReviewTable rows={rows} selectedId={detailRow?.employeeId ?? null}
              onSelect={(employeeId) => {
                const row = rows.find(r => r.employeeId === employeeId);
                if (row) setDetailRow(row);
              }} onRequest={setRequestTarget} />

        </>
      </div>

      {detailRow && (
        <RowDetailModal
          title={`직원 상세: ${detailRow.name}`}
          subtitle={`${detail.period} 귀속 · PTKP ${detailRow.ptkp} · TER ${detailRow.terCategory} · PPh21 ${rp(detailRow.pph21)}`}
          rowId={detailRow.payslipId}
          queueId={queueId}
          putUrl="/api/tax/monthly-payslip"
          fields={PPH21_FIELDS}
          values={detailRow as unknown as Record<string, unknown>}
          operatorEdits={detailRow.operatorEdits}
          reviewedAt={detailRow.reviewedAt}
          aiNote={{ label: detailRow.flags.label, issues: detailRow.flags.issues }}
          onClose={() => setDetailRow(null)}
          onSaved={async () => { setDetailRow(null); await load(); onChanged(); }}
        />
      )}

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
