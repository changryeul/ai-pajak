'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { RequestChatModal } from './RequestChatModal';
import { AnnualReviewTable } from './AnnualReviewTable';
import { AiPreReviewBox } from './AiPreReviewBox';
import { ApprovalActions } from './ApprovalActions';
import type { AnnualDetail } from './types';

const SUBMISSION_LABELS: Record<string, { key: string; cls: 'red' | 'amber' | 'green' | 'blue' }> = {
  SUBMITTED: { key: 'subSubmitted', cls: 'blue' },
  OPERATOR_REVIEW: { key: 'subOperatorReview', cls: 'amber' },
  PROCESSING: { key: 'subProcessing', cls: 'amber' },
  BPE_UPLOADED: { key: 'subBpeUploaded', cls: 'green' },
  COMPLETED: { key: 'subCompleted', cls: 'green' },
  FAILED: { key: 'subFailed', cls: 'red' },
  CANCELLED: { key: 'subCancelled', cls: 'red' },
};

const STEP_KEYS: Record<string, string> = {
  basic: 'step1', documents: 'step2', financial: 'step3',
  koreksi: 'step4', calculation: 'step5', billing: 'step6',
  payment: 'step7', submit: 'step8',
};
// ⑥ ID Billing 은 세법 용어라 번역 없이 표기.
const STEP_LITERAL: Record<string, string> = { billing: '⑥ ID Billing' };

export function AnnualReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const t = useTranslations('operatorWorkqueue');
  const tw = useTranslations('workqueue');
  const [detail, setDetail] = useState<AnnualDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/annual`);
      const j = await r.json();
      if (j.success) setDetail(j.data as AnnualDetail);
      else setError(tw('loadDetailFailed'));
    } catch { setError(tw('loadDetailFailed')); }
  }, [queueId, tw]);
  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className={styles.card}><div className={styles.body}>
      <div className={styles.blocked}>{error}</div>
      <button className={styles.btn} onClick={() => load()}>{tw('retry')}</button>
    </div></div>
  );
  if (!detail) return <div className={styles.card}><div className={styles.body}>{tw('loading')}</div></div>;

  const s = detail.summary;
  const closingTypeText = s.closingType === 'UMKM' ? 'UMKM (PPh Final 0.5%)'
    : s.closingType === 'PPH25' ? tw('closingTypePph25')
    : tw('closingTypeNone');
  const subMeta = s.submissionStatus ? SUBMISSION_LABELS[s.submissionStatus] : null;
  const sub = s.submissionStatus
    ? (subMeta ? { text: tw(subMeta.key), cls: subMeta.cls } : { text: s.submissionStatus, cls: 'gray' as const })
    : null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h1>{t('annualTitle')}</h1>
          <p>{tw('fiscalYearLabel', { year: detail.fiscalYear })} · {s.serviceLabel ?? tw('annualSubtitleDefault')}</p>
        </div>
        <ApprovalActions queueId={queueId} onChanged={load} />
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>{tw('metricClosingType')}</small><b>{closingTypeText}</b></div>
          <div className={styles.metric2}><small>{tw('metricProgressStep')}</small>
            <b>{s.sessionStatus === 'COMPLETED' ? tw('closingCompleted') : (s.currentStep ? (STEP_LITERAL[s.currentStep] ?? (STEP_KEYS[s.currentStep] ? tw(STEP_KEYS[s.currentStep]) : s.currentStep)) : '—')}</b></div>
          <div className={styles.metric2}><small>{tw('metricSubmissionStatus')}</small>
            <b>{sub ? sub.text : tw('djpNotSubmitted')}</b></div>
          <div className={styles.metric2}><small>BPE / NTPN</small>
            <b style={{ fontSize: 15 }}>{s.bpeNumber ?? '—'}{s.ntpn ? ` / ${s.ntpn}` : ''}</b></div>
        </div>

        {detail.flags.issues.length > 0 && (
          <div className={detail.flags.level === 'red' ? styles.blocked : undefined}
            style={detail.flags.level !== 'red' ? { border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.45, marginBottom: 12 } : undefined}>
            <b>{tw('needsConfirmation')}</b>
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
            <button className={`${styles.btn} ${styles.blue}`} onClick={() => setRequestOpen(true)}>{tw('requestFromCustomer')}</button>
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
  const tw = useTranslations('workqueue');
  return (
    <RequestChatModal
      toLabel={tw('reqToAnnual', { year: fiscalYear })}
      contextLabel={tw('reqCtxAnnual', { issue: defaultIssue })}
      defaultMessage={tw('reqMsgAnnual', { year: fiscalYear, issue: defaultIssue })}
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
