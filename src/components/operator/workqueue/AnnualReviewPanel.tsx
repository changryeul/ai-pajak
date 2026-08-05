'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { RequestChatModal } from './RequestChatModal';
import { AnnualReviewTable } from './AnnualReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { AnnualDetail } from './types';

const SUBMISSION_LABELS: Record<string, { text: string; cls: 'red' | 'amber' | 'green' | 'blue' }> = {
  SUBMITTED: { text: '제출됨 (처리 대기)', cls: 'blue' },
  OPERATOR_REVIEW: { text: '운영팀 검토중', cls: 'amber' },
  PROCESSING: { text: 'DJP 처리중', cls: 'amber' },
  BPE_UPLOADED: { text: 'BPE 수령', cls: 'green' },
  COMPLETED: { text: '완료', cls: 'green' },
  FAILED: { text: '제출 실패', cls: 'red' },
  CANCELLED: { text: '취소됨', cls: 'red' },
};

const STEP_LABELS: Record<string, string> = {
  basic: '① 기본정보', documents: '② 증빙 업로드', financial: '③ 재무자료',
  koreksi: '④ 세무조정', calculation: '⑤ 세액계산', billing: '⑥ ID Billing',
  payment: '⑦ 납부', submit: '⑧ 제출',
};

export function AnnualReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const [detail, setDetail] = useState<AnnualDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/annual`);
      const j = await r.json();
      if (j.success) setDetail(j.data as AnnualDetail);
      else setError('상세 자료를 불러오지 못했습니다.');
    } catch { setError('상세 자료를 불러오지 못했습니다.'); }
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className={styles.card}><div className={styles.body}>
      <div className={styles.blocked}>{error}</div>
      <button className={styles.btn} onClick={() => load()}>다시 시도</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>불러오는 중…</div></div>;

  const s = detail.summary;
  const closingTypeText = s.closingType === 'UMKM' ? 'UMKM (PPh Final 0.5%)'
    : s.closingType === 'PPH25' ? 'PPh 25 (정상 법인세)'
    : '결산 세션 미연결';
  const sub = s.submissionStatus ? SUBMISSION_LABELS[s.submissionStatus] ?? { text: s.submissionStatus, cls: 'gray' as const } : null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h1>{t('annualTitle')}</h1>
          <p>{detail.fiscalYear} 회계연도 · {s.serviceLabel ?? '연 신고(SPT Tahunan) 검토'}</p>
        </div>
        <ApprovalActions queueId={queueId} onChanged={load} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>결산 유형</small><b>{closingTypeText}</b></div>
          <div className={styles.metric2}><small>진행 단계</small>
            <b>{s.sessionStatus === 'COMPLETED' ? '결산 완료' : (s.currentStep ? (STEP_LABELS[s.currentStep] ?? s.currentStep) : '—')}</b></div>
          <div className={styles.metric2}><small>제출 상태</small>
            <b>{sub ? sub.text : 'DJP 미제출'}</b></div>
          <div className={styles.metric2}><small>BPE / NTPN</small>
            <b style={{ fontSize: 15 }}>{s.bpeNumber ?? '—'}{s.ntpn ? ` / ${s.ntpn}` : ''}</b></div>
        </div>

        {detail.flags.issues.length > 0 && (
          <div className={detail.flags.level === 'red' ? styles.blocked : undefined}
            style={detail.flags.level !== 'red' ? { border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.45, marginBottom: 12 } : undefined}>
            <b>확인 필요</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {detail.flags.issues.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </div>
        )}

        <AiPreReviewBox queueId={queueId} taxView="annual" period={String(detail.fiscalYear)}
          summary={{ documentCount: s.documentCount, signedStatementsUploaded: s.signedStatementsUploaded ? 1 : 0 }}
          rows={[{ flags: detail.flags }]} />

        <div className={styles.toolbar}>
          <div>
            <span className={`${styles.badge} ${styles[detail.flags.level]}`}>{detail.flags.label}</span>
            {sub && <span className={`${styles.badge} ${styles[sub.cls]}`}>{sub.text}</span>}
          </div>
          <div>
            <button className={`${styles.btn} ${styles.blue}`} onClick={() => setRequestOpen(true)}>고객에게 요청</button>
          </div>
        </div>

        <AnnualReviewTable rows={detail.rows} />
      </div>

      {requestOpen && (
        <RequestModal queueId={queueId} fiscalYear={detail.fiscalYear} defaultIssue={detail.flags.label}
          onClose={() => setRequestOpen(false)}
          onSent={async () => { setRequestOpen(false); await load(); onChanged(); }} />
      )}
    </div>
  );
}

function RequestModal({ queueId, fiscalYear, defaultIssue, onClose, onSent }:
  { queueId: string; fiscalYear: number; defaultIssue: string; onClose: () => void; onSent: () => void }) {
  return (
    <RequestChatModal
      toLabel={`${fiscalYear} 회계연도 연 신고`}
      contextLabel={`연 신고 (SPT Tahunan) · ${defaultIssue}`}
      defaultMessage={`${fiscalYear} 회계연도 연 신고(SPT Tahunan) 관련 "${defaultIssue}" 항목의 자료 보완을 부탁드립니다.`}
      onSend={async (message) => {
        await fetch(`/api/operator/workqueue/${queueId}/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        onSent();
      }}
      onClose={onClose}
    />
  );
}
