'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';

interface FlagRow { flags: { level: 'red' | 'amber' | 'green'; label: string } }
interface Result {
  riskLevel: 'low' | 'medium' | 'high';
  headline: string;
  findings: string[];
  recommendation: string;
  mode: 'ai' | 'rule';
}

// [라벨 i18n 키, badge 색]
const RISK: Record<Result['riskLevel'], [string, string]> = {
  low: ['riskLow', 'green'],
  medium: ['riskMedium', 'amber'],
  high: ['riskHigh', 'red'],
};

interface Props {
  queueId: string;
  taxView: string;
  period: string;
  summary: Record<string, number>;
  rows: FlagRow[];
}

/**
 * AI 사전검토 (수정요청 8·16·19번, 2026-08-05):
 * 패널 진입 시 자동 실행. 같은 자료(해시 동일)면 세션 캐시를 재사용해
 * AI 호출 비용을 통제하고, 자료가 바뀌면 "다시 실행" 으로 변경분 기준
 * 재검토 — 편집 중 매 저장마다 자동 재호출하지는 않는다.
 */
export function AiPreReviewBox({ queueId, taxView, period, summary, rows }: Props) {
  const tw = useTranslations('workqueue');
  const [result, setResult] = useState<Result | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 자료 지문 — flags 투영 + summary 만 사용 (payload 전체 직렬화 비용 회피)
  const payloadKey = useMemo(() => {
    const proj = rows.map(r => `${r.flags.level}|${r.flags.label}`).join(';');
    const raw = `${taxView}|${period}|${JSON.stringify(summary)}|${proj}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
    return `aiPreReview:${queueId}:${h}`;
  }, [queueId, taxView, period, summary, rows]);

  const run = useCallback(async (force: boolean) => {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(payloadKey);
        if (cached) { setResult(JSON.parse(cached) as Result); setResultKey(payloadKey); return; }
      } catch { /* sessionStorage 불가 환경이면 그냥 호출 */ }
    }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/ai-review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxView, period, summary, rows }),
      });
      const j = await r.json();
      if (j.success) {
        setResult(j.data as Result);
        setResultKey(payloadKey);
        try { sessionStorage.setItem(payloadKey, JSON.stringify(j.data)); } catch { /* */ }
      } else setError(tw('aiReviewFailed'));
    } catch { setError(tw('aiReviewFailed')); }
    finally { setLoading(false); }
    // rows/summary 는 payloadKey 에 지문으로 반영됨 — key 단위로만 재생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, queueId, taxView, period]);

  // 진입 시 자동 실행 (캐시 히트면 API 호출 없음). 자료 변경은 stale 안내로 처리.
  useEffect(() => {
    run(false);
    // 최초 마운트에서만 자동 실행 — 편집마다 재호출하지 않음 (비용 통제)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = !!result && resultKey !== payloadKey;

  return (
    <div className={styles.ai} style={{ marginTop: 4, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <b>🤖 {tw('aiPreReviewTitle')}</b>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stale && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>{tw('dataChangedRerun')}</span>}
          <button className={`${styles.btn} ${styles.blue}`} onClick={() => run(true)} disabled={loading}>
            {loading ? tw('analyzing') : result ? tw('rerun') : tw('runAiReview')}
          </button>
        </div>
      </div>

      {loading && !result && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{tw('autoAnalyzing')}</p>}
      {error && <div className={styles.blocked} style={{ marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10, opacity: stale ? 0.65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className={`${styles.badge} ${styles[RISK[result.riskLevel][1]]}`}>{tw('riskPrefix')} {tw(RISK[result.riskLevel][0])}</span>
            <b>{result.headline}</b>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{result.mode === 'ai' ? 'AI' : tw('modeRule')}</span>
          </div>
          {result.findings.length > 0 && (
            <ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
              {result.findings.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <p style={{ margin: 0, fontSize: 13 }}>💡 {result.recommendation}</p>
        </div>
      )}
    </div>
  );
}
