'use client';

/**
 * WHT one-sheet integrated import page.
 *
 * JTC vendor template (21 col) — vendor uploads a month's worth of
 * matched invoices in ONE xlsx. Each row may carry PPh23 / PPh4(2) /
 * PPh26 plus a companion PPN faktur. The system auto-classifies rows,
 * lets the user override per-row in a preview, and bulk-inserts to the
 * existing target tables.
 *
 * 3-step state machine: upload → preview → import.
 */

import { useState, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/layout/PageTitle';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import {
  parseWHTOneSheet,
  type ClassifiedRow,
  type ClassifiedType,
  type WHTParseSummary,
} from '@/lib/tax/bulk-import/wht-onesheet-parser';
import {
  AlertTriangle, CheckCircle2, Loader2, Upload, Download, ArrowLeft, ChevronRight,
} from 'lucide-react';

type Step = 'upload' | 'preview' | 'import';

interface PreviewRow extends ClassifiedRow {
  include: boolean;
  override: ClassifiedType;
}

interface ImportResult {
  insertedPph23: number;
  insertedPph26: number;
  insertedPph42: number;
  insertedPpn: number;
  skipped: number;
  failed: Array<{ rowNo: number; reason: string }>;
}

const TYPE_OPTIONS: ClassifiedType[] = [
  'pph23_jasa', 'pph23_sewa', 'pph4_2_sewa', 'pph26', 'unknown',
];

export default function WhtImportPage() {
  const t = useTranslations('whtImport');
  const tsc = useTranslations('taxScreen');

  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId();

  const [step, setStep] = useState<Step>('upload');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseSummary, setParseSummary] = useState<WHTParseSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------- Upload handler --------
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParseError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const summary = parseWHTOneSheet(buf);
      if (summary.totalRows === 0) {
        setParseError(t('error.noRows'));
        return;
      }
      setParseSummary(summary);
      setPreviewRows(summary.rows.map((r) => ({
        ...r,
        include: r.classified !== 'unknown',
        override: r.classified,
      })));
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'parse failed');
    } finally {
      setBusy(false);
    }
  };

  // -------- Preview override --------
  const toggleInclude = (idx: number) => {
    setPreviewRows((rows) => rows.map((r, i) => (i === idx ? { ...r, include: !r.include } : r)));
  };
  const setOverride = (idx: number, type: ClassifiedType) => {
    setPreviewRows((rows) => rows.map((r, i) => (
      i === idx ? { ...r, override: type, classified: type, include: type !== 'unknown' && r.include }
        : r
    )));
  };

  const stats = useMemo(() => {
    const byType: Record<ClassifiedType, number> = {
      pph23_jasa: 0, pph23_sewa: 0, pph4_2_sewa: 0, pph26: 0, unknown: 0,
    };
    let included = 0;
    let warned = 0;
    let totalWht = 0;
    for (const r of previewRows) {
      byType[r.classified]++;
      if (r.include) included++;
      if (r.warnings.length > 0) warned++;
      totalWht += r.wht.amount;
    }
    return { byType, included, warned, totalWht };
  }, [previewRows]);

  // -------- Import handler --------
  const submitImport = async () => {
    if (!customerId) return;
    setBusy(true);
    setImportResult(null);
    try {
      const payload = previewRows
        .filter((r) => r.include && r.classified !== 'unknown')
        .map((r) => ({
          no: r.no,
          vendor: r.vendor,
          invoice: r.invoice,
          dates: r.dates,
          type: r.type,
          vat: r.vat,
          wht: r.wht,
          materai: r.materai,
          miscFee: r.miscFee,
          vendorPaid: r.vendorPaid,
          notes: r.notes,
          classified: r.classified,
          vatInsert: r.vatInsert,
          expectedRate: r.expectedRate,
          expectedAmount: r.expectedAmount,
          warnings: r.warnings,
          include: true,
        }));

      const res = await fetch('/api/tax/wht-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxPeriod: period, rows: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setImportResult({
          insertedPph23: 0, insertedPph26: 0, insertedPph42: 0, insertedPpn: 0,
          skipped: 0,
          failed: [{ rowNo: 0, reason: data.error || `HTTP ${res.status}` }],
        });
      } else {
        setImportResult(data.data as ImportResult);
      }
      setStep('import');
    } catch (err) {
      setImportResult({
        insertedPph23: 0, insertedPph26: 0, insertedPph42: 0, insertedPpn: 0, skipped: 0,
        failed: [{ rowNo: 0, reason: err instanceof Error ? err.message : 'unknown' }],
      });
      setStep('import');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setPreviewRows([]);
    setParseSummary(null);
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const typeLabel = (t1: ClassifiedType) => t(`type.${t1}`);
  const warningLabel = (w: string) => {
    const map: Record<string, string> = {
      npwpMissing: t('warning.npwpMissing'),
      npwpInvalid: t('warning.npwpInvalid'),
      amountMismatch: t('warning.amountMismatch'),
      dualType: t('warning.dualType'),
      unknownType: t('warning.unknownType'),
    };
    return map[w] || w;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageTitle title={t('pageTitle')} />
      <p className="text-sm text-slate-600 mb-6">{t('pageSubtitle')}</p>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'import'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              step === s ? 'bg-blue-600 text-white' :
                (['upload', 'preview', 'import'].indexOf(step) > i) ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-500'
            }`}>{i + 1}. {t(`step.${s}`)}</span>
            {i < 2 && <ChevronRight className="h-4 w-4 text-slate-400" />}
          </div>
        ))}
      </div>

      {/* Consultant customer picker */}
      {isConsultant && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {tsc('selectCustomer')}
          </label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{tsc('noAssignedCustomers')}</span>
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

      {/* STEP 1 — UPLOAD */}
      {step === 'upload' && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-700">{t('field.period')}</label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Upload className="mx-auto h-10 w-10 text-slate-400" />
              <div className="mt-3 text-sm font-bold text-slate-700">{t('upload.dropzone')}</div>
              <div className="mt-1 text-xs text-slate-500">{t('upload.fileTypes')}</div>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()} disabled={busy || !customerId}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {t('btn.upload')}
                </Button>
                <a href="/templates/wht-onesheet-template-jtc.xlsx" download
                   className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Download className="h-4 w-4" />
                  {t('btn.download')}
                </a>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>

            {!customerId && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {t('msg.selectCustomerFirst')}
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2 — PREVIEW */}
      {step === 'preview' && parseSummary && (
        <div className="space-y-4">
          {/* Stats card */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-800">{previewRows.length}</div>
                  <div className="text-xs text-slate-500">{t('stats.totalRows')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.byType.pph23_jasa}</div>
                  <div className="text-xs text-slate-500">PPh23 Jasa</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-indigo-600">{stats.byType.pph23_sewa}</div>
                  <div className="text-xs text-slate-500">PPh23 Sewa</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats.byType.pph4_2_sewa}</div>
                  <div className="text-xs text-slate-500">PPh4(2)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-rose-600">{stats.byType.pph26}</div>
                  <div className="text-xs text-slate-500">PPh26</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{stats.warned}</div>
                  <div className="text-xs text-slate-500">{t('stats.warnings')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-left">
                    <th className="px-2 py-2 w-8">{t('col.include')}</th>
                    <th className="px-2 py-2 w-10">{t('col.no')}</th>
                    <th className="px-2 py-2">{t('col.vendor')}</th>
                    <th className="px-2 py-2">{t('col.desc')}</th>
                    <th className="px-2 py-2 w-24">{t('col.date')}</th>
                    <th className="px-2 py-2 w-32">{t('col.classified')}</th>
                    <th className="px-2 py-2 text-right w-28">{t('col.whtBase')}</th>
                    <th className="px-2 py-2 text-right w-24">{t('col.whtAmount')}</th>
                    <th className="px-2 py-2 text-right w-28">{t('col.vat')}</th>
                    <th className="px-2 py-2 w-32">{t('col.warnings')}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, idx) => (
                    <tr key={idx} className={`border-b ${r.warnings.length > 0 ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={r.include}
                               onChange={() => toggleInclude(idx)}
                               disabled={r.classified === 'unknown'}
                               className="h-4 w-4" />
                      </td>
                      <td className="px-2 py-1.5">{r.no}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold">{r.vendor.nama}</div>
                        <div className="text-slate-400">{r.vendor.npwp || '—'}</div>
                      </td>
                      <td className="px-2 py-1.5 max-w-xs truncate">{r.invoice.description}</td>
                      <td className="px-2 py-1.5">{r.dates.invoice || r.dates.payment || '—'}</td>
                      <td className="px-2 py-1.5">
                        <select value={r.classified}
                                onChange={(e) => setOverride(idx, e.target.value as ClassifiedType)}
                                className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs">
                          {TYPE_OPTIONS.map((t1) => (
                            <option key={t1} value={t1}>{typeLabel(t1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right">{r.wht.base.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1.5 text-right">{r.wht.amount.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.vatInsert ? (
                          <div>
                            <div>{r.vat.dpp.toLocaleString('id-ID')}</div>
                            <div className="text-slate-400">+{r.vat.ppn.toLocaleString('id-ID')}</div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.warnings.length > 0 ? (
                          <div className="flex items-start gap-1 text-amber-700">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="text-[10px] leading-tight">
                              {r.warnings.map((w) => warningLabel(w)).join('; ')}
                            </span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('btn.back')}
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {t('msg.willImport', { count: stats.included })}
              </span>
              <Button onClick={submitImport} disabled={busy || stats.included === 0 || !customerId}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {t('btn.import')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 — IMPORT RESULT */}
      {step === 'import' && importResult && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              {importResult.failed.length === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              )}
              <div>
                <div className="text-lg font-bold text-slate-800">
                  {importResult.failed.length === 0 ? t('result.allOk') : t('result.partial')}
                </div>
                <div className="text-sm text-slate-500">
                  {t('result.subtitle', { period })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-blue-600">{importResult.insertedPph23}</div>
                  <div className="text-xs text-slate-500">PPh23</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-purple-600">{importResult.insertedPph42}</div>
                  <div className="text-xs text-slate-500">PPh4(2)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-rose-600">{importResult.insertedPph26}</div>
                  <div className="text-xs text-slate-500">PPh26</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-emerald-600">{importResult.insertedPpn}</div>
                  <div className="text-xs text-slate-500">PPN</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-slate-500">{importResult.skipped}</div>
                  <div className="text-xs text-slate-500">{t('result.skipped')}</div>
                </CardContent>
              </Card>
            </div>

            {importResult.failed.length > 0 && (
              <div>
                <div className="text-sm font-bold text-red-700 mb-2">
                  {t('result.failedRows', { count: importResult.failed.length })}
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-100">
                      <tr>
                        <th className="px-3 py-2 text-left w-16">{t('col.no')}</th>
                        <th className="px-3 py-2 text-left">{t('result.reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.failed.map((f, i) => (
                        <tr key={i} className="border-t border-red-200">
                          <td className="px-3 py-2 font-mono">{f.rowNo}</td>
                          <td className="px-3 py-2">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={reset}>{t('btn.restart')}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
