'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Loader2, Copy, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';

interface ParseRow {
  id: string;
  document_id: string;
  row_index: number;
  entity_label: string | null;
  field_name: string;
  field_value: unknown;
  severity: Severity;
  issue_code: string | null;
  message_ko: string | null;
  message_id: string | null;
  is_resolved: boolean;
  client_message_sent: boolean;
  slot: string | null;
}

interface Resp {
  success: boolean;
  data?: { rows: ParseRow[]; counts: { critical: number; warning: number; info: number } };
  error?: string;
}

const ICONS = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
  OK: CheckCircle2,
};
const TONES: Record<Severity, string> = {
  CRITICAL: 'bg-rose-50 border-rose-200 text-rose-700',
  WARNING: 'bg-amber-50 border-amber-200 text-amber-800',
  INFO: 'bg-slate-50 border-slate-200 text-slate-600',
  OK: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

export function ParseReviewPanel({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<ParseRow[]>([]);
  const [counts, setCounts] = useState({ critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/parse-rows`);
      const j: Resp = await r.json();
      if (!r.ok || !j.data) throw new Error(j.error ?? 'load failed');
      setRows(j.data.rows);
      setCounts(j.data.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runParse = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/parsing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'parse failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleResolved = async (rowId: string, current: boolean) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/parse-rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, isResolved: !current }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'patch failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const buildMessage = async (locale: 'ko' | 'id') => {
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/parse-rows/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'message failed');
      setMessage(j.data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async () => {
    if (message) {
      await navigator.clipboard.writeText(message);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">3-2. 자료 파싱 검토</p>
            <p className="text-xs text-slate-500 mt-1">
              자료별 행을 검토하고 critical 항목은 고객에게 확인요청 메시지를 보냅니다.
            </p>
          </div>
          <Button onClick={runParse} disabled={busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            AI 파싱 실행 (mvp mock)
          </Button>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-rose-100 text-rose-700 px-3 py-1 font-black">
            CRITICAL {counts.critical}
          </span>
          <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-black">
            WARNING {counts.warning}
          </span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1 font-black">
            INFO {counts.info}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="inline h-3 w-3 mr-1" /> {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <p className="text-xs text-slate-500">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            검토 행 로드 중…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-500">
            아직 파싱된 행이 없습니다. 자료가 업로드된 상태에서 위 &lsquo;AI 파싱 실행&rsquo; 버튼을 누르세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const Icon = ICONS[r.severity];
              return (
                <li
                  key={r.id}
                  className={cn('rounded-xl border p-3 text-xs', TONES[r.severity])}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black uppercase text-[10px] tracking-wide">
                          {r.slot}
                        </span>
                        <span className="text-[10px] opacity-70">Row {r.row_index}</span>
                        {r.entity_label && (
                          <span className="text-[11px] font-bold text-slate-900">
                            {r.entity_label}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">
                        {r.field_name}: <span className="font-normal">{r.message_ko ?? ''}</span>
                      </p>
                      {r.field_value !== null && r.field_value !== '' && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          현재 값: <code className="rounded bg-white/70 px-1">{String(r.field_value)}</code>
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={r.is_resolved ? 'default' : 'outline'}
                      onClick={() => toggleResolved(r.id, r.is_resolved)}
                      disabled={busy}
                    >
                      {r.is_resolved ? '해결됨' : '미해결'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-950">고객 확인요청 메시지</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => buildMessage('ko')} disabled={busy}>
                  <MessageSquare className="h-3 w-3 mr-1" /> 한국어
                </Button>
                <Button size="sm" variant="outline" onClick={() => buildMessage('id')} disabled={busy}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Bahasa
                </Button>
                {message && (
                  <Button size="sm" onClick={copyMessage}>
                    <Copy className="h-3 w-3 mr-1" /> 복사
                  </Button>
                )}
              </div>
            </div>
            {message && (
              <pre className="whitespace-pre-wrap text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 max-h-64 overflow-auto">
                {message}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
