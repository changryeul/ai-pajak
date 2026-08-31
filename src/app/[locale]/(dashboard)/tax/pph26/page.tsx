'use client';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { importPph26WholesaleFile } from '@/lib/tax/bulk-import/pph26-wholesale-importer';

/**
 * PPh26 page — placeholder UI for single-entry / treaty flow, plus a
 * working wholesale (bulk import) card so users can ingest their existing
 * ledger without waiting for the full single-entry UI. Mirrors the
 * "Method 2: Upload" card on the PPh23 page.
 */
export default function Pph26Page() {
  const t = useTranslations('pph26Page');
  const { customerId } = useEffectiveCustomerId();
  const wholesaleInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    if (type === 'success') {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleWholesaleUpload = async (file: File | null) => {
    if (!file) return;
    if (!customerId) {
      showMsg('error', t('customerNotSelected'));
      return;
    }
    setUploading(true);
    try {
      let summary: Awaited<ReturnType<typeof importPph26WholesaleFile>>;
      try {
        summary = await importPph26WholesaleFile(file);
      } catch (parseErr) {
        showMsg('error', t('parseFailed', { msg: (parseErr as Error).message }));
        return;
      }
      if (summary.imported === 0) {
        showMsg(
          'error',
          t('zeroRowsImported', {
            nonType: summary.skippedByTaxType,
            invalid: summary.skippedByValidation,
          }),
        );
        return;
      }
      const res = await fetch('/api/tax/pph26-transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxPeriod: period, csvContent: summary.csvContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showMsg('error', t('importFailed', { error: data.error || `HTTP ${res.status}` }));
        return;
      }
      const inserted = data.data?.insertedCount ?? 0;
      const total = data.data?.totalRows ?? 0;
      const skipNote =
        summary.skippedByTaxType > 0 ? t('skipNote', { count: summary.skippedByTaxType }) : '';
      showMsg('success', t('importSuccess', { inserted, total, skipNote }));
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <PageTitle title="PPh 26" />
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <Card className="border-amber-200 bg-amber-50 mb-4">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-amber-900">{t('preparing')}</p>
          <p className="text-sm text-amber-700 mt-2">{t('description')}</p>
        </CardContent>
      </Card>

      {/* Wholesale upload — bulk import card (mirrors PPh23 Method 2) */}
      <Card className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all relative">
        <div className="absolute -top-2 left-5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
          BETA
        </div>
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">{t('wholesaleUploadTitle')}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {t('wholesaleUploadDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-medium text-gray-700">{t('taxPeriodLabel')}</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
              disabled={uploading}
            />
          </div>

          <input
            ref={wholesaleInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleWholesaleUpload(f);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => wholesaleInputRef.current?.click()}
            disabled={uploading || !customerId}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <FileSpreadsheet className="h-3 w-3 mr-1" />
            )}
            {t('bulkUploadButton')}
          </Button>

          <p className="text-[10px] text-gray-500 mt-2 font-mono">
            {t('flatRateNote')}
          </p>

          {message && (
            <div
              className={`mt-3 p-2 rounded text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
