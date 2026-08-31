'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { EmployeeReviewTable } from './EmployeeReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { Pph21Detail, Pph21Row } from './types';
import { RowDetailModal, type FieldDef } from './RowDetailModal';
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { RequestChatModal } from './RequestChatModal';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const LEVEL_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };

type TW = (key: string, values?: Record<string, string | number>) => string;

// 팝업 편집 필드 (요청 10). putKey = monthly_payslip 컬럼명 — 저장 시 서버가
// computePayslipTotals 로 총액/PPh21 재계산.
// 수정요청 45 — 고객 급여명세 입력 화면과 동일한 전체 섹션 구성.
const buildPph21Fields = (tw: TW): FieldDef[] => {
  const secAttendance = tw('secAttendance');
  const secBasePay = tw('secBasePayAllowances');
  const secSpecial = tw('secSpecialPay');
  const secBonus = tw('secBonus');
  const secDeductions = tw('secDeductions');
  const secAuto = tw('secAutoCalc');
  const secCompany = tw('secCompanyBpjs');
  return [
    // 근태
    { key: 'workingDays', label: tw('fWorkingDays'), type: 'number', putKey: 'working_days', section: secAttendance },
    { key: 'absentDays', label: tw('fAbsentDays'), type: 'number', putKey: 'absent_days', section: secAttendance },
    { key: 'overtimeHours', label: tw('fOvertimeHours'), type: 'number', putKey: 'overtime_hours', section: secAttendance },
    // 기본급 + 수당
    { key: 'baseSalary', label: tw('fBaseSalary'), type: 'number', putKey: 'base_salary', section: secBasePay },
    { key: 'overtimePay', label: tw('fOvertimePay'), type: 'number', putKey: 'overtime_pay', section: secBasePay },
    { key: 'mealAllowance', label: tw('fMealAllowance'), type: 'number', putKey: 'meal_allowance', section: secBasePay },
    { key: 'transportAllowance', label: tw('fTransportAllowance'), type: 'number', putKey: 'transport_allowance', section: secBasePay },
    { key: 'positionAllowance', label: tw('fPositionAllowance'), type: 'number', putKey: 'position_allowance', section: secBasePay },
    { key: 'otherAllowances', label: tw('fOtherAllowances'), type: 'number', putKey: 'other_allowances', section: secBasePay },
    { key: 'laptopAllowance', label: tw('fLaptopAllowance'), type: 'number', putKey: 'laptop_allowance', section: secBasePay },
    { key: 'medicalAllowance', label: tw('fMedicalAllowance'), type: 'number', putKey: 'medical_allowance', section: secBasePay },
    { key: 'taxAllowance', label: tw('fTaxAllowance'), type: 'number', putKey: 'tax_allowance', section: secBasePay },
    { key: 'annualLeavePay', label: tw('fAnnualLeavePay'), type: 'number', putKey: 'annual_leave_pay', section: secBasePay },
    // 특수 지급
    { key: 'severanceAllowance', label: tw('fSeveranceAllowance'), type: 'number', putKey: 'severance_allowance', section: secSpecial },
    { key: 'pkwtCompensation', label: tw('fPkwtCompensation'), type: 'number', putKey: 'pkwt_compensation', section: secSpecial },
    // 보너스
    { key: 'bonusOnly', label: tw('fBonus'), type: 'number', putKey: 'bonus', section: secBonus },
    { key: 'thrOnly', label: tw('fThr'), type: 'number', putKey: 'thr', section: secBonus },
    { key: 'commission', label: tw('fCommission'), type: 'number', putKey: 'commission', section: secBonus },
    // 공제
    { key: 'bpjsKesehatan', label: tw('fBpjsKesehatan'), type: 'number', putKey: 'bpjs_kesehatan', section: secDeductions },
    { key: 'bpjsKetenagakerjaan', label: tw('fBpjsKetenagakerjaan'), type: 'number', putKey: 'bpjs_ketenagakerjaan', section: secDeductions },
    { key: 'jhtEmployee', label: 'JHT', type: 'number', putKey: 'jht_employee', section: secDeductions },
    { key: 'jpEmployee', label: tw('fJp'), type: 'number', putKey: 'jp_employee', section: secDeductions },
    { key: 'loanDeduction', label: tw('fLoanDeduction'), type: 'number', putKey: 'loan_deduction', section: secDeductions },
    { key: 'otherDeductions', label: tw('fOtherDeductions'), type: 'number', putKey: 'other_deductions', section: secDeductions },
    // 자동 계산
    { key: 'totalGross', label: tw('fTotalGross'), type: 'number', readOnly: true, section: secAuto },
    { key: 'pph21', label: 'PPh 21', type: 'number', readOnly: true, section: secAuto },
    { key: 'netSalary', label: tw('fNetSalary'), type: 'number', readOnly: true, section: secAuto },
    // 회사 부담 BPJS (자동)
    { key: 'bpjsKesCompany', label: 'BPJS KES 4%', type: 'number', readOnly: true, section: secCompany },
    { key: 'jkkCompany', label: 'JKK', type: 'number', readOnly: true, section: secCompany },
    { key: 'jkmCompany', label: 'JKM', type: 'number', readOnly: true, section: secCompany },
    { key: 'jhtCompany', label: 'JHT 3.70%', type: 'number', readOnly: true, section: secCompany },
    { key: 'jpCompany', label: 'JP 2.00%', type: 'number', readOnly: true, section: secCompany },
  ];
};

export function Pph21ReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const tw = useTranslations('workqueue');
  const { requiredKeys } = useRequiredFields('payslip');
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
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);

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
        <button className={styles.btn} onClick={() => load()}>{tw('retry')}</button>
      </div>
    </div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>{tw('loading')}</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div><h1>{t('pph21Title')}</h1><p>{tw('subPph21', { period: detail.period })}</p></div>
        <ApprovalActions queueId={queueId} onChanged={load}
          hasIssues={(detail.rows ?? []).some(r => r.flags.level === 'red')} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{tw('metricEmployeeCount')}</small><b>{tw('unitPeople', { count: s.employeeCount })}</b></div>
          <div className={styles.metric2}><small>{tw('metricTotalGross')}</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>{tw('metricTotalPph21')}</small><b>{rp(s.totalPph21)}</b></div>
          <div className={styles.metric2}><small>{tw('incomplete')}</small><b>{tw('unitCases', { count: s.incompleteCount })}</b></div>
        </div>

        <AiPreReviewBox queueId={queueId} taxView="pph21" period={detail.period} summary={s} rows={detail.rows} />

        <>
            <div className={styles.toolbar}>
              <div>
                <input placeholder={tw('searchEmployeePlaceholder')} value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                <select value={empStatus} onChange={e => setEmpStatus(e.target.value as '' | 'red' | 'amber' | 'green')}>
                  <option value="">{tw('filterAll')}</option>
                  <option value="red">{tw('needsRequest')}</option>
                  <option value="amber">{tw('needsReview')}</option>
                  <option value="green">{tw('confirmed')}</option>
                </select>
              </div>
            </div>

            <EmployeeReviewTable rows={rows} selectedId={detailRow?.payslipId ?? null}
              onSelect={(payslipId) => {
                const row = rows.find(r => r.payslipId === payslipId);
                if (row) setDetailRow(row);
              }} onRequest={setRequestTarget} />

        </>
      </div>

      {detailRow && (
        <RowDetailModal
          key={detailRow.payslipId}
          title={tw('detailEmployeeTitle', { name: detailRow.name })}
          subtitle={tw('detailEmployeeSubtitle', { period: detail.period })}
          summary={[
            { label: tw('fEmployeeNumber'), value: detailRow.employeeNumber || '—' },
            { label: 'NPWP', value: detailRow.npwp || '—' },
            { label: 'NIK', value: detailRow.nik || '—' },
            { label: 'PTKP', value: String(detailRow.ptkp) },
            { label: tw('fEmploymentType'), value: detailRow.employmentStatus || '—' },
            { label: tw('fWorkerType'), value: detailRow.workerType || '—' },
            { label: tw('fPosition'), value: detailRow.position || '—' },
            { label: tw('fDepartment'), value: detailRow.department || '—' },
          ]}
          rowId={detailRow.payslipId}
          queueId={queueId}
          putUrl="/api/tax/monthly-payslip"
          fields={buildPph21Fields(tw)}
          requiredKeys={requiredKeys}
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
  const tw = useTranslations('workqueue');
  const isBulk = target === 'BULK';
  const row = isBulk ? null : (target as Pph21Row);
  return (
    <RequestChatModal
      toLabel={isBulk ? tw('bulkEmployeeData') : row!.name}
      contextLabel={isBulk ? tw('reqCtxPph21Bulk') : tw('reqCtxPph21', { label: row!.flags.label })}
      defaultMessage={isBulk
        ? tw('reqMsgPph21Bulk')
        : tw('reqMsgPph21', { name: row!.name, label: row!.flags.label })}
      onSend={async (message) => {
        await fetch(`/api/operator/workqueue/${queueId}/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: isBulk ? undefined : row!.employeeId, message }),
        });
        onSent();
      }}
      onClose={onClose}
    />
  );
}
