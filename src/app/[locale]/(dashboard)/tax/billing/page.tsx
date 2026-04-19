'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Loader2, CheckCircle, AlertTriangle, Upload, FileText,
  Camera, Send, Printer,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { useTranslations } from 'next-intl';

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
  const params = useParams();
  const locale = params.locale as string;
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
    <div className="container mx-auto py-8 px-4 max-w-[1200px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-600" />
          {t('v2PageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('v2PageSubtitle')}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500">{t('totalCount')}</p>
            <p className="text-xl font-bold">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-orange-600">{t('paymentPending')}</p>
            <p className="text-xl font-bold text-orange-700">{actionNeededCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-green-600">{t('completedLabel')}</p>
            <p className="text-xl font-bold text-green-700">{paidCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Year selector */}
      <div className="flex gap-3 mb-4">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear].map((y) => (
              <SelectItem key={y} value={String(y)}>{t('yearUnit', { year: y })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Billing Table */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="font-semibold">{t('v2ListTitle')}</p>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-gray-400">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('v2NoItems')}</p>
              <p className="text-xs mt-1">{t('v2NoItemsHint')}</p>
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">{t('v2ColType')}</th>
                    <th className="p-2 text-left">{t('v2ColCompany')}</th>
                    <th className="p-2 text-right">{t('v2ColAmount')}</th>
                    <th className="p-2 text-left">{t('v2ColBillingCode')}</th>
                    <th className="p-2 text-left">{t('v2ColPayment')}</th>
                    <th className="p-2 text-left">{t('v2ColProof')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const needsAction = NEEDS_ACTION_STATUSES.includes(item.status);
                    const isPaid = !!item.payment_verified_at || item.status === 'COMPLETED';
                    const period = `${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}`;

                    return (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 align-top">
                          <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">{item.tax_type}</Badge>
                          <p className="text-[10px] text-gray-500 mt-1">{period}</p>
                        </td>
                        <td className="p-2 align-top text-sm">
                          {companyLabel || session?.fullName || '—'}
                        </td>
                        <td className="p-2 align-top text-right font-mono">
                          {fmtRp(item.amount)}
                        </td>
                        <td className="p-2 align-top">
                          {item.ebilling_code ? (
                            <div className="space-y-1">
                              <p className="font-mono text-[11px] text-indigo-900">{item.ebilling_code}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[10px] h-7"
                                onClick={() => handlePrintIdBilling(item)}
                              >
                                <Printer className="h-3 w-3 mr-1" />
                                {t('v2BtnIdBillingPrint')}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          {isPaid ? (
                            <div className="text-xs text-green-700 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {t('v2StatusPaid')}
                              {item.payment_date && (
                                <span className="text-[10px] text-gray-500">({item.payment_date})</span>
                              )}
                            </div>
                          ) : needsAction ? (
                            <Input
                              className="h-8 text-xs font-mono w-40"
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
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                          {item.bpe_number && (
                            <div className="text-[9px] text-purple-700 mt-1 flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5" />
                              BPE: {item.bpe_number}
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          {needsAction && !isPaid ? (
                            <div className="space-y-1">
                              <label className="block">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[10px] cursor-pointer hover:bg-slate-50">
                                  {uploading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Upload className="h-3 w-3" />
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
                                className="text-[10px] h-7 w-full"
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
                                className="text-[10px] h-7 w-full"
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
                          ) : item.status === 'COMPLETED' ? (
                            <div className="text-[10px] text-green-700 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {t('filingComplete')}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-gray-500">
            {t('v2NoticeApprovedOnly')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
