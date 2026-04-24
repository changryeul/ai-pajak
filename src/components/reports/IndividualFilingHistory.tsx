'use client';

/**
 * IndividualFilingHistory — 5-year accordion of annual SPT filings.
 *
 * Keynote slide-19/20:
 *   - 각 연도마다 SPT / BPE / A1 / 재무제표 행이 항상 표시되어야 함
 *   - 비어있는 슬롯은 고객이 직접 업로드할 수 있는 버튼으로 제공
 *     (BPE는 DJP 이메일로 수신하므로 고객이 업로드하는 유일한 경로)
 *   - 업로드된 파일은 미리보기/다운로드 버튼으로 접근
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, Eye, Loader2, Upload, CheckCircle, AlertTriangle } from 'lucide-react';

type DocType = 'SPT' | 'BPE' | 'A1' | '재무제표';

interface DocSlot {
  type: DocType;
  name: string;
  path: string | null;
  taxDocumentId?: string | null;
  number?: string | null;
}

interface YearEntry {
  year: number;
  filingId: string;
  filingType: string;
  submittedAt: string | null;
  status: string;
  documents: DocSlot[];
}

function statusBadge(t: (k: string) => string, status: string) {
  if (status === 'COMPLETED' || status === 'SUBMITTED') {
    return { text: t('statusCompleted'), cls: 'bg-emerald-100 text-emerald-700' };
  }
  if (status === 'UNDER_REVIEW' || status === 'PENDING_APPROVAL') {
    return { text: t('statusInProgress'), cls: 'bg-blue-100 text-blue-700' };
  }
  if (status === 'DRAFT') {
    return { text: t('statusDraft'), cls: 'bg-amber-100 text-amber-700' };
  }
  return { text: t('statusNone'), cls: 'bg-gray-100 text-gray-500' };
}

function docStatusLabel(
  t: (k: string) => string,
  type: DocType,
  hasFile: boolean,
): string {
  if (!hasFile) return t('docStatusMissing');
  if (type === 'SPT') return t('docStatusSubmitted');
  if (type === 'BPE') return t('docStatusIssued');
  return t('docStatusAvailable');
}

export default function IndividualFilingHistory() {
  const t = useTranslations('filingHistory');
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<YearEntry[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Per-filing BPE number input (optional — customer may only paste the file).
  const [bpeNumberInput, setBpeNumberInput] = useState<Record<string, string>>({});

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/filing-history', { credentials: 'include' });
      const data = await res.json();
      if (data?.success) {
        setYears(data.data.years as YearEntry[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = useCallback(
    async (
      filingId: string,
      slot: DocSlot,
      file: File,
      uploadKey: string,
    ) => {
      setUploadingKey(uploadKey);
      try {
        if (slot.type === 'BPE') {
          const fd = new FormData();
          fd.append('filingId', filingId);
          fd.append('file', file);
          const bpeNum = bpeNumberInput[filingId]?.trim();
          if (bpeNum) fd.append('bpeNumber', bpeNum);
          const res = await fetch('/api/customer/filing-bpe-upload', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || t('uploadFailed'));
          showMsg('success', t('uploadSuccess'));
          setBpeNumberInput((prev) => {
            const next = { ...prev };
            delete next[filingId];
            return next;
          });
        } else {
          // A1 or 재무제표 — use existing generic document upload tied to filing.
          const fd = new FormData();
          fd.append('file', file);
          fd.append('documentType',
            slot.type === 'A1' ? 'FORM_1721_A1' : 'FINANCIAL_STATEMENT',
          );
          fd.append('taxFilingId', filingId);
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || t('uploadFailed'));
          showMsg('success', t('uploadSuccess'));
        }
        await load();
      } catch (e) {
        showMsg('error', e instanceof Error ? e.message : t('uploadFailed'));
      } finally {
        setUploadingKey(null);
      }
    },
    [load, t, bpeNumberInput],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('pageSubtitle')}</p>
      </header>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {years.map((y) => {
          const badge = statusBadge(t, y.status);
          const hasFiling = y.status !== 'NONE';
          return (
            <Card key={y.year} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {t('yearHeader', { year: y.year })}
                    </p>
                    {hasFiling ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('yearMeta', {
                          type: y.filingType,
                          date: y.submittedAt
                            ? new Date(y.submittedAt).toISOString().slice(0, 10)
                            : '-',
                          status: badge.text,
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">{t('noFilingForYear')}</p>
                    )}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                {hasFiling && y.documents.length > 0 && (
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[90px_1fr_120px_auto] gap-2 px-4 py-2 bg-gray-50 text-[11px] font-semibold text-gray-600 uppercase">
                      <span>{t('colType')}</span>
                      <span>{t('colName')}</span>
                      <span>{t('colStatus')}</span>
                      <span className="text-right">{t('colAction')}</span>
                    </div>
                    {y.documents.map((d, i) => {
                      const hasFile = !!d.path;
                      const uploadKey = `${y.filingId}:${d.type}:${i}`;
                      const isUploading = uploadingKey === uploadKey;

                      return (
                        <div
                          key={uploadKey}
                          className="grid grid-cols-[90px_1fr_120px_auto] gap-2 px-4 py-3 items-center text-sm border-t"
                        >
                          <span className="text-xs font-semibold text-gray-700">{d.type}</span>
                          <span className="truncate text-gray-800 flex items-center gap-1.5">
                            <FileText
                              className={
                                hasFile
                                  ? 'h-3.5 w-3.5 text-gray-400 shrink-0'
                                  : 'h-3.5 w-3.5 text-gray-300 shrink-0'
                              }
                            />
                            <span className={hasFile ? '' : 'text-gray-400'}>{d.name}</span>
                            {d.number && (
                              <span className="text-[10px] text-gray-400 font-mono ml-1">
                                #{d.number}
                              </span>
                            )}
                            {/* BPE number inline input when missing */}
                            {d.type === 'BPE' && !hasFile && (
                              <Input
                                className="h-6 text-[11px] font-mono w-28 ml-1"
                                placeholder={t('bpeNumberPlaceholder')}
                                maxLength={50}
                                value={bpeNumberInput[y.filingId] || ''}
                                onChange={(e) =>
                                  setBpeNumberInput((prev) => ({
                                    ...prev,
                                    [y.filingId]: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {docStatusLabel(t, d.type, hasFile)}
                          </span>
                          <div className="flex gap-1 justify-end">
                            {hasFile ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => window.open(d.path!, '_blank')}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  {t('actionPreview')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = d.path!;
                                    a.download = d.name;
                                    a.click();
                                  }}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  {t('actionDownload')}
                                </Button>
                              </>
                            ) : d.type === 'SPT' ? (
                              // SPT is generated server-side; show placeholder only.
                              <span className="text-[11px] text-gray-400">—</span>
                            ) : (
                              <label className="inline-flex items-center gap-1 h-7 px-2 text-[11px] rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
                                {isUploading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                                {t('actionUpload')}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="application/pdf,image/*"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUpload(y.filingId, d, f, uploadKey);
                                    e.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
