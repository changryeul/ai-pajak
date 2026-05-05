'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Receipt, FileText, DollarSign, CheckCircle,
  AlertTriangle, Sparkles, X, ChevronDown, ChevronRight,
  Calculator, Shield, Upload, Camera, ArrowRight,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { ScreenHeader } from '@/components/tax';
import { Download, FileUp, Pencil } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

// ── Types ──
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
}

interface Summary {
  totalGross: number;
  totalTax: number;
  transactionCount: number;
}

interface Counterparty {
  id: string;
  name: string;
  npwp: string | null;
  kbli_code: string | null;
  country: string | null;
  is_foreign: boolean | null;
  is_resident: boolean | null;
  is_entity: boolean | null;
  has_cod: boolean | null;
  vendor_is_property_owner: boolean | null;
  is_related_party: boolean | null;
  shareholding_pct: number | null;
  is_beneficial_owner: boolean | null;
  receives_reinvested_dividend: boolean | null;
  dgt_form_valid_until: string | null;
  is_shareholder: boolean | null;
}

// Service type → ResolveEngine serviceCategory mapping
type ServiceCategory =
  | 'EMPLOYMENT' | 'SERVICE' | 'RENTAL' | 'CONSTRUCTION'
  | 'DIVIDEND' | 'INTEREST' | 'ROYALTY' | 'IMPORT' | 'SHIPPING' | 'OTHER';

const SERVICE_TYPE_TO_CATEGORY: Record<string, ServiceCategory> = {
  DIVIDEN: 'DIVIDEND',
  BUNGA: 'INTEREST',
  ROYALTI: 'ROYALTY',
  HADIAH: 'OTHER',         // Prize — handled by Other for now
  SEWA: 'RENTAL',
  JASA_TEKNIK: 'SERVICE',
  JASA_MANAJEMEN: 'SERVICE',
  JASA_KONSULTAN: 'SERVICE',
  JASA_LAINNYA: 'SERVICE',
};

interface TaxResolutionResult {
  taxType: 'PPh21' | 'PPh23' | 'PPh26' | 'PPh4_2' | 'PPh22' | 'PPh15' | 'PPN';
  rate: number;
  taxAmount: number;
  netAmount: number;
  isFinal: boolean;
  npwpSurchargeApplied: boolean;
  reason: string;
  legalBasis: string;
}

interface Customer {
  id: string;
  full_name: string;
  company_name?: string;
}

// ── Service types — 세율은 거래 상대방/조건에 따라 동적 결정됨 ──

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function PPh23Page() {
  const t = useTranslations('pph23Page');
  const tsc = useTranslations('taxScreen');

  const SERVICE_TYPES: Array<{ value: string; label: string; note: string }> = [
    { value: 'DIVIDEN', label: t('k0_9674d4'), note: t('k1_5d2319') },
    { value: 'BUNGA', label: t('k2_fd9ed5'), note: 'PPh 23 15% ' + t('k3_f73a0b') },
    { value: 'ROYALTI', label: t('k4_6541ff'), note: 'PPh 23 15% ' + t('k3_f73a0b') },
    { value: 'HADIAH', label: t('k5_c6db78'), note: 'PPh 23 15%' },
    { value: 'SEWA', label: t('k6_d77ffe'), note: t('k7_839529') },
    { value: 'JASA_TEKNIK', label: t('k8_574f1a'), note: 'PPh 23 2%' },
    { value: 'JASA_MANAJEMEN', label: t('k9_6f5885'), note: 'PPh 23 2%' },
    { value: 'JASA_KONSULTAN', label: t('k10_9cacbd'), note: 'PPh 23 2%' },
    { value: 'JASA_LAINNYA', label: t('k11_7e90a0'), note: 'PPh 23 2%' },
  ];
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;

  const isConsultant = session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';

  // State
  const [period, setPeriod] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalGross: 0, totalTax: 0, transactionCount: 0 });
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingBP, setGeneratingBP] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [fCounterparty, setFCounterparty] = useState('');
  const [fServiceType, setFServiceType] = useState('JASA_KONSULTAN');
  const [fGrossAmount, setFGrossAmount] = useState('');
  const [fInvoiceNumber, setFInvoiceNumber] = useState('');
  const [fTransactionDate, setFTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [fDescription, setFDescription] = useState('');
  const [fUseResolution, setFUseResolution] = useState(true);

  // Phase 4 — per-transaction context (additional questions)
  const [fRentalAssetType, setFRentalAssetType] = useState<'BUILDING_LAND' | 'MACHINE' | 'VEHICLE' | 'OTHER'>('BUILDING_LAND');
  const [fInterestSource, setFInterestSource] = useState<'BANK_DEPOSIT' | 'LOAN' | 'BOND' | 'OTHER'>('LOAN');
  const [fShareholdingOverride, setFShareholdingOverride] = useState('');
  const [fReinvestedOverride, setFReinvestedOverride] = useState<'' | 'yes' | 'no'>('');

  // Tax resolution preview (from /api/tax/resolve)
  const [resolutionPreview, setResolutionPreview] = useState<TaxResolutionResult | null>(null);
  const [resolvingTax, setResolvingTax] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);

  // Quick-add counterparty
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qName, setQName] = useState('');
  const [qNpwp, setQNpwp] = useState('');
  const [addingCp, setAddingCp] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Load customers (consultant) or set own customerId
  useEffect(() => {
    if (isConsultant) {
      fetch('/api/customers').then(r => r.json()).then(d => {
        const list = d.customers || [];
        setCustomers(list);
        if (list.length > 0 && !customerId) setCustomerId(list[0].id);
      }).catch(() => {});
    } else if (session?.customerId) {
      setCustomerId(session.customerId);
    }
  }, [session, isConsultant]);

  // Load transactions + counterparties when customerId/period change
  const loadData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const [txRes, cpRes] = await Promise.all([
        fetch(`/api/tax/pph23-transactions?customerId=${customerId}&period=${period}`),
        fetch(`/api/counterparties?customerId=${customerId}`),
      ]);
      const txData = await txRes.json();
      const cpData = await cpRes.json();
      if (txData.success) {
        setTransactions(txData.data?.transactions || txData.data || []);
        setSummary(txData.data?.summary || { totalGross: 0, totalTax: 0, transactionCount: 0 });
      }
      if (cpData.success) setCounterparties(cpData.data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [customerId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // Add transaction
  const handleAddTransaction = async (e: React.FormEvent | null, closeAfter: boolean = false) => {
    if (e) e.preventDefault();
    if (!customerId || !fCounterparty || !fGrossAmount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tax/pph23-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxPeriod: period,
          counterpartyId: fCounterparty || undefined,
          serviceType: fServiceType,
          grossAmount: Number(fGrossAmount),
          invoiceNumber: fInvoiceNumber || undefined,
          transactionDate: fTransactionDate,
          description: fDescription || undefined,
          useResolution: fUseResolution,
          // Phase 4 per-transaction context
          rentalAssetType: fServiceType === 'SEWA' ? fRentalAssetType : undefined,
          interestSource: fServiceType === 'BUNGA' ? fInterestSource : undefined,
          shareholdingPctAtTime: fShareholdingOverride ? Number(fShareholdingOverride) : undefined,
          isReinvestedDomestically: fReinvestedOverride === 'yes' ? true : fReinvestedOverride === 'no' ? false : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `${t('k12_c05543')} — ${t('k13_e2bf5c')} ${fmtRp(data.data?.tax_amount || 0)}`);
        // Always clear the per-transaction fields so the form is ready for the next entry.
        setFGrossAmount('');
        setFInvoiceNumber('');
        setFDescription('');
        setFShareholdingOverride('');
        setFReinvestedOverride('');
        setResolutionPreview(null);
        loadData();
        if (closeAfter) {
          setShowForm(false);
        }
      } else {
        showMsg('error', data.error || t('k14_5cf2ad'));
      }
    } catch {
      showMsg('error', t('k15_175c5f'));
    } finally {
      setSaving(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id: string) => {
    if (!confirm('' + t('k16_4cb4ca') + '?')) return;
    try {
      await fetch(`/api/tax/pph23-transactions?id=${id}`, { method: 'DELETE' });
      loadData();
    } catch { /* */ }
  };

  // Generate e-Bupot numbers
  const handleGenerateBP = async () => {
    if (!customerId) return;
    setGeneratingBP(true);
    try {
      const res = await fetch('/api/tax/ebupot-pph23', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, period }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `e-Bupot ${data.data?.generated || 0} ${t('k17_e7186b')}`);
        loadData();
      } else {
        showMsg('error', data.error || 'e-Bupot ' + t('k18_cbbcb4') + '');
      }
    } catch {
      showMsg('error', t('k15_175c5f'));
    } finally {
      setGeneratingBP(false);
    }
  };

  // Resolve tax via server ResolveEngine
  useEffect(() => {
    if (!fCounterparty || !fGrossAmount || !fUseResolution || Number(fGrossAmount) <= 0) {
      setResolutionPreview(null);
      return;
    }
    const cp = counterparties.find(c => c.id === fCounterparty);
    if (!cp) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResolvingTax(true);
      try {
        const serviceCategory = SERVICE_TYPE_TO_CATEGORY[fServiceType] || 'SERVICE';
        const recipientType = cp.is_foreign || cp.is_resident === false ? 'NON_RESIDENT' : 'RESIDENT';

        const res = await fetch('/api/tax/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            grossAmount: Number(fGrossAmount),
            transactionDate: fTransactionDate,
            description: fDescription,
            serviceCategory,
            recipientType,
            recipientNpwp: cp.npwp || undefined,
            recipientCountry: cp.country || undefined,
            hasCertificateOfDomicile: cp.has_cod || false,
            isRelatedParty: cp.is_related_party || false,
            vendorIsPropertyOwner: cp.vendor_is_property_owner || false,
            // Phase 3/4 context
            recipientIsEntity: cp.is_entity ?? undefined,
            shareholdingPct: fShareholdingOverride ? Number(fShareholdingOverride) : (cp.shareholding_pct ?? undefined),
            isBeneficialOwner: cp.is_beneficial_owner ?? undefined,
            receivesReinvestedDividend: fReinvestedOverride === 'yes' ? true : fReinvestedOverride === 'no' ? false : (cp.receives_reinvested_dividend ?? false),
            hasDgtForm: cp.dgt_form_valid_until ? new Date(cp.dgt_form_valid_until) >= new Date(fTransactionDate) : false,
            rentalAssetType: fServiceType === 'SEWA' ? fRentalAssetType : undefined,
            interestSource: fServiceType === 'BUNGA' ? fInterestSource : undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.data?.resolution) {
          setResolutionPreview(data.data.resolution as TaxResolutionResult);
        } else {
          setResolutionPreview(null);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setResolutionPreview(null);
        }
      } finally {
        setResolvingTax(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [fCounterparty, fServiceType, fGrossAmount, fTransactionDate, fDescription, fUseResolution, counterparties, fRentalAssetType, fInterestSource, fShareholdingOverride, fReinvestedOverride]);

  // Detect camera availability (mobile or videoinput device)
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setCameraAvailable(true);
      return;
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => setCameraAvailable(devices.some(d => d.kind === 'videoinput')))
        .catch(() => setCameraAvailable(false));
    }
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const pendingBP = transactions.filter(t => !t.bukti_potong_number).length;
  const completedBP = transactions.filter(t => !!t.bukti_potong_number).length;

  // Document upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string; file_name: string; document_type: string; ocr_status: string;
    ocr_result?: { extractedData?: Record<string, unknown>; confidence?: number };
    created_at: string;
  }>>([]);
  const [uploading, setUploading] = useState(false);

  // Month picker — opens before upload/manual entry
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'csv' | 'file' | 'camera' | 'manual' | null>(null);
  const [pickedYear, setPickedYear] = useState<number>(currentYear);
  const [pickedMonth, setPickedMonth] = useState<number>(currentMonth);
  const [confirmedPeriod, setConfirmedPeriod] = useState<string | null>(null);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const openMonthPicker = (action: 'csv' | 'file' | 'camera' | 'manual') => {
    setPendingAction(action);
    setMonthPickerOpen(true);
  };

  // Load documents for this period
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/documents?customerId=${customerId}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUploadedDocs(d.data || []); })
      .catch(() => {});
  }, [customerId, period, transactions]);

  const handleDocUpload = async (files: FileList | null, source: string = 'WEB', docType: string = 'INVOICE', uploadPeriod?: string) => {
    if (!files || !customerId) return;
    setUploading(true);
    let count = 0;
    const taxPeriod = uploadPeriod || confirmedPeriod;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      fd.append('documentType', docType);
      fd.append('uploadSource', source);
      if (taxPeriod) fd.append('taxPeriod', taxPeriod);
      try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          count++;
          if (data.data?.id) fetch(`/api/documents/${data.data.id}/ocr`, { method: 'POST' }).catch(() => {});
        }
      } catch { /* */ }
    }
    if (count > 0) {
      showMsg('success', `${count} ${t('k19_4c0fb1')}`);
      // Sync displayed period to the uploaded month so OCR auto-create cards show.
      if (taxPeriod) setPeriod(taxPeriod);
      setTimeout(() => {
        fetch(`/api/documents?customerId=${customerId}&period=${taxPeriod || period}`)
          .then(r => r.json())
          .then(d => { if (d.success) setUploadedDocs(d.data || []); })
          .catch(() => {});
      }, 2000);
    }
    setUploading(false);
  };

  const confirmMonthPicker = () => {
    const period = periodLabel(pickedYear, pickedMonth);
    setConfirmedPeriod(period);
    setMonthPickerOpen(false);
    setTimeout(() => {
      if (pendingAction === 'csv') {
        csvInputRef.current?.click();
      } else if (pendingAction === 'file') {
        fileInputRef.current?.click();
      } else if (pendingAction === 'camera') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => handleDocUpload((e.target as HTMLInputElement).files, 'CAMERA', 'INVOICE', period);
        input.click();
      } else if (pendingAction === 'manual') {
        setPeriod(period);
        setShowForm(true);
      }
    }, 50);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageTitle title="PPh 23" />
      <ScreenHeader
        title={t('k20_5ee3c0')}
        step={1}
        aiSteps={[tsc('stepAiProcess'), tsc('stepRateAndTax'), tsc('stepIdBillingGen')]}
      />

      {/* Filing process — stepper moved to top so the user always sees overall progress */}
      {transactions.length > 0 && (
        <FilingSteps
          customerId={customerId}
          period={period}
          transactions={transactions}
          summary={summary}
          pendingBP={pendingBP}
          locale={locale}
        />
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isConsultant && (
          <div>
            <Label className="text-xs">{t('k22_1edd91')}</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-56"><SelectValue placeholder={t('k23_935894')} /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">{t('k24_7bc7c5')}</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2-mode input cards (matching PPh21 simplified design) */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {/* (removed) Method 1: Template — merged into Method 2 below */}
        {/* Method 2: Upload — RECOMMENDED */}
        <Card className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:shadow-sm transition-all relative">
          <div className="absolute -top-2 left-5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
            {t('recommendedBadge')}
          </div>
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FileUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('inputModeUpload')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{t('inputModeUploadDesc')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => openMonthPicker('file')}
                disabled={uploading || !customerId}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileUp className="h-3 w-3 mr-1" />}
                {t('inputModeUploadBtn')}
              </Button>
              {cameraAvailable && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => openMonthPicker('camera')}
                  disabled={uploading || !customerId}
                >
                  <Camera className="h-3 w-3 mr-1" />{t('inputCameraBtn')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const headers = ['counterparty_name', 'counterparty_npwp', 'service_type', 'transaction_type', 'gross_amount', 'tax_rate', 'contract_no', 'invoice_no', 'dgt_form'];
                  const sample = ['PT Vendor', '01.234.567.8-901.000', 'PPh 23', 'service', '10000000', '2', 'CT-001', 'INV-001', 'N'];
                  const csv = [headers.join(','), sample.join(','), ''].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'pph23_template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                  showMsg('success', t('templateComingSoon'));
                }}
              >
                <Download className="h-3 w-3 mr-1" />{t('inputTemplateDownload')}
              </Button>
              {confirmedPeriod && (pendingAction === 'file' || pendingAction === 'camera') && (
                <p className="text-[10px] text-emerald-700 text-center">
                  {t('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv" multiple
                onChange={e => handleDocUpload(e.target.files, 'WEB', 'INVOICE')} />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                {t('uploadHint')}
              </p>
              {cameraAvailable && (
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Camera className="h-3 w-3 text-emerald-500" />
                  {t('inputCameraHint')}
                </p>
              )}
              <p className="text-[10px] text-gray-500 font-mono">
                PPh 23 / PPh 4(2) / PPh 26 / PPh 15 / PPh 22
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Method 3: Manual */}
        <Card className={`border-2 border-dashed ${showForm ? 'border-purple-400 shadow-sm' : 'border-purple-200 hover:border-purple-400 hover:shadow-sm'} transition-all`}>
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Pencil className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('inputModeManual')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{t('inputModeManualDesc')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button
                size="sm"
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => openMonthPicker('manual')}
                disabled={!customerId}
              >
                <Pencil className="h-3 w-3 mr-1" />{t('inputModeManualBtn')}
              </Button>
              {confirmedPeriod && pendingAction === 'manual' && (
                <p className="text-[10px] text-purple-700 text-center">
                  {t('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-500">
                {t('manualHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">{t('k25_e29066')}</p>
          <p className="text-xl font-bold">{t('countItems', { count: summary.transactionCount })}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">{t('k26_f17d2d')}</p>
          <p className="text-sm font-bold font-mono">{fmtRp(summary.totalGross)}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500"><CardContent className="p-3">
          <p className="text-[10px] text-emerald-600">{t('k27_4becc9')}</p>
          <p className="text-sm font-bold font-mono text-emerald-700">{fmtRp(summary.totalTax)}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">e-Bupot</p>
          <p className="text-sm font-bold">
            <span className="text-green-600">{completedBP}</span>
            {pendingBP > 0 && <span className="text-amber-600"> / {pendingBP} {t('k28_65905a')}</span>}
          </p>
        </CardContent></Card>
      </div>

      {/* OCR → Auto-create transactions + NPWP validation + DGT Form */}
      {uploadedDocs.filter(d => d.ocr_status === 'COMPLETED' && d.ocr_result?.extractedData).length > 0 && (
        <Card className="mb-4 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              AI {t('k37_b8e205')}
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              {t('k38_38bd8a')} "{t('k39_7c6f9f')}"{t('k40_7672d5')}
            </p>
            <div className="space-y-2">
              {uploadedDocs.filter(d => d.ocr_status === 'COMPLETED' && d.ocr_result?.extractedData).map(doc => {
                const ext = doc.ocr_result!.extractedData!;
                const cpName = String(ext.counterpartyName || ext.vendorName || ext.customerName || ext.recipientName || '');
                const cpNpwp = String(ext.counterpartyNpwp || ext.vendorNpwp || ext.npwp || '');
                const amount = Number(ext.grossAmount || ext.dpp || ext.amount || ext.totalAmount || 0);
                const isForeign = String(ext.country || '').length === 2 && String(ext.country || '') !== 'ID';
                const hasNpwp = cpNpwp.replace(/\D/g, '').length >= 15;

                return (
                  <div key={doc.id} className="p-3 rounded-lg border bg-blue-50/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cpName || t('k41_3e472d')}</span>
                          {hasNpwp && <Badge className="text-[8px] bg-green-100 text-green-700">NPWP ✓</Badge>}
                          {!hasNpwp && !isForeign && <Badge className="text-[8px] bg-red-100 text-red-700">NPWP {t('k42_a245e6')}!</Badge>}
                          {isForeign && <Badge className="text-[8px] bg-amber-100 text-amber-700">{t('k43_90ed66')}</Badge>}
                        </div>
                        {hasNpwp && <p className="font-mono text-[10px] text-gray-500">{cpNpwp}</p>}
                        {amount > 0 && <p className="font-mono">DPP: {fmtRp(amount)}</p>}
                        <p className="text-[10px] text-gray-400">{doc.file_name}</p>

                        {/* NPWP missing warning — domestic company */}
                        {!hasNpwp && !isForeign && (
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200 text-[10px] text-red-800">
                            <p className="font-bold">⚠️ NPWP {t('k44_b63c09')} — {t('k45_eeb28a')}</p>
                            <p className="mt-0.5">{t('k46_60751f')}</p>
                          </div>
                        )}

                        {/* Foreign company — DGT Form required */}
                        {isForeign && (
                          <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800">
                            <p className="font-bold">🌍 {t('k47_3e209d')} — Tax Treaty {t('k48_924910')}</p>
                            <ul className="mt-0.5 space-y-0.5">
                              <li>• <b>DGT Form</b> (Directorate General of Taxes) — {t('k49_853bb3')}</li>
                              <li>• <b>{t('k50_d59e63')}</b> — {t('k51_52cc75')}</li>
                              <li>• {t('k52_7f17f7')}</li>
                              <li>• {t('k53_b64454')} "{t('k54_f47999')}" {t('k55_129210')}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline"
                        onClick={() => {
                          // Auto-fill the transaction form from OCR data
                          setShowForm(true);
                          setFGrossAmount(String(amount || ''));
                          setFDescription(`${doc.file_name} — ${cpName}`);
                          if (ext.invoiceNumber) setFInvoiceNumber(String(ext.invoiceNumber));
                          if (ext.invoiceDate) setFTransactionDate(String(ext.invoiceDate));
                          // Try to find existing counterparty by name
                          const matchedCp = counterparties.find(c =>
                            c.name.toLowerCase().includes(cpName.toLowerCase()) ||
                            (c.npwp && cpNpwp && c.npwp === cpNpwp.replace(/\D/g, ''))
                          );
                          if (matchedCp) setFCounterparty(matchedCp.id);
                          showMsg('success', `"${cpName}" ${t('k56_ccb9ad')}`);
                        }}>
                        <ArrowRight className="h-3 w-3 mr-1" />{t('k39_7c6f9f')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NPWP missing transactions warning banner */}
      {transactions.filter(t => !t.counterparty_npwp).length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">
              NPWP {t('k57_9a67d8')} {t('countItems', { count: transactions.filter(tx => !tx.counterparty_npwp).length })} — {t('k58_1280cc')}
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {t('k59_a0ec00')}
              NPWP {t('k60_2c6b6c')}
            </p>
          </div>
        </div>
      )}

      {/* Add transaction form */}
      <Card className="mb-4">
        <CardContent className="p-4">
          {!showForm ? (
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowForm(true)} disabled={!customerId}>
                <Plus className="h-4 w-4 mr-1" />{t('k61_c0c4eb')}
              </Button>
              <p className="text-[11px] text-gray-400">{t('k62_cdba0c')}</p>
            </div>
          ) : (
            <form onSubmit={(e) => handleAddTransaction(e, false)} className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">{t('k63_b9054b')}</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{t('k64_587e34')} *</Label>
                  {counterparties.length > 0 ? (
                    <Select value={fCounterparty} onValueChange={setFCounterparty}>
                      <SelectTrigger><SelectValue placeholder={t('k65_7d5e07')} /></SelectTrigger>
                      <SelectContent>
                        {counterparties.map(cp => (
                          <SelectItem key={cp.id} value={cp.id}>
                            {cp.name} {cp.npwp ? '(' + cp.npwp + ')' : '(NPWP ' + t('k66_843812') + ')'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
                      {t('k67_73de21')}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="text-[11px] text-blue-600 hover:underline mt-1 flex items-center gap-1">
                    <Plus className="h-3 w-3" />{showQuickAdd ? t('k68_218e2a') : t('k69_9b168e')}
                  </button>

                  {/* Quick-add counterparty inline */}
                  {showQuickAdd && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                      <p className="text-[10px] font-medium text-blue-800">{t('k70_9bb911')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={qName} onChange={e => setQName(e.target.value)}
                          placeholder={t('k71_2e47c1') + ' *'} className="h-8 text-xs" />
                        <Input value={qNpwp} onChange={e => setQNpwp(e.target.value)}
                          placeholder={'NPWP (' + t('k72_906224')} className="h-8 text-xs font-mono" />
                      </div>
                      <Button type="button" size="sm" variant="outline" disabled={!qName || addingCp}
                        onClick={async () => {
                          setAddingCp(true);
                          try {
                            const res = await fetch('/api/counterparties', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                customerId,
                                name: qName,
                                npwp: qNpwp || undefined,
                                type: 'VENDOR',
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              // Reload counterparties and auto-select the new one
                              const cpRes = await fetch(`/api/counterparties?customerId=${customerId}`);
                              const cpData = await cpRes.json();
                              if (cpData.success) {
                                setCounterparties(cpData.data || []);
                                if (data.data?.id) setFCounterparty(data.data.id);
                              }
                              setQName('');
                              setQNpwp('');
                              setShowQuickAdd(false);
                              showMsg('success', `${t('k73_c81261')} "${qName}" ${t('k74_9230b3')}`);
                            } else {
                              showMsg('error', data.error || t('k75_71bfca'));
                            }
                          } catch { showMsg('error', t('k15_175c5f')); }
                          finally { setAddingCp(false); }
                        }}
                      >
                        {addingCp ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        {t('k76_212496')}
                      </Button>
                    </div>
                  )}

                  {fCounterparty && (() => {
                    const cp = counterparties.find(c => c.id === fCounterparty);
                    return cp && !cp.npwp ? (
                      <p className="text-[10px] text-red-600 mt-1">⚠️ NPWP {t('k77_127921')} — {t('k78_924a1b')}</p>
                    ) : null;
                  })()}
                </div>
                <div>
                  <Label className="text-xs">{t('k79_521c49')} *</Label>
                  <Select value={fServiceType} onValueChange={setFServiceType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map(st => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('k80_b6c7a9')} *</Label>
                  <Input type="number" value={fGrossAmount} onChange={e => setFGrossAmount(e.target.value)}
                    placeholder="100000000" className="font-mono" required />
                </div>
                <div>
                  <Label className="text-xs">{t('k81_ba7c2c')}</Label>
                  <Input type="date" value={fTransactionDate} onChange={e => setFTransactionDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t('k82_d6e98c')}</Label>
                  <Input value={fInvoiceNumber} onChange={e => setFInvoiceNumber(e.target.value)} placeholder="INV/2026/03/001" />
                </div>
                <div>
                  <Label className="text-xs">{t('k83_4c70f7')}</Label>
                  <Input value={fDescription} onChange={e => setFDescription(e.target.value)} placeholder={t('k84_7f8fca')} />
                </div>
              </div>

              {/* Service type note (variable rate info) */}
              {fServiceType && (
                <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>
                    <b>{SERVICE_TYPES.find(s => s.value === fServiceType)?.label}</b> —
                    {' '}{SERVICE_TYPES.find(s => s.value === fServiceType)?.note}
                  </span>
                </div>
              )}

              {/* Conditional context questions — shown based on service type */}
              {fServiceType === 'SEWA' && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200 space-y-2">
                  <p className="text-xs font-bold text-indigo-900">{t('k85_706372')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'BUILDING_LAND', label: t('k86_8a16d8'), note: 'PPh 4(2) Final 10%' },
                      { v: 'MACHINE', label: t('k87_5dc281'), note: 'PPh 23 2%' },
                      { v: 'VEHICLE', label: t('k88_22a345'), note: 'PPh 23 2%' },
                      { v: 'OTHER', label: t('k89_7f598d'), note: 'PPh 23 2%' },
                    ] as const).map(opt => (
                      <label key={opt.v}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                          fRentalAssetType === opt.v ? 'border-indigo-500 bg-white' : 'border-gray-200 bg-white/50'
                        }`}>
                        <input type="radio" checked={fRentalAssetType === opt.v}
                          onChange={() => setFRentalAssetType(opt.v)} />
                        <div>
                          <p className="font-medium">{opt.label}</p>
                          <p className="text-[10px] text-gray-500">{opt.note}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {fServiceType === 'BUNGA' && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200 space-y-2">
                  <p className="text-xs font-bold text-indigo-900">{t('k90_27795e')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'BANK_DEPOSIT', label: t('k91_4cec9d'), note: 'PPh Final 20%' },
                      { v: 'LOAN', label: t('k92_cbb863'), note: 'PPh 23 15%' },
                      { v: 'BOND', label: t('k93_8bf1a5'), note: 'PPh 23 15%' },
                      { v: 'OTHER', label: t('k94_7c2f39'), note: 'PPh 23 15%' },
                    ] as const).map(opt => (
                      <label key={opt.v}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                          fInterestSource === opt.v ? 'border-indigo-500 bg-white' : 'border-gray-200 bg-white/50'
                        }`}>
                        <input type="radio" checked={fInterestSource === opt.v}
                          onChange={() => setFInterestSource(opt.v)} />
                        <div>
                          <p className="font-medium">{opt.label}</p>
                          <p className="text-[10px] text-gray-500">{opt.note}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {fServiceType === 'DIVIDEN' && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 space-y-2">
                  <p className="text-xs font-bold text-purple-900">{t('k95_3ea292')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">{t('k96_06a3ac')} — {t('k97_3ed37a')}</Label>
                      <Input type="number" step="0.01" min="0" max="100"
                        value={fShareholdingOverride}
                        onChange={e => setFShareholdingOverride(e.target.value)}
                        placeholder={`{t('k98_81d783')}: ${counterparties.find(c => c.id === fCounterparty)?.shareholding_pct ?? t('k99_bfa691')}%`}
                        className="h-8 text-xs" />
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        {t('k100_831ae0')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px]">{t('k101_8519d2')}</Label>
                      <select value={fReinvestedOverride}
                        onChange={e => setFReinvestedOverride(e.target.value as '' | 'yes' | 'no')}
                        className="w-full h-8 px-2 rounded border text-xs">
                        <option value="">{t('k102_5e939b')}</option>
                        <option value="yes">{t('yesOption')} — {t('k103_fc0ca6')}</option>
                        <option value="no">{t('k104_b1e759')} — {t('k105_ee14ce')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax resolution preview — from server engine */}
              {resolvingTax && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />{t('k106_3d95f6')}
                </div>
              )}
              {!resolvingTax && resolutionPreview && fGrossAmount && (
                <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100">
                      <Calculator className="h-4 w-4 text-indigo-700" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className="bg-indigo-600 text-white text-[10px]">
                          {resolutionPreview.taxType.replace('PPh4_2', 'PPh 4(2)').replace('PPh', 'PPh ')}
                        </Badge>
                        {resolutionPreview.isFinal && (
                          <Badge className="bg-purple-600 text-white text-[10px]">Final</Badge>
                        )}
                        {resolutionPreview.npwpSurchargeApplied && (
                          <Badge className="bg-amber-600 text-white text-[10px]">NPWP {t('k107_7c649c')}</Badge>
                        )}
                        <span className="font-mono text-indigo-900 font-bold">
                          {(resolutionPreview.rate * 100).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-base font-bold text-indigo-900">
                        {t('k13_e2bf5c')} {fmtRp(resolutionPreview.taxAmount || Number(fGrossAmount) * resolutionPreview.rate)}
                      </p>
                      <p className="text-[11px] text-indigo-700 mt-1">
                        {t('k108_8b5175')}: {fmtRp(resolutionPreview.netAmount || Number(fGrossAmount) * (1 - resolutionPreview.rate))}
                      </p>
                      <div className="mt-2 p-2 bg-white/60 rounded border border-indigo-100">
                        <p className="text-indigo-900 font-medium">{resolutionPreview.reason}</p>
                        <p className="text-indigo-500 text-[10px] mt-0.5">📖 {resolutionPreview.legalBasis}</p>
                      </div>
                      {resolutionPreview.taxType === 'PPh26' && (
                        <p className="text-[10px] text-amber-700 mt-2">
                          ⚠ {t('k109_7382d2')} — Certificate of Domicile(CoD) {t('k110_0bc04e')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={fUseResolution} onChange={e => setFUseResolution(e.target.checked)}
                    className="accent-indigo-600" />
                  AI {t('k111_ecc3a2')}
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || !fCounterparty || !fGrossAmount}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  {t('btnSaveAndAdd')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !fCounterparty || !fGrossAmount}
                  onClick={() => handleAddTransaction(null, true)}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                  {t('btnSaveAndClose')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t('k113_d9de21')}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* e-Bupot generation */}
      {transactions.length > 0 && pendingBP > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-amber-800">
              <b>{t('countItems', { count: pendingBP })}</b>{t('k114_5cb06f')}
            </p>
          </div>
          <Button size="sm" onClick={handleGenerateBP} disabled={generatingBP}>
            {generatingBP ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
            e-Bupot {t('k115_2daf49')}
          </Button>
        </div>
      )}

      {/* Parsed withholding data table — always visible so users can preview the schema */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-sm">{t('parsedDataTitle')}</h3>
            {transactions.length > 0 && (
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t('statusNormal')}: <span className="font-bold">{t('countItems', { count: transactions.filter(tx => tx.counterparty_npwp).length })}</span>
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {t('statusNeedsCheck')}: <span className="font-bold">{t('countItems', { count: transactions.filter(tx => !tx.counterparty_npwp).length })}</span>
                </span>
              </div>
            )}
          </div>
          <div className="overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">No</th>
                  <th className="p-2 text-left">{t('colCounterparty')}</th>
                  <th className="p-2 text-left">NPWP</th>
                  <th className="p-2 text-left">{t('colTaxType')}</th>
                  <th className="p-2 text-left">{t('colTxType')}</th>
                  <th className="p-2 text-right">{t('colAmount')}</th>
                  <th className="p-2 text-right">{t('colRate')}</th>
                  <th className="p-2 text-center">{t('colStatus')}</th>
                  <th className="p-2 text-center">{t('colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-slate-400">
                      {t('parsedDataEmpty')}
                    </td>
                  </tr>
                )}
                  {transactions.map((tx, i) => {
                    const isForeign = !tx.counterparty_npwp;
                    return (
                      <tr key={tx.id} className={`border-t ${isForeign ? 'bg-red-50' : ''}`}>
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">
                          <div className="font-medium text-xs">{tx.counterparty_name}</div>
                          {isForeign && (
                            <div className="text-[9px] text-red-600 mt-0.5">
                              {t('foreignTag')}
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-mono text-[11px]">
                          {tx.counterparty_npwp || (
                            <span className="text-red-500 text-[10px]">{t('npwpMissing')}</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          <Badge className="text-[9px] bg-indigo-100 text-indigo-700">{tx.service_type}</Badge>
                        </td>
                        <td className="p-2 text-xs">
                          <Badge variant="outline" className="text-[9px]">{tx.service_type}</Badge>
                        </td>
                        <td className="p-2 text-right font-mono text-xs">{fmtRp(tx.gross_amount)}</td>
                        <td className="p-2 text-right font-mono text-xs text-emerald-700 font-bold">
                          {(tx.tax_rate * 100).toFixed(1)}%
                        </td>
                        <td className="p-2 text-center">
                          {isForeign ? (
                            <Badge className="text-[9px] bg-red-100 text-red-700">{t('dgtRequired')}</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-green-100 text-green-700">{t('statusNormal')}</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                          >
                            {t('colDetail')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          {transactions.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400">
              {t('totalCountLabel', { count: transactions.length })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {period} {t('k116_c663ec')} ({transactions.length}{t('k30_bcbcd4')}
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              {t('k117_0b6c6c')} "{t('k118_85e500')}" {t('k119_eeb60e')}
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const isExpanded = expandedTx === tx.id;
                return (
                  <div key={tx.id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{tx.counterparty_name}</span>
                            <Badge className="text-[9px] bg-indigo-100 text-indigo-700">{tx.service_type}</Badge>
                            {!tx.counterparty_npwp && <Badge className="text-[9px] bg-red-100 text-red-700">NO NPWP</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            <span>{tx.transaction_date}</span>
                            {tx.invoice_number && <span>· {tx.invoice_number}</span>}
                            {tx.bukti_potong_number && (
                              <Badge className="text-[9px] bg-green-100 text-green-700">{tx.bukti_potong_number}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <div className="text-right">
                          <p className="text-gray-500 text-[10px]">DPP</p>
                          <p className="font-mono">{fmtRp(tx.gross_amount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-600 text-[10px]">PPh {(tx.tax_rate * 100).toFixed(0)}%</p>
                          <p className="font-mono font-bold text-emerald-700">{fmtRp(tx.tax_amount)}</p>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t p-3 bg-gray-50/50 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">{t('k120_a55135')}</p>
                            <p className="font-mono">{tx.counterparty_npwp || t('k121_42b3cf')}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">{t('k122_6803af')}</p>
                            <p className="font-bold">{(tx.tax_rate * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">e-Bupot {t('k123_5ca2f7')}</p>
                            <p className="font-mono">{tx.bukti_potong_number || t('k124_ac6176')}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">e-Bupot {t('k125_2d95a4')}</p>
                            <p>{tx.bukti_potong_date || '-'}</p>
                          </div>
                        </div>
                        {tx.description && (
                          <div className="text-xs"><p className="text-gray-500">{t('k83_4c70f7')}</p><p>{tx.description}</p></div>
                        )}

                        {/* Tax determination reason */}
                        <div className="bg-indigo-50 rounded p-2 text-xs flex items-start gap-2">
                          <Shield className="h-3 w-3 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-indigo-900">{t('k126_90cd85')}</p>
                            <p className="text-indigo-700">
                              {tx.service_type} — {tx.counterparty_npwp ? t('k127_76ed88') : 'NPWP ' + t('k107_7c649c')} {t('k122_6803af')} {(tx.tax_rate * 100).toFixed(1)}%
                              {!tx.counterparty_npwp && ' (Pasal 23(1a) 100% ' + t('k128_dfd2b7')}
                            </p>
                            <p className="text-indigo-500 text-[10px]">Pasal 23 UU PPh / PMK 141/PMK.03/2015</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => handleDelete(tx.id)}>
                            <X className="h-3 w-3 mr-1" />{t('k129_30e15a')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom action bar (prototype: Excel download / Submit & Validate) */}
      {transactions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ['No', 'Counterparty', 'NPWP', 'Service Type', 'Gross Amount', 'Tax Rate', 'Tax Amount', 'Date', 'Invoice No', 'Bukti Potong No'];
              const rows = transactions.map((tx, i) => [
                String(i + 1),
                tx.counterparty_name || '',
                tx.counterparty_npwp || '',
                tx.service_type || '',
                String(tx.gross_amount || 0),
                String((tx.tax_rate || 0) * 100) + '%',
                String(tx.tax_amount || 0),
                tx.transaction_date || '',
                tx.invoice_number || '',
                tx.bukti_potong_number || '',
              ]);
              const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')), ''].join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `pph23_${period}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-3 w-3 mr-1" />{t('btnExcelDownload')}
          </Button>
          <Button
            size="sm"
            disabled={saving || transactions.length === 0}
            onClick={async () => {
              const needsCheckCount = transactions.filter(tx => !tx.counterparty_npwp).length;
              if (needsCheckCount > 0) {
                showMsg('error', t('statusNeedsCheck') + ': ' + needsCheckCount);
                return;
              }
              if (!customerId) return;
              setSaving(true);
              try {
                const res = await fetch('/api/tax/spt-masa', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ customerId, taxType: 'PPh23', period }),
                });
                const data = await res.json();
                if (data.success || data.sptMasa) {
                  showMsg('success', `SPT Masa PPh 23 ${t('k12_c05543')}`);
                  loadData();
                } else {
                  showMsg('error', data.message || data.error || `SPT Masa ${t('k14_5cf2ad')}`);
                }
              } catch {
                showMsg('error', t('k15_175c5f'));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            {t('btnSubmitValidate')}
          </Button>
        </div>
      )}


      {/* Month picker dialog — opens before any input action */}
      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('monthPickerTitle')}</DialogTitle>
            <DialogDescription>{t('monthPickerDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">{t('monthPickerYear')}</Label>
              <Select value={String(pickedYear)} onValueChange={v => setPickedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('monthPickerMonth')}</Label>
              <Select value={String(pickedMonth)} onValueChange={v => setPickedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthPickerOpen(false)}>
              {t('k113_d9de21')}
            </Button>
            <Button onClick={confirmMonthPicker}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {t('monthPickerConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Filing Steps Sub-component ──
function FilingSteps({
  customerId, period, transactions, summary, pendingBP, locale,
}: {
  customerId: string;
  period: string;
  transactions: Transaction[];
  summary: Summary;
  pendingBP: number;
  locale: string;
}) {
  const t = useTranslations('pph23Page');
  const [sptResult, setSptResult] = useState<{
    totalGrossIncome: number; totalTaxWithheld: number; itemCount: number;
    submissionDeadline: string; isOverdue: boolean; filingId?: string;
  } | null>(null);

  // Check current SPT Masa status on load (query tax_filing table directly)
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/tax/filings?customerId=${customerId}&taxType=PPh23&period=${period}&status=DRAFT`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const filings = d?.data || d?.filings || [];
        const existing = filings.find((f: { tax_type: string; tax_period: string }) =>
          f.tax_type === 'PPh23' && f.tax_period === period
        );
        if (existing?.tax_data?.spt_masa_result) {
          const r = existing.tax_data.spt_masa_result;
          setSptResult({
            totalGrossIncome: r.total_gross_income || 0,
            totalTaxWithheld: r.total_tax_withheld || 0,
            itemCount: r.item_count || 0,
            submissionDeadline: r.submission_deadline || '',
            isOverdue: false,
            filingId: existing.id,
          });
        }
      })
      .catch(() => {});
  }, [customerId, period]);

  const allBPGenerated = pendingBP === 0 && transactions.length > 0;
  const sptCreated = !!sptResult;

  // Step status
  const steps = [
    { id: 1, label: t('k130_e6ba7a'), done: transactions.length > 0, desc: t('countItems', { count: summary.transactionCount }) + ' · ' + fmtRp(summary.totalTax) },
    { id: 2, label: 'e-Bupot ' + t('k131_4169bb'), done: allBPGenerated, desc: allBPGenerated ? t('k132_c7b5eb') : `${pendingBP}{t('k133_c84140')}` },
    { id: 3, label: 'SPT Masa ' + t('k131_4169bb'), done: sptCreated, desc: sptCreated ? `{t('k134_df2337')} ${sptResult?.submissionDeadline?.substring(0, 10)}` : t('k124_ac6176') },
    { id: 4, label: t('k135_b303e6'), done: false, desc: t('k136_85d0f9') },
    { id: 5, label: 'DJP ' + t('k137_d6ed72'), done: false, desc: t('k138_48e2fc') },
  ];


  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-600" />
          {period} PPh 23 {t('k140_aa38cd')}
        </h3>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step.done ? <CheckCircle className="h-4 w-4" /> : step.id}
                </div>
                <p className={`text-[10px] mt-1 text-center font-medium ${step.done ? 'text-green-700' : 'text-gray-500'}`}>
                  {step.label}
                </p>
                <p className="text-[9px] text-gray-400 text-center">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-full ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Action buttons for current step */}
        <div className="space-y-3">
          {/* Step 2: e-Bupot — already handled above, just show status */}
          {!allBPGenerated && transactions.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>e-Bupot {t('k141_fbbdd4')} {pendingBP}{t('k142_004ba2')} "e-Bupot {t('k115_2daf49')}" {t('k143_b53d8b')}</span>
            </div>
          )}

          {/* Step 3 done → show SPT summary */}
          {sptCreated && sptResult && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-xs font-medium text-green-900">SPT Masa PPh 23 {t('k146_f3bc85')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-gray-500">{t('k147_235812')}</p><p className="font-mono font-bold">{fmtRp(sptResult.totalGrossIncome)}</p></div>
                <div><p className="text-gray-500">{t('k148_18ab52')}</p><p className="font-mono font-bold text-emerald-700">{fmtRp(sptResult.totalTaxWithheld)}</p></div>
                <div>
                  <p className="text-gray-500">{t('k149_d655cc')}</p>
                  <p className={sptResult.isOverdue ? 'text-red-600 font-bold' : ''}>
                    {sptResult.submissionDeadline?.substring(0, 10)}
                    {sptResult.isOverdue && ' (' + t('k150_26422a')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Payment link */}
          {sptCreated && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-indigo-600" />
                <div className="text-xs">
                  <p className="font-medium text-indigo-900">{t('k151_25e8b8')}</p>
                  <p className="text-indigo-700">ID Billing {t('k152_d85864')}</p>
                </div>
              </div>
              <a href={`/${locale}/tax/monthly-payments`}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                {t('k153_d76082')}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
