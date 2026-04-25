'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Loader2, CheckCircle, AlertTriangle, Upload, FileText,
  Camera, Send, Printer,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import AiReviewSection from '@/components/tax-billing/AiReviewSection';

interface BillingItem {
  id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  ebilling_code: string | null;
  payment_proof_url: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  payment_verified_at: string | null;
  bpe_number: string | null;
  bpe_date: string | null;
  bpe_file_url: string | null;
  counterparty_name: string | null;
  notes: string | null;
  created_at: string;
}

const currentYear = new Date().getFullYear();

// Statuses that appear in the billing center (supervisor-approved)
const VISIBLE_STATUSES = [
  'APPROVED',
  'EBILLING_GENERATED',
  'PAYMENT_PENDING',
  'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED',
  'DJP_SUBMITTED',
  'BPE_UPLOADED',
  'COMPLETED',
];

// Statuses where customer still needs to act (submit NTPN + proof)
const NEEDS_ACTION_STATUSES = ['EBILLING_GENERATED', 'PAYMENT_PENDING'];

export default function TaxBillingPage() {
  const { session } = useSession();
  const t = useTranslations('taxBilling');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Company label for the 회사 column. For COMPANY customers this is the
  // registered company_name; for INDIVIDUAL (who normally shouldn't see this
  // page) we fall back to full_name so the cell is never blank.
  const [companyLabel, setCompanyLabel] = useState<string>('');

  useEffect(() => {
    let alive = true;
    fetch('/api/customer/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.data?.customer) return;
        const c = d.data.customer;
        setCompanyLabel(c.company_name || c.full_name || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Per-row NTPN input state
  const [ntpnInput, setNtpnInput] = useState<Record<string, string>>({});
  const [submittingNtpn, setSubmittingNtpn] = useState<string | null>(null);
  // Per-row BPE upload state (customer uploads BPE PDF received by email)
  const [bpeNumberInput, setBpeNumberInput] = useState<Record<string, string>>({});
  const [uploadingBpe, setUploadingBpe] = useState<string | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/queue');
      const data = await res.json();
      if (data.success) {
        const fetched = data?.data?.items;
        const all = (Array.isArray(fetched) ? fetched : []) as BillingItem[];
        setItems(
          all.filter(
            (i) => i.tax_period_year === year && VISIBLE_STATUSES.includes(i.status),
          ),
        );
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleUploadProof = async (itemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(itemId);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      fd.append('customerId', session?.customerId || '');
      fd.append('documentType', 'RECEIPT');
      fd.append('uploadSource', 'WEB');

      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();

      if (uploadData.success) {
        try {
          await fetch('/api/customer/payment-proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queueItemId: itemId,
              fileUrl: uploadData.data?.signedUrl || uploadData.data?.path,
            }),
          });
        } catch {
          /* */
        }
        showMsg('success', t('proofUploadSuccess'));
        loadItems();
      } else {
        showMsg('error', t('uploadFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitNtpn = async (item: BillingItem) => {
    const ntpn = ntpnInput[item.id] || '';
    if (ntpn.length < 16) {
      showMsg('error', t('ntpnValidationError'));
      return;
    }
    setSubmittingNtpn(item.id);
    try {
      const res = await fetch('/api/tax/monthly-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-payment',
          paymentId: item.id,
          ntpn,
          amount: item.amount,
          paidDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'BANK_TRANSFER',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', t('ntpnSubmitSuccess'));
        setNtpnInput((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        loadItems();
      } else {
        showMsg('error', data.error || t('ntpnSubmitFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setSubmittingNtpn(null);
    }
  };

  const handleUploadBpe = async (itemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingBpe(itemId);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      fd.append('customerId', session?.customerId || '');
      fd.append('documentType', 'BPE');
      fd.append('uploadSource', 'WEB');

      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        showMsg('error', t('uploadFailed'));
        return;
      }

      const fileUrl = uploadData.data?.signedUrl || uploadData.data?.path;
      const res = await fetch('/api/customer/bpe-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId: itemId,
          bpeFileUrl: fileUrl,
          bpeNumber: bpeNumberInput[itemId]?.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', t('bpeUploadSuccess'));
        setBpeNumberInput((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        loadItems();
      } else {
        showMsg('error', data.error || t('uploadFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setUploadingBpe(null);
    }
  };

  const handlePrintIdBilling = (item: BillingItem) => {
    // Open print-friendly view or PDF (stub — to be wired to backend PDF endpoint later)
    if (item.ebilling_code) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`
          <html><head><title>ID Billing ${item.ebilling_code}</title></head>
          <body style="font-family: monospace; padding: 40px;">
            <h1>ID Billing</h1>
            <p><strong>Code:</strong> ${item.ebilling_code}</p>
            <p><strong>Tax Type:</strong> ${item.tax_type}</p>
            <p><strong>Period:</strong> ${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}</p>
            <p><strong>Amount:</strong> Rp ${item.amount.toLocaleString()}</p>
            <button onclick="window.print()">Print</button>
          </body></html>
        `);
      }
    }
  };

  const approvedCount = items.length;
  const paidCount = items.filter((i) => i.payment_verified_at || i.status === 'COMPLETED').length;
  const actionNeededCount = items.filter((i) => NEEDS_ACTION_STATUSES.includes(i.status)).length;

  return (
    <div className="mx-auto py-10 px-6 max-w-[1100px]">
      {/* Header — keynote slide: clean title only, no icons or summary cards */}
      <header className="mb-6">
        <h1 className="text-[22px] font-bold text-gray-900">{t('v2PageTitle')}</h1>
        <p className="text-[13px] text-gray-500 mt-1">{t('v2PageSubtitle')}</p>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* AI review — shows up only when there are flagged items waiting
          for customer input. Reloads the billing list on submit so items
          advancing to PENDING_APPROVAL disappear from here. */}
      <AiReviewSection onDone={() => loadItems()} />

      {/* Billing Table card */}
      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-8">
          {/* Card header: title + discreet year selector + 3 status chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p className="text-base font-bold text-gray-900">{t('v2ListTitle')}</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">
                {t('totalCount')} <span className="font-semibold text-gray-700">{approvedCount}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="text-orange-600 font-semibold">{actionNeededCount}</span> {t('paymentPending')}
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="text-emerald-600 font-semibold">{paidCount}</span> {t('completedLabel')}
              </span>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear].map((y) => (
                    <SelectItem key={y} value={String(y)}>{t('yearUnit', { year: y })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="h-7 w-7 animate-spin mx-auto text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
              <CreditCard className="h-9 w-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('v2NoItems')}</p>
              <p className="text-xs mt-1">{t('v2NoItemsHint')}</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                {/* Column headers — keynote styling: light gray, small caps, generous padding */}
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-gray-500">
                    <th className="px-4 py-3 w-[90px]">{t('v2ColType')}</th>
                    <th className="px-4 py-3">{t('v2ColCompany')}</th>
                    <th className="px-4 py-3 w-[130px]">{t('v2ColAmount')}</th>
                    <th className="px-4 py-3 w-[200px]">{t('v2ColBillingCode')}</th>
                    <th className="px-4 py-3 w-[200px]">{t('v2ColPayment')}</th>
                    <th className="px-4 py-3 w-[150px] text-right">{t('v2ColProof')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const needsAction = NEEDS_ACTION_STATUSES.includes(item.status);
                    const isPaid = !!item.payment_verified_at || item.status === 'COMPLETED';
                    const period = `${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}`;

                    return (
                      <tr key={item.id} className="border-t border-gray-100">
                        {/* 세목 */}
                        <td className="px-4 py-6 align-top">
                          <p className="text-[13px] font-semibold text-gray-900">{item.tax_type}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{period}</p>
                        </td>

                        {/* 회사 */}
                        <td className="px-4 py-6 align-top text-[13px] text-gray-800">
                          {item.counterparty_name || companyLabel || session?.fullName || '—'}
                        </td>

                        {/* 금액 */}
                        <td className="px-4 py-6 align-top text-[13px] text-gray-800 font-medium">
                          {fmtRp(item.amount)}
                        </td>

                        {/* Billing Code — code on top, "ID Billing 출력" pill below */}
                        <td className="px-4 py-6 align-top">
                          {item.ebilling_code ? (
                            <div className="space-y-2">
                              <p className="font-mono text-[13px] text-gray-900 tracking-wide">
                                {item.ebilling_code}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-[11px] font-medium rounded-md bg-white border-gray-200 hover:bg-gray-50"
                                onClick={() => handlePrintIdBilling(item)}
                              >
                                <Printer className="h-3 w-3 mr-1" />
                                {t('v2BtnIdBillingPrint')}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                        </td>

                        {/* 납부 — NTPN input only */}
                        <td className="px-4 py-6 align-top">
                          {isPaid ? (
                            <div className="text-xs text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {t('v2StatusPaid')}
                              {item.payment_date && (
                                <span className="text-[10px] text-gray-500">({item.payment_date})</span>
                              )}
                            </div>
                          ) : needsAction ? (
                            <Input
                              className="h-9 text-xs font-mono rounded-md border-gray-200"
                              placeholder={t('v2NtpnPlaceholder')}
                              value={ntpnInput[item.id] || ''}
                              maxLength={16}
                              onChange={(e) =>
                                setNtpnInput((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value.replace(/\D/g, '').slice(0, 16),
                                }))
                              }
                            />
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                          {item.bpe_number && (
                            <div className="text-[10px] text-purple-700 mt-2 flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5" />
                              BPE: {item.bpe_number}
                            </div>
                          )}
                        </td>

                        {/* 증빙 — stacked: 파일 업로드 / 사진 촬영 / 제출 */}
                        <td className="px-4 py-6 align-top">
                          {needsAction && !isPaid ? (
                            <div className="flex flex-col gap-2 w-[130px] ml-auto">
                              <label>
                                <span className="inline-flex w-full items-center justify-center h-8 px-3 text-[11px] font-medium rounded-md bg-white border border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50">
                                  {uploading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Upload className="h-3 w-3 mr-1" />
                                  )}
                                  {t('v2UploadFile')}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*,.pdf"
                                  ref={(el) => {
                                    fileInputRefs.current[item.id] = el;
                                  }}
                                  onChange={(e) => handleUploadProof(item.id, e.target.files)}
                                  disabled={uploading === item.id}
                                />
                              </label>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-[11px] font-medium rounded-md bg-white border-gray-200 hover:bg-gray-50"
                                disabled={uploading === item.id}
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.capture = 'environment';
                                  input.onchange = (e) =>
                                    handleUploadProof(item.id, (e.target as HTMLInputElement).files);
                                  input.click();
                                }}
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                {t('v2UploadPhoto')}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-3 text-[11px] font-medium rounded-md bg-slate-400 text-white hover:bg-slate-500 disabled:opacity-60"
                                disabled={
                                  submittingNtpn === item.id ||
                                  (ntpnInput[item.id] || '').length < 16
                                }
                                onClick={() => handleSubmitNtpn(item)}
                              >
                                {submittingNtpn === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                {t('v2BtnSubmit')}
                              </Button>
                            </div>
                          ) : item.status === 'DJP_SUBMITTED' ? (
                            <div className="flex flex-col gap-2 w-[160px] ml-auto">
                              <p className="text-[10px] text-purple-700">{t('v2BpeUploadHint')}</p>
                              <Input
                                className="h-8 text-[11px] font-mono rounded-md border-gray-200"
                                placeholder={t('v2BpeNumberPlaceholder')}
                                value={bpeNumberInput[item.id] || ''}
                                maxLength={50}
                                onChange={(e) =>
                                  setBpeNumberInput((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                              <label>
                                <span className="inline-flex w-full items-center justify-center h-8 px-3 text-[11px] font-medium rounded-md border border-purple-200 bg-purple-50 text-purple-800 cursor-pointer hover:bg-purple-100">
                                  {uploadingBpe === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Upload className="h-3 w-3 mr-1" />
                                  )}
                                  {t('v2UploadBpe')}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,image/*"
                                  onChange={(e) => handleUploadBpe(item.id, e.target.files)}
                                  disabled={uploadingBpe === item.id}
                                />
                              </label>
                            </div>
                          ) : item.bpe_file_url || item.status === 'BPE_UPLOADED' || item.status === 'COMPLETED' ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {item.status === 'COMPLETED' ? t('filingComplete') : t('v2BpeUploaded')}
                              </div>
                              {item.bpe_file_url && (
                                <a
                                  href={item.bpe_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <FileText className="h-2.5 w-2.5" />
                                  {t('v2BpePreview')}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 block text-right">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-6 text-[11px] text-gray-400">
            {t('v2NoticeApprovedOnly')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
