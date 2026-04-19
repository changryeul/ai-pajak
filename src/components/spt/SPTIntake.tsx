'use client';

/**
 * SPT Tahunan intake — customer-facing simplified flow.
 *
 * Supports three forms with small per-form differences:
 *
 *   1770SS (simple employee): KK + 1721-A1 + foreign tax credit
 *   1770S  (mixed income):    KK + 1721-A1 + PPh 23 credit + foreign tax credit
 *   1770   (business/freelance): KK + business-income docs (no tax credit UI)
 *
 * The rest — Harta (assets) and Utang (liabilities) — is identical per the
 * Coretax intake template. Submit creates a tax_filing in UNDER_REVIEW
 * with consultant_id = null so JTC picks it up from the operator queue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, CheckCircle, Loader2, AlertTriangle, Upload, Camera, FolderOpen,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SPTForm = '1770SS' | '1770S' | '1770';

interface Props {
  form: SPTForm;
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  taxYear?: number;
}

type Currency = 'IDR' | 'USD' | 'KRW' | 'JPY' | 'SGD' | 'EUR';

interface BankAccountRow {
  bankName: string;
  accountNumber: string;
  currency: Currency;
  balance: string;
}

interface UploadedDoc {
  documentId: string;
  fileName: string;
}

// The right card's upload kind varies: A1 for 1770SS/S, business docs for 1770.
type UploadKind = 'KK' | 'INCOME' | 'FOREIGN_TAX';

function documentTypeFor(kind: UploadKind, form: SPTForm): string {
  if (kind === 'KK') return 'FAMILY_CARD';
  if (kind === 'FOREIGN_TAX') return 'FOREIGN_TAX_RECEIPT';
  // kind === 'INCOME'
  return form === '1770' ? 'FORM_1770' : 'FORM_1721_A1';
}

export function SPTIntake({
  form,
  customerId,
  customerName,
  customerNpwp,
  taxYear,
}: Props) {
  const showTaxCredit = form !== '1770';
  const showPph23Credit = form === '1770S';
  const incomeCardTitleKey =
    form === '1770' ? 'businessIncomeTitle' : 'employmentIncomeTitle';
  const headerKey =
    form === '1770SS' ? 'headerTitle'
    : form === '1770S' ? 'headerTitleS'
    : 'headerTitleFull';
  const t = useTranslations('sptIntake');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'id';
  const year = taxYear ?? new Date().getFullYear() - 1;

  // Upload state
  const [kkDoc, setKkDoc] = useState<UploadedDoc | null>(null);
  const [incomeDoc, setIncomeDoc] = useState<UploadedDoc | null>(null);
  const [foreignTaxDoc, setForeignTaxDoc] = useState<UploadedDoc | null>(null);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Income (gross) — populated by OCR or operator later; user can also type
  // directly. Stored under tax_data.incomeSummary.gross so the dashboard
  // trend chart can compute year-over-year deltas.
  const [grossIncome, setGrossIncome] = useState('');

  // Tax credit
  const [pph23Amount, setPph23Amount] = useState('');
  const [foreignTaxAmount, setForeignTaxAmount] = useState('');

  // Assets
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([
    { bankName: '', accountNumber: '', currency: 'IDR', balance: '' },
  ]);
  const [stocks, setStocks] = useState('');
  const [realEstate, setRealEstate] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [businessAssets, setBusinessAssets] = useState('');
  const [otherAssets, setOtherAssets] = useState('');

  // Liabilities
  const [bankLoan, setBankLoan] = useState('');
  const [creditCard, setCreditCard] = useState('');
  const [personalLoan, setPersonalLoan] = useState('');
  const [businessDebt, setBusinessDebt] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Draft autosave — debounced PATCH to /api/tax/filings in DRAFT status
  type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSentRef = useRef(false);

  // Hidden file inputs
  const kkInputRef = useRef<HTMLInputElement>(null);
  const kkCaptureRef = useRef<HTMLInputElement>(null);
  const incomeInputRef = useRef<HTMLInputElement>(null);
  const incomeCaptureRef = useRef<HTMLInputElement>(null);
  const foreignTaxInputRef = useRef<HTMLInputElement>(null);

  const uploadDoc = useCallback(
    async (file: File, kind: UploadKind) => {
      setUploading(kind);
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', 'tax-documents');
        fd.append('documentType', documentTypeFor(kind, form));
        fd.append('customerId', customerId);
        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || t('uploadFailed'));
        const doc: UploadedDoc = { documentId: data.data.id, fileName: file.name };
        if (kind === 'KK') setKkDoc(doc);
        else if (kind === 'INCOME') setIncomeDoc(doc);
        else setForeignTaxDoc(doc);

        // OCR auto-prefill for 1721-A1 uploads on 1770SS/S. Fire-and-forget
        // — the user can still edit the field if the OCR pick is wrong.
        if (kind === 'INCOME' && form !== '1770') {
          const ocrForm = new FormData();
          ocrForm.append('file', file);
          ocrForm.append('expectedCategory', 'BUKTI_POTONG');
          fetch('/api/documents/ocr-extract', { method: 'POST', body: ocrForm })
            .then((r) => (r.ok ? r.json() : null))
            .then((ocr) => {
              if (!ocr || ocr.status !== 'COMPLETED') return;
              const extracted = (ocr.extractedData || {}) as Record<string, unknown>;
              const gross = Number(extracted.grossAmount);
              if (Number.isFinite(gross) && gross > 0) {
                setGrossIncome((prev) => (prev ? prev : String(Math.round(gross))));
              }
              const withheld = Number(extracted.taxAmount);
              if (Number.isFinite(withheld) && withheld > 0) {
                setPph23Amount((prev) => (prev ? prev : String(Math.round(withheld))));
              }
            })
            .catch(() => { /* non-fatal */ });
        }
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : t('uploadFailed'));
      } finally {
        setUploading(null);
      }
    },
    [customerId, t, form],
  );

  const [importResult, setImportResult] = useState<string | null>(null);

  const importFromProfile = useCallback(async () => {
    setImportResult(null);
    try {
      const res = await fetch('/api/customer/bank-accounts', { credentials: 'include' });
      if (!res.ok) {
        setImportResult(t('importNone'));
        return;
      }
      const json = await res.json();
      const rows: Array<{
        bank_name?: string;
        account_last4?: string;
        currency?: string;
      }> = json?.data || json?.accounts || [];
      if (!rows.length) {
        setImportResult(t('importNone'));
        return;
      }
      // Only replace when the existing rows are blank placeholders — we
      // don't want to overwrite manual entry the user just typed.
      const isBlank = bankAccounts.every(
        (r) => !r.bankName && !r.accountNumber && !r.balance,
      );
      if (!isBlank) {
        setImportResult(t('importSkippedExisting'));
        return;
      }
      setBankAccounts(
        rows.map((r) => ({
          bankName: r.bank_name || '',
          accountNumber: r.account_last4 ? `****${r.account_last4}` : '',
          currency: ((r.currency as Currency) || 'IDR'),
          balance: '',
        })),
      );
      setImportResult(t('importDone', { count: rows.length }));
    } catch {
      setImportResult(t('importFailed'));
    } finally {
      setTimeout(() => setImportResult(null), 4000);
    }
  }, [bankAccounts, t]);

  // Draft payload — same shape as the submit payload but with status DRAFT.
  // `/api/tax/filings` POST upserts by (customer, type, period, status=DRAFT),
  // so every autosave re-hits the same row.
  const draftBody = useMemo(() => {
    const toNum = (s: string) => {
      const n = Number(s.replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    return {
      customerId,
      taxType: 'SPT_TAHUNAN' as const,
      taxPeriod: String(year),
      taxYear: year,
      status: 'DRAFT' as const,
      taxData: {
        form,
        intake: true,
        draft: true,
        documents: {
          kk: kkDoc?.documentId || null,
          [form === '1770' ? 'businessIncome' : 'a1']: incomeDoc?.documentId || null,
          foreignTaxReceipt: foreignTaxDoc?.documentId || null,
        },
        grossIncome: toNum(grossIncome),
        incomeSummary: { gross: toNum(grossIncome), taxable: toNum(grossIncome) },
        ...(showTaxCredit && { foreignTaxCredit: toNum(foreignTaxAmount) }),
        ...(showPph23Credit && { pph23Credit: toNum(pph23Amount) }),
        harta: {
          bankAccounts: bankAccounts
            .filter((r) => r.bankName || r.accountNumber || r.balance)
            .map((r) => ({
              bankName: r.bankName,
              accountNumber: r.accountNumber,
              currency: r.currency,
              balance: toNum(r.balance),
            })),
          stocks: toNum(stocks),
          realEstate: toNum(realEstate),
          vehicle: toNum(vehicle),
          businessAssets: toNum(businessAssets),
          otherAssets: toNum(otherAssets),
        },
        utang: {
          bankLoan: toNum(bankLoan),
          creditCard: toNum(creditCard),
          personalLoan: toNum(personalLoan),
          businessDebt: toNum(businessDebt),
        },
      },
    };
  }, [
    customerId, year, form, showTaxCredit, showPph23Credit,
    kkDoc, incomeDoc, foreignTaxDoc, grossIncome, foreignTaxAmount, pph23Amount,
    bankAccounts, stocks, realEstate, vehicle, businessAssets, otherAssets,
    bankLoan, creditCard, personalLoan, businessDebt,
  ]);

  const isBlankDraft = useMemo(() => {
    const h = draftBody.taxData.harta;
    const u = draftBody.taxData.utang;
    return (
      !draftBody.taxData.grossIncome &&
      !draftBody.taxData.documents.kk &&
      !draftBody.taxData.documents[form === '1770' ? 'businessIncome' : 'a1'] &&
      !h.bankAccounts.length && !h.stocks && !h.realEstate && !h.vehicle &&
      !h.businessAssets && !h.otherAssets &&
      !u.bankLoan && !u.creditCard && !u.personalLoan && !u.businessDebt
    );
  }, [draftBody, form]);

  // Debounced draft autosave — 1.5s after the last edit. Skips when the form
  // is blank (so we don't create empty DRAFT rows on initial mount) and
  // stops once the user has clicked Submit (submitOk = true).
  useEffect(() => {
    if (submitOk || isBlankDraft) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      setDraftStatus('saving');
      try {
        const res = await fetch('/api/tax/filings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(draftBody),
        });
        if (!res.ok) throw new Error('draft_failed');
        draftSentRef.current = true;
        setDraftStatus('saved');
        setTimeout(() => setDraftStatus('idle'), 1500);
      } catch {
        setDraftStatus('error');
      }
    }, 1500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [draftBody, submitOk, isBlankDraft]);

  const addBankAccount = () =>
    setBankAccounts((rows) => [...rows, { bankName: '', accountNumber: '', currency: 'IDR', balance: '' }]);
  const removeBankAccount = (idx: number) =>
    setBankAccounts((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));
  const updateBankAccount = (idx: number, patch: Partial<BankAccountRow>) =>
    setBankAccounts((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    if (!kkDoc && !incomeDoc) {
      setSubmitError(t('needKKOrA1'));
      return;
    }
    setSubmitting(true);
    try {
      const documentIds = [kkDoc, incomeDoc, foreignTaxDoc]
        .filter((d): d is UploadedDoc => Boolean(d))
        .map((d) => d.documentId);

      const toNum = (s: string) => {
        const n = Number(s.replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };

      const payload = {
        customerId,
        taxType: 'SPT_TAHUNAN' as const,
        taxPeriod: String(year),
        taxYear: year,
        status: 'UNDER_REVIEW' as const,
        taxData: {
          form,
          intake: true,
          requestedProcessing: 'JTC',
          documents: {
            kk: kkDoc?.documentId || null,
            [form === '1770' ? 'businessIncome' : 'a1']: incomeDoc?.documentId || null,
            foreignTaxReceipt: foreignTaxDoc?.documentId || null,
          },
          // Flat grossIncome alias is what /api/tax/filings already maps to
          // `totalIncome` on the filings list, and incomeSummary.gross is
          // what trend-from-filings reads for year-over-year deltas.
          grossIncome: toNum(grossIncome),
          incomeSummary: {
            gross: toNum(grossIncome),
            taxable: toNum(grossIncome),
          },
          ...(showTaxCredit && {
            foreignTaxCredit: toNum(foreignTaxAmount),
          }),
          ...(showPph23Credit && {
            pph23Credit: toNum(pph23Amount),
          }),
          harta: {
            bankAccounts: bankAccounts
              .filter((r) => r.bankName || r.accountNumber || r.balance)
              .map((r) => ({
                bankName: r.bankName,
                accountNumber: r.accountNumber,
                currency: r.currency,
                balance: toNum(r.balance),
              })),
            stocks: toNum(stocks),
            realEstate: toNum(realEstate),
            vehicle: toNum(vehicle),
            businessAssets: toNum(businessAssets),
            otherAssets: toNum(otherAssets),
          },
          utang: {
            bankLoan: toNum(bankLoan),
            creditCard: toNum(creditCard),
            personalLoan: toNum(personalLoan),
            businessDebt: toNum(businessDebt),
          },
        },
        documentIds,
      };

      const res = await fetch('/api/tax/filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('submitError'));
      setSubmitOk(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('submitError'));
    } finally {
      setSubmitting(false);
    }
  }, [
    kkDoc, incomeDoc, foreignTaxDoc, foreignTaxAmount, pph23Amount, grossIncome,
    bankAccounts,
    stocks, realEstate, vehicle, businessAssets, otherAssets,
    bankLoan, creditCard, personalLoan, businessDebt,
    customerId, year, t, form, showTaxCredit, showPph23Credit,
  ]);

  if (submitOk) {
    return (
      <Card className="max-w-2xl mx-auto mt-12 border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">{t('submitSuccess')}</p>
          <p className="text-sm text-gray-500 mt-2">JTC · Tax Year {year}</p>
          <Button className="mt-6" onClick={() => router.push(`/${locale}/dashboard`)}>
            {t('back')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{t(headerKey)}</h1>
          {draftStatus !== 'idle' && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                draftStatus === 'saving'
                  ? 'bg-gray-100 text-gray-600'
                  : draftStatus === 'saved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              {draftStatus === 'saving'
                ? t('draftSaving')
                : draftStatus === 'saved'
                ? t('draftSaved')
                : t('draftError')}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/tax/spt-tahunan`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Link>
        </Button>
      </div>

      {/* Customer banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900 flex items-center justify-between">
        <div>
          <span className="font-semibold">{customerName}</span>
          {customerNpwp && <span className="text-blue-700 ml-2">NPWP: {customerNpwp}</span>}
        </div>
        <span className="text-xs text-blue-700">Tax Year {year}</span>
      </div>

      {/* Top row: two upload cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* KK */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <p className="font-semibold text-gray-900">{t('basicInfoTitle')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" disabled={uploading === 'KK'} onClick={() => kkInputRef.current?.click()}>
                {uploading === 'KK' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FolderOpen className="h-4 w-4 mr-1" />}
                {t('uploadBtn')}
              </Button>
              <Button variant="outline" disabled={uploading === 'KK'} onClick={() => kkCaptureRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" />
                {t('captureBtn')}
              </Button>
            </div>
            <input
              ref={kkInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0], 'KK')}
            />
            <input
              ref={kkCaptureRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0], 'KK')}
            />
            {kkDoc && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5" />
                {t('uploaded')}: <span className="truncate">{kkDoc.fileName}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income card (A1 for 1770SS/S, business income for 1770) */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <p className="font-semibold text-gray-900">{t(incomeCardTitleKey)}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" disabled={uploading === 'INCOME'} onClick={() => incomeInputRef.current?.click()}>
                {uploading === 'INCOME' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FolderOpen className="h-4 w-4 mr-1" />}
                {t('uploadBtn')}
              </Button>
              <Button variant="outline" disabled={uploading === 'INCOME'} onClick={() => incomeCaptureRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" />
                {t('captureBtn')}
              </Button>
            </div>
            <input
              ref={incomeInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0], 'INCOME')}
            />
            <input
              ref={incomeCaptureRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0], 'INCOME')}
            />
            {incomeDoc && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5" />
                {t('uploaded')}: <span className="truncate">{incomeDoc.fileName}</span>
              </div>
            )}

            {/* Gross income (annual) — optional; OCR/operator may fill later */}
            <div>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t('grossIncomePlaceholder')}
                value={grossIncome}
                onChange={(e) => setGrossIncome(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">{t('grossIncomeHint')}</p>
            </div>

            {/* Tax credit (1770SS + 1770S) */}
            {showTaxCredit && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-gray-600 mb-2">{t('taxCreditSection')}</p>
                {showPph23Credit && (
                  <Input
                    className="mb-2"
                    type="number"
                    inputMode="numeric"
                    placeholder={t('pph23Placeholder')}
                    value={pph23Amount}
                    onChange={(e) => setPph23Amount(e.target.value)}
                  />
                )}
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={t('foreignTaxPlaceholder')}
                  value={foreignTaxAmount}
                  onChange={(e) => setForeignTaxAmount(e.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  disabled={uploading === 'FOREIGN_TAX'}
                  onClick={() => foreignTaxInputRef.current?.click()}
                >
                  {uploading === 'FOREIGN_TAX' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {t('foreignTaxDocUpload')}
                </Button>
                <input
                  ref={foreignTaxInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0], 'FOREIGN_TAX')}
                />
                {foreignTaxDoc && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="truncate">{foreignTaxDoc.fileName}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {uploadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Assets / Liabilities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-semibold text-gray-900">{t('assetsLiabilitiesTitle')}</p>
          <div className="flex items-center gap-3">
            {importResult && (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                {importResult}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={importFromProfile}>
              {t('importFromProfile')}
            </Button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Assets */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-gray-900">{t('assetsTitle')}</p>

              {/* Bank accounts */}
              <div>
                <p className="text-xs text-gray-500 mb-2">{t('bankAccountsLabel')}</p>
                <div className="space-y-3">
                  {bankAccounts.map((row, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-gray-50/40 p-3 space-y-2"
                    >
                      {/* Row 1: bank name + account number */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          className="h-10"
                          placeholder={t('bankName')}
                          value={row.bankName}
                          onChange={(e) => updateBankAccount(idx, { bankName: e.target.value })}
                        />
                        <Input
                          className="h-10"
                          placeholder={t('accountNumber')}
                          value={row.accountNumber}
                          onChange={(e) => updateBankAccount(idx, { accountNumber: e.target.value })}
                        />
                      </div>
                      {/* Row 2: currency + balance + remove */}
                      <div className="flex gap-2 items-center">
                        <select
                          className="h-10 w-24 rounded-md border border-input bg-white px-2 text-sm"
                          value={row.currency}
                          onChange={(e) => updateBankAccount(idx, { currency: e.target.value as Currency })}
                        >
                          <option value="IDR">IDR</option>
                          <option value="USD">USD</option>
                          <option value="KRW">KRW</option>
                          <option value="JPY">JPY</option>
                          <option value="SGD">SGD</option>
                          <option value="EUR">EUR</option>
                        </select>
                        <Input
                          className="h-10 flex-1"
                          type="number"
                          inputMode="numeric"
                          placeholder={t('balanceAt1231')}
                          value={row.balance}
                          onChange={(e) => updateBankAccount(idx, { balance: e.target.value })}
                        />
                        <button
                          type="button"
                          className="h-10 px-3 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 shrink-0"
                          onClick={() => removeBankAccount(idx)}
                          disabled={bankAccounts.length <= 1}
                        >
                          {t('removeRow')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={addBankAccount}>
                  {t('addAccount')}
                </Button>
              </div>

              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('stockInvest')}
                value={stocks} onChange={(e) => setStocks(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('realEstate')}
                value={realEstate} onChange={(e) => setRealEstate(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('vehicle')}
                value={vehicle} onChange={(e) => setVehicle(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('businessAssets')}
                value={businessAssets} onChange={(e) => setBusinessAssets(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('otherAssets')}
                value={otherAssets} onChange={(e) => setOtherAssets(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Liabilities */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-gray-900">{t('liabilitiesTitle')}</p>
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('bankLoan')}
                value={bankLoan} onChange={(e) => setBankLoan(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('creditCard')}
                value={creditCard} onChange={(e) => setCreditCard(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('personalLoan')}
                value={personalLoan} onChange={(e) => setPersonalLoan(e.target.value)}
              />
              <Input
                className="h-10"
                type="number" inputMode="numeric"
                placeholder={t('businessDebt')}
                value={businessDebt} onChange={(e) => setBusinessDebt(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
      <Button
        className="w-full h-12 bg-gray-800 hover:bg-gray-900 text-white"
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
            {t('submitting')}
          </>
        ) : (
          t('submitCta')
        )}
      </Button>
    </div>
  );
}
