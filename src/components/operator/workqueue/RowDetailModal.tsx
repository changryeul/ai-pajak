'use client';
import { useMemo, useState } from 'react';
import { Pencil, Shield } from 'lucide-react';
import styles from './workqueue.module.css';
import type { OperatorEdits } from './types';

/**
 * 워크큐 행 상세 팝업 (수정요청 10·15·24, 2026-08-05 / 40·41·42 재디자인 2026-08-10).
 *
 * 고객 입력 화면과 동일한 디자인: 파란 편집 안내 배너 + 읽기 정보 카드 +
 * 섹션(h4) 별 소형 입력 그리드. 저장/확인·AI분석·수정 색점은 유지.
 * - 필드 수정 → 기존 검증된 고객측 PUT(재계산 포함)으로 저장
 * - '저장 및 확인' → row-review PATCH 로 확인 스탬프 + 수정 이력 누적
 * - operatorEdits 색 점: 상담원(보라)/수퍼바이저(주황)
 */
export interface FieldDef {
  key: string;            // row 객체의 값 키 (표시/diff 용)
  label: string;
  type: 'number' | 'text' | 'date';
  putKey?: string;        // PUT body 의 키 (기본 = key)
  readOnly?: boolean;
  section?: string;       // 섹션 그룹 헤더 (수정요청 40·41·42). 없으면 '항목'.
}

interface Props {
  title: string;
  subtitle?: string;
  // 읽기 정보 카드 (수정요청 31·34·37 → 40·41·42): 고객 화면 상단의 정보 카드처럼
  // 핵심/식별 값을 편집 그리드 위에 먼저 보여준다. value 는 이미 포맷된 문자열.
  summary?: Array<{ label: string; value: string }>;
  rowId: string;
  queueId: string;
  putUrl: string;                       // 저장용 기존 PUT 엔드포인트
  putExtra?: Record<string, unknown>;   // 재계산에 필요한 동반 필드 (예: serviceType)
  fields: FieldDef[];
  values: Record<string, unknown>;
  operatorEdits?: OperatorEdits | null;
  reviewedAt?: string | null;
  // 세율 결정 근거 카드 (수정요청 46·47) — 고객 화면과 동일한 인디고 Shield 박스.
  basisNote?: { heading: string; body: string; legal?: string } | null;
  // 세액 산출근거 (수정요청 46) — 숫자 산출식 (예: 총지급액 × 세율 = 세액).
  calcNote?: { heading: string; formula: string; result: string } | null;
  aiNote?: { label: string; issues: string[] } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RowDetailModal({
  title, subtitle, summary, rowId, queueId, putUrl, putExtra, fields, values,
  operatorEdits, reviewedAt, basisNote, calcNote, aiNote, onClose, onSaved,
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

  // 섹션 그룹핑 (입력 순서 보존)
  const sections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, FieldDef[]>();
    for (const f of fields) {
      const s = f.section ?? '항목';
      if (!map.has(s)) { map.set(s, []); order.push(s); }
      map.get(s)!.push(f);
    }
    return order.map(s => ({ title: s, fields: map.get(s)! }));
  }, [fields]);

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
      <div className="flex max-h-[90vh] w-[min(940px,95vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="rounded-md p-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/50 p-5">
          {/* 편집 안내 배너 — 고객 화면과 동일 */}
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900">
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span>각 필드를 클릭한 후 값을 변경하세요. 저장 및 확인 시 반영됩니다.</span>
          </div>

          {reviewedAt && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              ✅ 확인 완료 ({new Date(reviewedAt).toLocaleString('ko-KR')}) — 다시 저장하면 갱신됩니다.
            </div>
          )}

          {/* 읽기 정보 카드 (고객 화면 상단 정보 블록과 동일한 톤) */}
          {summary && summary.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                {summary.map((s, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                    <p className="font-mono font-semibold text-slate-800">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 섹션별 편집 그리드 */}
          {sections.map(sec => (
            <div key={sec.title} className="rounded-lg border border-gray-100 bg-white p-3">
              <h4 className="mb-2 text-xs font-bold text-gray-600">{sec.title}</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {sec.fields.map(f => (
                  <div key={f.key}>
                    <label className="flex items-center text-[10px] text-gray-400">
                      {f.label}{editDot(f.key)}
                    </label>
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={draft[f.key]}
                      readOnly={f.readOnly}
                      className={`h-8 w-full rounded-md border px-2 text-xs ${f.type === 'number' ? 'font-mono' : ''} ${
                        f.readOnly
                          ? 'border-gray-100 bg-gray-50 text-gray-500'
                          : 'border-gray-200 focus:border-blue-400 focus:outline-none'
                      }`}
                      onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {calcNote && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs">
              <p className="font-bold text-emerald-900">{calcNote.heading}</p>
              <p className="mt-0.5 font-mono text-emerald-800">{calcNote.formula}</p>
              <p className="mt-0.5 font-mono text-base font-black text-emerald-700">= {calcNote.result}</p>
            </div>
          )}

          {basisNote && (
            <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
              <div>
                <p className="font-bold text-indigo-900">{basisNote.heading}</p>
                <p className="text-indigo-700">{basisNote.body}</p>
                {basisNote.legal && <p className="text-[10px] text-indigo-500">{basisNote.legal}</p>}
              </div>
            </div>
          )}

          {aiNote && (
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs">
              <b className="text-violet-900">AI 분석</b>
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                <li>{aiNote.label}</li>
                {aiNote.issues.map((i, n) => <li key={n}>{i}</li>)}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50">
            닫기
          </button>
          <button onClick={saveAndConfirm} disabled={busy}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            {busy ? '저장 중…' : dirty.length > 0 ? `저장 및 확인 (${dirty.length}개 수정)` : '저장 및 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
