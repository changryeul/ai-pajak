'use client';
import { useMemo, useState } from 'react';
import styles from './workqueue.module.css';
import type { OperatorEdits } from './types';

/**
 * 워크큐 행 상세 팝업 (수정요청 10·15·24, 2026-08-05).
 *
 * - 필드 수정 → 기존 검증된 고객측 PUT(재계산 포함)으로 저장
 * - '저장 및 확인' → row-review PATCH 로 확인 스탬프 + 수정 이력 누적
 * - operatorEdits 가 있는 필드는 색 점으로 표시: 상담원(보라)/수퍼바이저(주황)
 *   → 수퍼바이저가 상담원이 뭘 고쳤는지, 상담원이 수퍼바이저 수정을 한눈에 확인
 */
export interface FieldDef {
  key: string;            // row 객체의 값 키 (표시/diff 용)
  label: string;
  type: 'number' | 'text' | 'date';
  putKey?: string;        // PUT body 의 키 (기본 = key)
  readOnly?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  // 읽기 요약 (수정요청 31·34·37): 고객이 보는 핵심 값들을 편집 그리드 위에
  // 강조 카드로 먼저 보여준다. label/value 쌍, value 는 이미 포맷된 문자열.
  summary?: Array<{ label: string; value: string }>;
  rowId: string;
  queueId: string;
  putUrl: string;                       // 저장용 기존 PUT 엔드포인트
  putExtra?: Record<string, unknown>;   // 재계산에 필요한 동반 필드 (예: serviceType)
  fields: FieldDef[];
  values: Record<string, unknown>;
  operatorEdits?: OperatorEdits | null;
  reviewedAt?: string | null;
  aiNote?: { label: string; issues: string[] } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RowDetailModal({
  title, subtitle, summary, rowId, queueId, putUrl, putExtra, fields, values,
  operatorEdits, reviewedAt, aiNote, onClose, onSaved,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of fields) d[f.key] = values[f.key] == null ? '' : String(values[f.key]);
    return d;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const changed: Array<{ field: string; putKey: string; from: unknown; to: unknown; type: FieldDef['type'] }> = [];
    for (const f of fields) {
      if (f.readOnly) continue;
      const orig = values[f.key] == null ? '' : String(values[f.key]);
      if (draft[f.key] !== orig) {
        const to = f.type === 'number' ? Number(draft[f.key] || 0) : draft[f.key];
        changed.push({ field: f.key, putKey: f.putKey ?? f.key, from: values[f.key] ?? null, to, type: f.type });
      }
    }
    return changed;
  }, [fields, values, draft]);

  const saveAndConfirm = async () => {
    setBusy(true); setError(null);
    try {
      if (dirty.length > 0) {
        const body: Record<string, unknown> = { id: rowId, ...(putExtra ?? {}) };
        for (const d of dirty) body[d.putKey] = d.to;
        const r = await fetch(putUrl, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError((j as { error?: string }).error || `저장 실패 (${r.status})`);
          return;
        }
      }
      const rr = await fetch(`/api/operator/workqueue/${queueId}/row-review`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId, confirm: true,
          edits: dirty.map(d => ({ field: d.field, from: d.from, to: d.to })),
        }),
      });
      if (!rr.ok) {
        const j = await rr.json().catch(() => ({}));
        setError((j as { error?: string }).error || `확인 처리 실패 (${rr.status})`);
        return;
      }
      onSaved();
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요.');
    } finally { setBusy(false); }
  };

  const editDot = (key: string) => {
    const e = operatorEdits?.[key];
    if (!e) return null;
    const sup = e.role === 'SUPERVISOR';
    return (
      <span className={`${styles.editDot} ${sup ? styles.editSup : styles.editCounselor}`}
        title={`${sup ? '수퍼바이저' : '상담원'} 수정: ${e.from ?? '—'} → ${e.to ?? '—'}`} />
    );
  };

  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {subtitle && <p className={styles.modalSub}>{subtitle}</p>}
        {reviewedAt && <div className={styles.reviewedNote}>✅ 확인 완료 ({new Date(reviewedAt).toLocaleString('ko-KR')}) — 다시 저장하면 갱신됩니다.</div>}

        {summary && summary.length > 0 && (
          <div className={styles.detailSummary}>
            {summary.map((s, i) => (
              <div key={i} className={styles.detailSummaryItem}>
                <small>{s.label}</small><b>{s.value}</b>
              </div>
            ))}
          </div>
        )}

        <div className={styles.editGridLabel}>제출 자료 수정</div>
        <div className={styles.fieldGrid}>
          {fields.map(f => (
            <label key={f.key} className={styles.fieldItem}>
              <span>{f.label}{editDot(f.key)}</span>
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={draft[f.key]}
                readOnly={f.readOnly}
                className={f.readOnly ? styles.roInput : undefined}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        {aiNote && (
          <div className={styles.ai} style={{ marginTop: 10 }}>
            <b>AI 분석</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li>{aiNote.label}</li>
              {aiNote.issues.map((i, n) => <li key={n}>{i}</li>)}
            </ul>
          </div>
        )}

        {error && <div className={styles.blocked} style={{ marginTop: 10 }}>{error}</div>}

        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose} disabled={busy}>닫기</button>
          <button className={`${styles.btn} ${styles.green}`} onClick={saveAndConfirm} disabled={busy}>
            {busy ? '저장 중…' : dirty.length > 0 ? `저장 및 확인 (${dirty.length}개 수정)` : '저장 및 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
