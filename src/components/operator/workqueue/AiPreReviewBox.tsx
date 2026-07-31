'use client';
import { useState } from 'react';
import styles from './workqueue.module.css';

interface FlagRow { flags: { level: 'red' | 'amber' | 'green'; label: string } }
interface Result {
  riskLevel: 'low' | 'medium' | 'high';
  headline: string;
  findings: string[];
  recommendation: string;
  mode: 'ai' | 'rule';
}

const RISK: Record<Result['riskLevel'], [string, string]> = {
  low: ['낮음', 'green'],
  medium: ['보통', 'amber'],
  high: ['높음', 'red'],
};

interface Props {
  queueId: string;
  taxView: string;
  period: string;
  summary: Record<string, number>;
  rows: FlagRow[];
}

export function AiPreReviewBox({ queueId, taxView, period, summary, rows }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/operator/workqueue/${queueId}/ai-review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxView, period, summary, rows }),
      });
      const j = await r.json();
      if (j.success) setResult(j.data as Result);
      else setError('AI 검토를 생성하지 못했습니다.');
    } catch { setError('AI 검토를 생성하지 못했습니다.'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.ai} style={{ marginTop: 4, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <b>🤖 AI 사전검토</b>
        <button className={`${styles.btn} ${styles.blue}`} onClick={run} disabled={loading}>
          {loading ? '분석 중…' : result ? '다시 실행' : 'AI 검토 실행'}
        </button>
      </div>

      {error && <div className={styles.blocked} style={{ marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className={`${styles.badge} ${styles[RISK[result.riskLevel][1]]}`}>위험도 {RISK[result.riskLevel][0]}</span>
            <b>{result.headline}</b>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{result.mode === 'ai' ? 'AI' : '규칙 기반'}</span>
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
