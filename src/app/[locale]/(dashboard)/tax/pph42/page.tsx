'use client';

/**
 * PPh 4(2) — Sewa Tanah & Bangunan / 토지·건물 임대 최종원천세
 *
 * Same `pph23_transaction` table, partial view filtered by tax_regime='PPH4_2'
 * AND tax_rate=0.10. The WHT one-sheet standard template (downloaded here +
 * `/tax/pph23`) hits `/api/tax/wht-import` which auto-routes pph4_2_sewa
 * classifications into this view. Inline edit + delete reuse the same
 * `/api/tax/pph23-transactions` endpoints.
 */

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Receipt, CheckCircle, AlertTriangle, X,
  ChevronDown, ChevronRight, Building2, Download, FileSpreadsheet, Pencil, Shield, Clock,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { PageTitle } from '@/components/layout/PageTitle';
import { parseWHTOneSheet } from '@/lib/tax/bulk-import/wht-onesheet-parser';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';

interface Transaction {
  id: string;
  counterparty_name: string;
  counterparty_npwp: string | null;
  service_type: string;
  description: string | null;
  invoice_number: string | null;
  transaction_date: string;
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  bukti_potong_number: string | null;
  bukti_potong_date: string | null;
  rental_asset_type: string | null;
  invoice_document_id?: string | null;
}

/** PPh4(2) description prefix the WHT importer attaches — strip on display. */
function stripPph42Prefix(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc.startsWith('[PPh4(2)] ') ? desc.slice('[PPh4(2)] '.length) : desc;
}

export default function PPh42Page() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('pph42Page');
  const { session } = useSession();
  const isConsultant = session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';

  const { customerId, customers, selectedCustomerId, setSelectedCustomerId } = useEffectiveCustomerId();

  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastImport, setLastImport] = useState<{
    pph23: number; pph42: number; pph26: number; ppn: number;
    failed: number; period: string; at: number;
  } | null>(null);
  // Submit / filing 상태 — `/tax/pph23` 와 같은 SPT Masa filing 공유 (PPh4(2)
  // 행도 pph23_transaction 같은 테이블이라 한 period 의 PPh23 filing 안에 포함).
  // localStorage 마커는 PPh23 키와 공유해 둘 페이지 어느 쪽에서 요청하든
  // 양쪽 배너 동기화.
  const [saving, setSaving] = useState(false);
  const [submissionRequest, setSubmissionRequest] = useState<{ requestedAt: string } | null>(null);
  const [filingExists, setFilingExists] = useState(false);
  const reqStorageKey = customerId ? `sptRequest:PPh23:${customerId}:${period}` : '';

  const csvInputRef = useRef<HTMLInputElement>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── Load (regime=PPH4_2 filter) ──
  const loadData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/pph23-transactions?customerId=${customerId}&period=${period}&regime=PPH4_2`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data?.transactions || []);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [customerId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // Submit-request + filing 상태 동기화 — `/tax/pph23` 와 동일 로직, 같은
  // localStorage 키 + 같은 `taxType=PPh23` filing 을 조회 + 같은 서버 row.
  // 옵션 B (서버 추적) 우선, localStorage 는 optimistic 보조.
  useEffect(() => {
    if (!customerId) { setSubmissionRequest(null); setFilingExists(false); return; }
    // 1. localStorage (optimistic)
    if (typeof window !== 'undefined' && reqStorageKey) {
      try {
        const raw = window.localStorage.getItem(reqStorageKey);
        if (raw) setSubmissionRequest(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    // 2. 서버 요청 row
    fetch(`/api/customer/spt-masa-request?taxType=PPh23&period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const row = d?.data as { status: 'PENDING' | 'PROCESSED' | 'CANCELLED'; requested_at: string } | null;
        if (row?.status === 'PENDING') {
          setSubmissionRequest({ requestedAt: row.requested_at });
          if (typeof window !== 'undefined' && reqStorageKey) {
            window.localStorage.setItem(reqStorageKey, JSON.stringify({ requestedAt: row.requested_at }));
          }
        } else if (row?.status === 'CANCELLED') {
          if (typeof window !== 'undefined' && reqStorageKey) {
            window.localStorage.removeItem(reqStorageKey);
          }
          setSubmissionRequest(null);
        }
      })
      .catch(() => { /* silent */ });
    // 3. filing 존재
    fetch(`/api/tax/filings?customerId=${customerId}&taxType=PPh23&period=${period}&status=DRAFT`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const filings = d?.data || d?.filings || [];
        const exists = !!filings.find((f: { tax_type: string; tax_period: string }) =>
          f.tax_type === 'PPh23' && f.tax_period === period,
        );
        setFilingExists(exists);
        if (exists && typeof window !== 'undefined' && reqStorageKey) {
          window.localStorage.removeItem(reqStorageKey);
          setSubmissionRequest(null);
        }
      })
      .catch(() => { /* silent */ });
  }, [customerId, period, reqStorageKey]);

  // ── WHT standard template download (same file as /tax/pph23) ──
  const downloadTemplate = async () => {
    try {
      const res = await fetch('/templates/wht-onesheet-template-jtc.xlsx');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wht_onesheet_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMsg('success', t('templateDownloaded'));
    } catch (err) {
      showMsg('error', `${t('templateDownloadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  // ── Upload + auto-split via /api/tax/wht-import ──
  const handleUpload = async (file: File | null) => {
    if (!file || !customerId) return;
    setUploading(true);
    try {
      let summary;
      try {
        const buf = await file.arrayBuffer();
        summary = parseWHTOneSheet(buf);
      } catch (parseErr) {
        showMsg('error', `${t('parseError')}: ${(parseErr as Error).message}`);
        setUploading(false);
        return;
      }

      const rows = summary.rows
        .filter((r) => r.classified !== 'unknown')
        .map((r) => ({ ...r, include: true }));
      if (rows.length === 0) {
        showMsg('error', t('noClassifiedRows'));
        setUploading(false);
        return;
      }

      const res = await fetch('/api/tax/wht-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxPeriod: period, rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showMsg('error', `${t('uploadFailed')} — ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      const d = data.data || {};
      setLastImport({
        pph23: d.insertedPph23 ?? 0,
        pph42: d.insertedPph42 ?? 0,
        pph26: d.insertedPph26 ?? 0,
        ppn: d.insertedPpn ?? 0,
        failed: Array.isArray(d.failed) ? d.failed.length : 0,
        period, at: Date.now(),
      });
      showMsg('success', t('uploadDone', { count: d.insertedPph42 ?? 0 }));
      loadData();
    } catch (err) {
      showMsg('error', `${t('uploadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Inline edit (PUT same endpoint, forwards to operator chat) ──
  const forwardEditToOperator = async (txAfter: Transaction, updates: Record<string, unknown>) => {
    if (isConsultant) return;
    try {
      const tRes = await fetch('/api/customer-ai/threads/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextKind: 'PPH23', contextPeriod: period }),
      });
      if (!tRes.ok) return;
      const threadId = (await tRes.json().catch(() => ({}))).data?.id;
      if (!threadId) return;
      const LABEL: Record<string, string> = {
        transactionDate: '거래일',
        counterpartyName: '거래처명',
        counterpartyNpwp: 'NPWP',
        grossAmount: 'DPP',
        description: '설명',
      };
      const lines: string[] = [];
      for (const [k, v] of Object.entries(updates)) {
        const label = LABEL[k];
        if (!label) continue;
        const display = k === 'grossAmount'
          ? `Rp ${Number(v).toLocaleString('id-ID')}`
          : String(v);
        lines.push(`• ${label}: ${display}`);
      }
      if (lines.length === 0) return;
      const content = [
        `✏️ PPh 4(2) 거래 수정 — ${txAfter.counterparty_name || '(거래처 미상)'} (${period})`,
        ...lines,
      ].join('\n');
      await fetch(`/api/customer-ai/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch { /* silent */ }
  };

  const updateTransaction = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/tax/pph23-transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        const mapped: Record<string, unknown> = {};
        if (updates.grossAmount !== undefined) mapped.gross_amount = Number(updates.grossAmount);
        if (updates.counterpartyName !== undefined) mapped.counterparty_name = updates.counterpartyName as string;
        if (updates.counterpartyNpwp !== undefined) mapped.counterparty_npwp = (updates.counterpartyNpwp as string) || null;
        if (updates.description !== undefined) mapped.description = (updates.description as string) || null;
        if (updates.transactionDate !== undefined) mapped.transaction_date = updates.transactionDate as string;
        const txBefore = transactions.find(t => t.id === id);
        setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...mapped } as Transaction : tx));
        showMsg('success', t('savedToast'));
        if (txBefore) {
          void forwardEditToOperator({ ...txBefore, ...mapped } as Transaction, updates);
        }
        if (updates.grossAmount !== undefined) loadData();
      } else {
        showMsg('error', t('saveFailed'));
      }
    } catch {
      showMsg('error', t('saveFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const res = await fetch(`/api/tax/pph23-transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions(prev => prev.filter(tx => tx.id !== id));
        showMsg('success', t('deletedToast'));
      } else {
        showMsg('error', t('deleteFailed'));
      }
    } catch {
      showMsg('error', t('deleteFailed'));
    }
  };

  const totalGross = transactions.reduce((s, tx) => s + Number(tx.gross_amount), 0);
  const totalTax = transactions.reduce((s, tx) => s + Number(tx.tax_amount), 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageTitle title="PPh 4(2)" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('pageTitle')}</h1>
        </div>
        <p className="text-sm text-gray-500">{t('pageSubtitle')}</p>
      </div>

      {/* Consultant customer picker */}
      {isConsultant && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('selectCustomer')}</label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{t('noCustomers')}</span>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name || c.full_name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* SPT Masa 제출 상태 배너 — CUSTOMER 만, /tax/pph23 와 같은 filing 공유 */}
      {!isConsultant && customerId && (
        <>
          {filingExists ? (
            <Card className="mb-4 border-emerald-300 bg-emerald-50">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900">SPT Masa 제출 완료 — {period}</p>
                  <p className="text-[11px] text-emerald-700">PPh 23 + PPh 4(2) 가 한 SPT Masa 안에 포함됐습니다.</p>
                </div>
              </CardContent>
            </Card>
          ) : submissionRequest ? (
            <Card className="mb-4 border-amber-300 bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-semibold text-amber-900">운영팀 검토 중 — {period}</p>
                  <p className="text-[11px] text-amber-700">
                    요청 시간: {new Date(submissionRequest.requestedAt).toLocaleString()} · 운영팀이 검토 후 SPT Masa 를 생성합니다.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700 hover:text-amber-900 text-[11px]"
                  onClick={() => {
                    if (typeof window !== 'undefined' && reqStorageKey) {
                      window.localStorage.removeItem(reqStorageKey);
                    }
                    setSubmissionRequest(null);
                    void fetch(`/api/customer/spt-masa-request?taxType=PPh23&period=${period}`, {
                      method: 'DELETE',
                    }).catch(() => { /* silent */ });
                  }}
                >
                  요청 취소
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Period + summary */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="period" className="text-xs font-bold uppercase text-slate-500">{t('period')}</Label>
              <Input
                id="period"
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="flex gap-6 text-xs">
              <div>
                <p className="text-gray-500">{t('totalDpp')}</p>
                <p className="font-mono font-bold">{fmtRp(totalGross)}</p>
              </div>
              <div>
                <p className="text-purple-700">{t('totalTax')} (10%)</p>
                <p className="font-mono font-bold text-purple-700">{fmtRp(totalTax)}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('count')}</p>
                <p className="font-bold">{transactions.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message banner */}
      {message && (
        <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Last import result panel */}
      {lastImport && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm text-emerald-900">
                    {t('importDone')} — {lastImport.period}
                  </h3>
                  <span className="text-[10px] text-emerald-700">{new Date(lastImport.at).toLocaleTimeString()}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <a href={`/${locale}/tax/pph23`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPh 23</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.pph23}</p>
                  </a>
                  <a href={`/${locale}/tax/pph42`} className="rounded border-2 border-purple-400 bg-white px-3 py-2">
                    <p className="text-[10px] text-purple-700 font-bold">PPh 4(2) ← 여기</p>
                    <p className="font-mono font-bold text-purple-700">{lastImport.pph42}</p>
                  </a>
                  <a href={`/${locale}/tax/pph26`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPh 26</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.pph26}</p>
                  </a>
                  <a href={`/${locale}/tax/ppn`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPN MASUKAN</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.ppn}</p>
                  </a>
                </div>
                {lastImport.failed > 0 && (
                  <p className="mt-2 text-[11px] text-red-600">
                    ⚠ {t('failedRows', { count: lastImport.failed })}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-900" onClick={() => setLastImport(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload card */}
      <Card className="mb-4 border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{t('uploadCardTitle')}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('uploadCardDesc')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { void downloadTemplate(); }}>
              <Download className="h-3 w-3 mr-1" />{t('downloadTemplate')}
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => csvInputRef.current?.click()}
              disabled={uploading || !customerId}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileSpreadsheet className="h-3 w-3 mr-1" />}
              {t('uploadButton')}
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              className="hidden"
              accept=".csv,text/csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-3 flex items-center gap-1">
            <Shield className="h-3 w-3 text-purple-500" />
            {t('uploadHint')}
          </p>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {t('listTitle')} ({transactions.length})
            </h3>
          </div>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              {t('emptyState')}
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">No</th>
                    <th className="p-2 text-left">{t('colDate')}</th>
                    <th className="p-2 text-left">{t('colCounterparty')}</th>
                    <th className="p-2 text-left">NPWP</th>
                    <th className="p-2 text-left">{t('colDescription')}</th>
                    <th className="p-2 text-right">{t('colDpp')}</th>
                    <th className="p-2 text-right">{t('colRate')}</th>
                    <th className="p-2 text-right">{t('colTax')}</th>
                    <th className="p-2 text-center">{t('colDetail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => {
                    const isExpanded = expandedTx === tx.id;
                    const cleanDesc = stripPph42Prefix(tx.description);
                    return (
                      <Fragment key={tx.id}>
                        <tr className={`border-t ${isExpanded ? 'bg-purple-50/40' : ''}`}>
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2 font-mono text-xs">{tx.transaction_date}</td>
                          <td className="p-2">
                            <div className="font-medium text-xs">{tx.counterparty_name}</div>
                          </td>
                          <td className="p-2 font-mono text-[11px]">{tx.counterparty_npwp || <span className="text-gray-400">—</span>}</td>
                          <td className="p-2 text-xs text-gray-700 truncate max-w-[200px]">{cleanDesc || '—'}</td>
                          <td className="p-2 text-right font-mono text-xs">{fmtRp(tx.gross_amount)}</td>
                          <td className="p-2 text-right font-mono text-xs text-purple-700 font-bold">{(tx.tax_rate * 100).toFixed(1)}%</td>
                          <td className="p-2 text-right font-mono text-xs text-purple-700 font-bold">{fmtRp(tx.tax_amount)}</td>
                          <td className="p-2 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <span className="ml-0.5">{t('colDetail')}</span>
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/60 border-t">
                            <td colSpan={9} className="p-3">
                              <div className="rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-[11px] text-purple-900 flex items-center gap-2 mb-3">
                                <Pencil className="h-3.5 w-3.5 shrink-0" />
                                <span>{t('editBanner')}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('colDate')}</Label>
                                  <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    defaultValue={tx.transaction_date}
                                    onBlur={e => {
                                      if (e.target.value && e.target.value !== tx.transaction_date) {
                                        updateTransaction(tx.id, { transactionDate: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('colCounterparty')}</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    defaultValue={tx.counterparty_name ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.counterparty_name ?? '')) {
                                        updateTransaction(tx.id, { counterpartyName: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">NPWP</Label>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    defaultValue={tx.counterparty_npwp ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.counterparty_npwp ?? '')) {
                                        updateTransaction(tx.id, { counterpartyNpwp: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('colDpp')}</Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs font-mono"
                                    defaultValue={tx.gross_amount}
                                    onBlur={e => {
                                      const newVal = Number(e.target.value);
                                      if (Number.isFinite(newVal) && newVal !== tx.gross_amount) {
                                        updateTransaction(tx.id, {
                                          grossAmount: newVal,
                                          serviceType: 'SEWA',
                                          counterpartyNpwp: tx.counterparty_npwp ?? '',
                                        });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-[10px] text-gray-400">{t('colDescription')}</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    defaultValue={cleanDesc}
                                    onBlur={e => {
                                      const newVal = e.target.value;
                                      if (newVal !== cleanDesc) {
                                        // Restore prefix so the WHT importer round-trip stays stable.
                                        updateTransaction(tx.id, { description: newVal ? `[PPh4(2)] ${newVal}` : '' });
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-3 border-t border-gray-200 mt-3">
                                <div>
                                  <p className="text-gray-500">{t('infoRate')}</p>
                                  <p className="font-bold text-purple-700">{(tx.tax_rate * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">{t('infoTax')}</p>
                                  <p className="font-mono font-bold text-purple-700">{fmtRp(tx.tax_amount)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">{t('infoAsset')}</p>
                                  <p>{tx.rental_asset_type || 'BUILDING_LAND'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">e-Bupot</p>
                                  <p className="font-mono">{tx.bukti_potong_number || '—'}</p>
                                </div>
                              </div>
                              <div className="bg-indigo-50 rounded p-2 text-xs flex items-start gap-2 mt-3">
                                <Shield className="h-3 w-3 text-indigo-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium text-indigo-900">{t('legalTitle')}</p>
                                  <p className="text-indigo-700">{t('legalBody')}</p>
                                  <p className="text-indigo-500 text-[10px]">PMK 34/PMK.03/2017 — PPh 4 ayat 2 atas sewa tanah & bangunan</p>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2 mt-2">
                                <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => handleDelete(tx.id)}>
                                  <X className="h-3 w-3 mr-1" />{t('deleteButton')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {transactions.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('hintRateNotice')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom submit action — CUSTOMER 는 운영팀 요청, CONSULTANT 는 직접 생성 */}
      {transactions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              if (!customerId) return;
              setSaving(true);
              try {
                if (!isConsultant) {
                  // CUSTOMER: chat 요청 (PPh23 thread 공유)
                  const totalGross = transactions.reduce((s, tx) => s + Number(tx.gross_amount), 0);
                  const totalTax = transactions.reduce((s, tx) => s + Number(tx.tax_amount), 0);
                  const tRes = await fetch('/api/customer-ai/threads/find-or-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contextKind: 'PPH23', contextPeriod: period }),
                  });
                  const tj = await tRes.json().catch(() => ({}));
                  const threadId = tj.data?.id;
                  if (!threadId) { showMsg('error', t('saveFailed')); return; }
                  const content = [
                    `📨 SPT Masa PPh 4(2) 제출 요청 — ${period}`,
                    `• 거래 ${transactions.length} 건 (토지·건물 임대)`,
                    `• 총 DPP: Rp ${totalGross.toLocaleString('id-ID')}`,
                    `• 총 PPh 4(2): Rp ${totalTax.toLocaleString('id-ID')}`,
                    `→ 검토 후 SPT Masa 생성 부탁드립니다.`,
                  ].join('\n');
                  const mRes = await fetch(`/api/customer-ai/threads/${threadId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }),
                  });
                  if (mRes.ok) {
                    showMsg('success', `운영팀에 SPT Masa 제출 요청을 전달했습니다 — ${transactions.length} 건`);
                    const stamp = { requestedAt: new Date().toISOString() };
                    if (typeof window !== 'undefined' && reqStorageKey) {
                      try { window.localStorage.setItem(reqStorageKey, JSON.stringify(stamp)); } catch { /* quota */ }
                    }
                    setSubmissionRequest(stamp);
                    // 서버 추적 row upsert — 다기기 동기화.
                    void fetch('/api/customer/spt-masa-request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ taxType: 'PPh23', period, threadId }),
                    }).catch(() => { /* silent */ });
                  } else {
                    showMsg('error', t('saveFailed'));
                  }
                  return;
                }
                // CONSULTANT: 기존 직접 생성. PPh4(2) 도 PPh23 SPT Masa 하나에 포함.
                const res = await fetch('/api/tax/spt-masa', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ customerId, taxType: 'PPh23', period }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success === true) {
                  showMsg('success', `SPT Masa 생성 완료 (filing ${data.filingId?.slice(0, 8) ?? ''})`);
                  loadData();
                } else {
                  showMsg('error', data.message || data.error || `HTTP ${res.status}`);
                }
              } catch (err) {
                showMsg('error', err instanceof Error ? err.message : t('saveFailed'));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            {isConsultant ? 'SPT Masa 생성' : '운영팀에 SPT Masa 제출 요청'}
          </Button>
        </div>
      )}
    </div>
  );
}
