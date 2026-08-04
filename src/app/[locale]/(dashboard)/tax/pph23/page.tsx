'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { useBulkSelect } from '@/hooks/useBulkSelect';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Receipt, FileText, DollarSign, CheckCircle,
  AlertTriangle, Sparkles, X, ChevronDown, ChevronRight,
  Calculator, Shield, Camera,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { ScreenHeader } from '@/components/tax';
import { Download, FileSpreadsheet, Pencil, Clock } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { parseWHTOneSheet } from '@/lib/tax/bulk-import/wht-onesheet-parser';

// ── Types ──
interface Transaction {
  id: string;
  counterparty_name: string;
  counterparty_npwp: string | null;
  counterparty_address: string | null;
  service_type: string;
  description: string | null;
  notes: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  payment_date: string | null;
  transaction_date: string;
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  bukti_potong_number: string | null;
  bukti_potong_date: string | null;
  invoice_document_id?: string | null;
  // Resolution / regime metadata (read-only display)
  tax_regime?: string | null;
  income_type?: string | null;
  recipient_country?: string | null;
  treaty_applied?: boolean | null;
  is_final?: boolean | null;
  npwp_surcharge_applied?: boolean | null;
  rental_asset_type?: string | null;
  interest_source?: string | null;
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

  const isConsultant = session?.role === 'CONSULTANT' || session?.role === 'TAX_ADVISOR';

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
  // v19 §6 — 증빙 보기 전용 모달 (요청 모달과 분리).
  const [evidence, setEvidence] = useState<{
    loading: boolean;
    txId: string;
    signedUrl?: string;
    fileName?: string;
    mimeType?: string;
    counterpartyName?: string;
    invoiceNumber?: string;
    error?: string;
  } | null>(null);
  // Persistent breakdown of the last WHT one-sheet upload — survives until the
  // user dismisses it. Surfaces inserts that went to other tables (PPh4(2),
  // PPh26, PPN) which this page doesn't list, so users actually see the action.
  const [lastImport, setLastImport] = useState<{
    pph23: number; pph42: number; pph26: number; ppn: number;
    failed: number; period: string; at: number;
  } | null>(null);

  // CUSTOMER submit-request status — localStorage marker per (customerId, period).
  // SPT Masa 직접 생성 권한이 없는 CUSTOMER 가 "운영팀에 제출 요청" 을 누르면
  // 여기에 requestedAt 을 적어 두고, `filingExists` 가 true 가 되면 자동 정리.
  // 다기기 동기화는 옵션 B (서버 추적) 로 별도 작업 예정.
  const [submissionRequest, setSubmissionRequest] = useState<{ requestedAt: string } | null>(null);
  const [filingExists, setFilingExists] = useState(false);
  const reqStorageKey = customerId ? `sptRequest:PPh23:${customerId}:${period}` : '';
  // Per-row "just saved" indicator for inline edit affordance (mirrors
  // MonthlyPayslipTab.tsx). Cleared after 1.5s so the ✓ flash is transient.
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

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

  // Invoice image (mandatory for manual entry — Phase 4 simplification)
  const [invoiceImageFile, setInvoiceImageFile] = useState<File | null>(null);
  const invoiceImageInputRef = useRef<HTMLInputElement>(null);
  // Separate ref for the camera-capture path so mobile users get the camera
  // immediately, while the gallery/PC path stays available too.
  const invoiceImageCameraRef = useRef<HTMLInputElement>(null);

  // Phase 5 — per-row invoice photo attach (wholesale post-import) ---------
  // One pair of hidden inputs shared across all rows. pendingPhotoTxId
  // tracks which row triggered the input so handlePhotoPicked knows where
  // to POST the result.
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotoTxId = useRef<string | null>(null);

  // Quick-add counterparty
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qName, setQName] = useState('');
  const [qNpwp, setQNpwp] = useState('');
  const [addingCp, setAddingCp] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    // 성공만 자동 dismiss (5초). 에러는 사용자가 명시적으로 닫게 — 제출 실패는
    // 사용자가 인지하지 못한 채 사라지면 안 됨.
    if (type === 'success') {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Standard WHT one-sheet template (PPh23 + PPh4(2) + PPh26 + PPN MASUKAN
  // in one xlsx). Served from `public/templates/`, downloaded as a Blob so
  // the filename stays clean across browsers.
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
      showMsg('success', t('templateComingSoon'));
    } catch (err) {
      showMsg('error', `${t('templateDownloadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
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

  // CUSTOMER 제출 요청 + filing 존재 상태 동기화 (period / customer 변경 시).
  // 옵션 B (서버 추적) 우선: `/api/customer/spt-masa-request` 가 source of truth.
  // localStorage 는 다른 기기에서 로그인한 경우의 optimistic 보조 (서버 응답이
  // 도착하기 전에도 즉시 배너가 뜨도록).
  useEffect(() => {
    if (!customerId) {
      setSubmissionRequest(null);
      setFilingExists(false);
      return;
    }
    // 1. localStorage 마커 (optimistic).
    if (typeof window !== 'undefined' && reqStorageKey) {
      try {
        const raw = window.localStorage.getItem(reqStorageKey);
        if (raw) setSubmissionRequest(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    // 2. 서버 요청 row 조회 → reconcile.
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
          // 서버가 CANCELLED 면 localStorage 도 정리.
          if (typeof window !== 'undefined' && reqStorageKey) {
            window.localStorage.removeItem(reqStorageKey);
          }
          setSubmissionRequest(null);
        } else if (!row) {
          // 2026-06-22: 서버에 row 자체가 없으면 (wipe 또는 신규 customer 등)
          // localStorage 의 stale 마커 정리. 안 그러면 옛 요청 시간 배너가
          // 계속 표시됨.
          if (typeof window !== 'undefined' && reqStorageKey) {
            window.localStorage.removeItem(reqStorageKey);
          }
          setSubmissionRequest(null);
        }
        // PROCESSED 는 filing 조회 결과에 맡김 (아래).
      })
      .catch(() => { /* silent */ });
    // 3. filing 존재 여부.
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

  // Add transaction
  const handleAddTransaction = async (e: React.FormEvent | null, closeAfter: boolean = false) => {
    if (e) e.preventDefault();
    if (!customerId || !fCounterparty || !fGrossAmount) return;
    // Mandatory invoice image — Phase 4 manual entry rule
    if (!invoiceImageFile) {
      showMsg('error', t('invoiceImageRequired'));
      return;
    }
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
        // Upload invoice image (transaction is already saved; image is best-effort)
        try {
          const fd = new FormData();
          fd.append('file', invoiceImageFile);
          fd.append('customerId', customerId);
          fd.append('documentType', 'INVOICE');
          fd.append('uploadSource', 'WEB');
          fd.append('taxPeriod', period);
          const imgRes = await fetch('/api/documents/upload', { method: 'POST', body: fd });
          if (!imgRes.ok) {
            showMsg('error', t('invoiceImageUploadFailed'));
          } else {
            showMsg('success', `${t('k12_c05543')} — ${t('k13_e2bf5c')} ${fmtRp(data.data?.tax_amount || 0)}`);
          }
        } catch {
          showMsg('error', t('invoiceImageUploadFailed'));
        }
        // Always clear the per-transaction fields so the form is ready for the next entry.
        setFGrossAmount('');
        setFInvoiceNumber('');
        setFDescription('');
        setFShareholdingOverride('');
        setFReinvestedOverride('');
        setResolutionPreview(null);
        setInvoiceImageFile(null);
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

  // Forward the just-saved edit to the customer ↔ AI 상담원 chat thread
  // so the assigned operator sees the change inline in their inbox. Skipped
  // for consultants (their session role !== CUSTOMER → 403 either way) and
  // silently swallows failure — save UX must not depend on chat post.
  const forwardEditToOperator = async (
    txAfter: Transaction,
    updates: Record<string, unknown>,
  ) => {
    if (isConsultant) return;
    try {
      const tRes = await fetch('/api/customer-ai/threads/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextKind: 'PPH23', contextPeriod: period }),
      });
      if (!tRes.ok) return;
      const tj = await tRes.json().catch(() => ({}));
      const threadId = tj.data?.id;
      if (!threadId) return;

      const LABEL: Record<string, string> = {
        transactionDate: t('chatFieldDate'),
        counterpartyName: t('chatFieldCounterpartyName'),
        counterpartyNpwp: 'NPWP',
        grossAmount: 'DPP',
        serviceType: t('chatFieldServiceType'),
        description: t('chatFieldDescription'),
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
        t('chatEditTitle', {
          counterparty: txAfter.counterparty_name || t('chatEditCounterpartyFallback'),
          period,
        }),
        ...lines,
      ].join('\n');

      await fetch(`/api/customer-ai/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch {
      // silent
    }
  };

  // Inline edit — sends partial body to PUT /api/tax/pph23-transactions.
  // Server response is { success: true } (no row), so we merge sent values
  // into local state via snake_case mapping. gross/service edits also
  // trigger a refetch since the server recalculates tax_rate + tax_amount.
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
        if (updates.serviceType !== undefined) mapped.service_type = updates.serviceType;
        if (updates.counterpartyName !== undefined) mapped.counterparty_name = updates.counterpartyName as string;
        if (updates.counterpartyNpwp !== undefined) mapped.counterparty_npwp = (updates.counterpartyNpwp as string) || null;
        if (updates.description !== undefined) mapped.description = (updates.description as string) || null;
        if (updates.transactionDate !== undefined) mapped.transaction_date = updates.transactionDate as string;
        // 2026-06-26: 신규 컬럼들도 클라이언트 캐시에 머지 (refetch 안 해도 즉시 반영).
        if (updates.invoiceNumber !== undefined) mapped.invoice_number = (updates.invoiceNumber as string) || null;
        if (updates.invoiceDate !== undefined) mapped.invoice_date = (updates.invoiceDate as string) || null;
        if (updates.paymentDate !== undefined) mapped.payment_date = (updates.paymentDate as string) || null;
        if (updates.counterpartyAddress !== undefined) mapped.counterparty_address = (updates.counterpartyAddress as string) || null;
        if (updates.notes !== undefined) mapped.notes = (updates.notes as string) || null;
        if (updates.buktiPotongNumber !== undefined) mapped.bukti_potong_number = (updates.buktiPotongNumber as string) || null;
        if (updates.buktiPotongDate !== undefined) mapped.bukti_potong_date = (updates.buktiPotongDate as string) || null;
        const txAfter = transactions.find(t => t.id === id);
        setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...mapped } as Transaction : tx));
        setSavedAt(prev => ({ ...prev, [id]: Date.now() }));
        setTimeout(() => {
          setSavedAt(prev => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
        }, 1500);
        showMsg('success', t('savedToast'));
        // 저장 내용을 customer ↔ AI 상담원 chat thread 에도 게시 (fire-and-forget)
        if (txAfter) {
          void forwardEditToOperator({ ...txAfter, ...mapped } as Transaction, updates);
        }
        // grossAmount/serviceType 변경은 서버가 tax_rate + tax_amount 재계산 →
        // refetch 해야 새 세액이 화면에 반영됨.
        if (updates.grossAmount !== undefined || updates.serviceType !== undefined) {
          loadData();
        }
      } else {
        showMsg('error', t('saveFailed'));
      }
    } catch {
      showMsg('error', t('saveFailed'));
    }
  };

  // v19 §6 — 증빙 보기: 서명 URL 로 인보이스 사진/PDF 미리보기.
  const openEvidence = async (txId: string) => {
    setEvidence({ loading: true, txId });
    try {
      const res = await fetch(`/api/tax/pph23-transactions/${txId}/invoice-photo`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEvidence({ loading: false, txId, error: json.error || `HTTP ${res.status}` });
        return;
      }
      setEvidence({ loading: false, txId, ...json.data });
    } catch {
      setEvidence({ loading: false, txId, error: t('serverError') });
    }
  };

  // Phase 5 — per-row invoice photo attach (wholesale post-import) -------
  const triggerInvoiceCamera = (txId: string) => {
    pendingPhotoTxId.current = txId;
    photoCameraInputRef.current?.click();
  };
  const triggerInvoiceFile = (txId: string) => {
    pendingPhotoTxId.current = txId;
    photoFileInputRef.current?.click();
  };
  const handlePhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const txId = pendingPhotoTxId.current;
    e.target.value = ''; // reset so picking the same file again still fires
    if (!file || !txId) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/tax/pph23-transactions/${txId}/invoice-photo`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.data?.documentId) {
        // Optimistic local update so the ✓ replaces the ⚠ immediately.
        setTransactions(prev =>
          prev.map(t => (t.id === txId ? { ...t, invoice_document_id: data.data.documentId } : t)),
        );
        setSavedAt(prev => ({ ...prev, [txId]: Date.now() }));
        setTimeout(() => {
          setSavedAt(prev => {
            const n = { ...prev };
            delete n[txId];
            return n;
          });
        }, 1500);
        showMsg('success', t('invoiceUploadSuccess'));
      } else {
        showMsg('error', `${t('invoiceUploadFailed')}: ${data.error || res.status}`);
      }
    } catch (err) {
      showMsg('error', `${t('invoiceUploadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
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

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const pendingBP = transactions.filter(t => !t.bukti_potong_number).length;
  // 2026-06-24: 인보이스 사진 미첨부 거래 — 인도네시아 세무 실무상 모든 거래에 첨부 필수
  const pendingInvoice = transactions.filter(t => !t.invoice_document_id).length;
  // 2026-06-24: 일괄 선택 + 삭제
  const tBulk = useTranslations('bulk');
  const sel = useBulkSelect(transactions.map(tx => tx.id));
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkDelete = async () => {
    if (sel.selectedCount === 0) return;
    if (!confirm(tBulk('bulkDeleteConfirm', { count: sel.selectedCount }))) return;
    setBulkBusy(true);
    const ids = Array.from(sel.selectedIds);
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/tax/pph23-transactions?id=${id}`, { method: 'DELETE' })),
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    showMsg(fail === 0 ? 'success' : 'error',
      fail === 0
        ? tBulk('bulkDeleteDone', { count: ok })
        : tBulk('bulkDeletePartial', { ok, fail }));
    sel.clear();
    setBulkBusy(false);
    loadData();
  };
  const completedBP = transactions.filter(t => !!t.bukti_potong_number).length;

  // Document upload (csv only — file/camera removed in Phase 4 simplification)
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Month picker — opens before csv upload / manual entry
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'csv' | 'manual' | null>(null);
  const [pickedYear, setPickedYear] = useState<number>(currentYear);
  const [pickedMonth, setPickedMonth] = useState<number>(currentMonth);
  const [confirmedPeriod, setConfirmedPeriod] = useState<string | null>(null);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  // 2026-06-22: 업로드 방식 — PPN 페이지와 동일 패턴
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

  const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const openMonthPicker = (action: 'csv' | 'manual') => {
    setPendingAction(action);
    setMonthPickerOpen(true);
  };

  /**
   * 원천세 표준 템플릿 (WHT one-sheet) 일괄 업로드 — `/api/tax/wht-import`
   * 호출. 한 파일에 PPh23 / PPh4(2) / PPh26 / PPN MASUKAN 거래가 섞여
   * 있으면 서버가 자동 분기해 각 테이블에 insert.
   */
  const handleCsvImport = async (file: File | null, uploadPeriod?: string) => {
    if (!file || !customerId) return;
    const importPeriod = uploadPeriod || confirmedPeriod || period;
    if (!importPeriod) {
      showMsg('error', t('pickMonthFirst'));
      return;
    }
    setUploading(true);
    try {
      // 1. 파싱 — `parseWHTOneSheet` 가 JTC 21-col layout 을 분류·정규화.
      let summary;
      try {
        const buf = await file.arrayBuffer();
        summary = parseWHTOneSheet(buf);
      } catch (parseErr) {
        showMsg('error', t('wholesaleParseError', { reason: (parseErr as Error).message }));
        setUploading(false);
        return;
      }

      if (summary.totalRows === 0) {
        showMsg('error', t('wholesaleNoRowsImported', {
          skippedByTaxType: 0,
          skippedByValidation: 0,
        }));
        setUploading(false);
        return;
      }

      // 2. unknown 도 포함해 모든 파싱된 행을 서버로 전송. loose=true 로
      //    classified='unknown' 행도 placeholder ([UNCLASSIFIED]) 로 insert
      //    되도록 — 사용자가 페이지에서 직접 service_type 분류 + 검증은
      //    제출 시점에 처리하는 워크플로우.
      const rows = summary.rows.map((r) => ({ ...r, include: true }));

      const res = await fetch('/api/tax/wht-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxPeriod: importPeriod, rows, loose: true, mode: uploadMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showMsg('error', `${t('csvUploadFailed')} — ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      const d = data.data || {};
      const ipph23 = d.insertedPph23 ?? 0;
      const ipph42 = d.insertedPph42 ?? 0;
      const ipph26 = d.insertedPph26 ?? 0;
      const ippn = d.insertedPpn ?? 0;
      const iuncl = d.insertedUnclassified ?? 0;
      const totalInserted = ipph23 + ipph42 + ipph26 + ippn + iuncl;
      const skipNotice = iuncl > 0
        ? t('bulkUnclassifiedSuffix', { count: iuncl })
        : '';

      const failedRows = Array.isArray(d.failed) ? d.failed.length : 0;
      // Persist breakdown so the user can see inserts that went to other
      // tables (PPh4(2), PPh26, PPN) — this page only lists PPh23.
      setLastImport({
        pph23: ipph23, pph42: ipph42, pph26: ipph26, ppn: ippn,
        failed: failedRows, period: importPeriod, at: Date.now(),
      });
      // 2026-06-22: replace 모드에서 삭제된 행 수 표시
      const replacedMsg = uploadMode === 'replace' && (d.deleted ?? 0) > 0
        ? t('bulkReplacedSuffix', { deleted: d.deleted })
        : '';
      if (failedRows > 0) {
        const sample = (d.failed || []).slice(0, 3)
          .map((e: { rowNo: number; reason: string }) => `${t('csvRowPrefix', { row: e.rowNo })}: ${e.reason}`)
          .join(' / ');
        showMsg(
          'error',
          `${t('csvImportPartial', { inserted: totalInserted, total: rows.length, failed: failedRows, sample })}${(d.failed || []).length > 3 ? ' …' : ''}${skipNotice}${replacedMsg}`,
        );
      } else {
        showMsg('success', `${t('csvImportDone', { inserted: totalInserted, total: rows.length })}${skipNotice}${replacedMsg}`);
      }
      if (importPeriod !== period) setPeriod(importPeriod);
      loadData();
    } catch (err) {
      showMsg('error', `${t('csvProcessError')} — ${err instanceof Error ? err.message : t('unknownError')}`);
    } finally {
      setUploading(false);
    }
  };

  const confirmMonthPicker = () => {
    const newPeriod = periodLabel(pickedYear, pickedMonth);
    setConfirmedPeriod(newPeriod);
    setMonthPickerOpen(false);
    setTimeout(() => {
      if (pendingAction === 'csv') {
        csvInputRef.current?.click();
      } else if (pendingAction === 'manual') {
        setPeriod(newPeriod);
        setShowForm(true);
      }
    }, 50);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageTitle title="PPh 23" />
      {/* Phase 5 — hidden inputs for per-row invoice photo attach. Shared
          across all rows; pendingPhotoTxId.current routes the picked file
          to the right transaction. */}
      <input
        ref={photoCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoPicked}
      />
      <input
        ref={photoFileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handlePhotoPicked}
      />
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
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('inputModeUpload')}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{t('inputModeUploadDesc')}</p>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { void downloadTemplate(); }}
              >
                <Download className="h-3 w-3 mr-1" />{t('inputTemplateDownload')}
              </Button>
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => openMonthPicker('csv')}
                disabled={uploading || !customerId}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileSpreadsheet className="h-3 w-3 mr-1" />}
                {t('csvBulkUpload')}
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                className="hidden"
                accept=".csv,text/csv,.xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleCsvImport(f);
                  e.target.value = '';
                }}
              />
              {confirmedPeriod && pendingAction === 'csv' && (
                <p className="text-[10px] text-emerald-700 text-center">
                  {t('monthPickerSelected', { period: confirmedPeriod })}
                </p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                {t('uploadHint')}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">
                PPh 23 / PPh 4(2) / PPh 26 / PPh 15 / PPh 22
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Method 3: Manual (photo + direct entry) */}
        <Card className={`border-2 border-dashed ${showForm ? 'border-purple-400 shadow-sm' : 'border-purple-200 hover:border-purple-400 hover:shadow-sm'} transition-all`}>
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Camera className="h-5 w-5 text-purple-600" />
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
                <Camera className="h-3 w-3 mr-1" />{t('inputModeManualBtn')}
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
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div className="flex-1">{message.text}</div>
          {message.type === 'error' && (
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="ml-1 text-xs text-red-700 hover:text-red-900 underline"
              aria-label="dismiss"
            >
              {t('dismiss')}
            </button>
          )}
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

              {/* Mandatory invoice image — Phase 4 manual entry requires invoice photo */}
              <div className="space-y-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-4">
                <Label className="text-sm font-medium text-amber-900">
                  {t('invoiceImageLabel')} <span className="text-red-600">*</span>
                </Label>
                {/* Camera path: `capture` 속성으로 모바일은 카메라 즉시,
                    데스크톱은 파일 선택으로 fallback */}
                <input
                  ref={invoiceImageCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setInvoiceImageFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {/* File path: 갤러리/PDF 도 허용 */}
                <input
                  ref={invoiceImageInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setInvoiceImageFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {invoiceImageFile ? (
                  <div className="flex items-center gap-3">
                    {invoiceImageFile.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(invoiceImageFile)}
                        alt="invoice preview"
                        className="h-20 w-20 rounded border object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded border bg-white flex items-center justify-center">
                        <FileText className="h-8 w-8 text-amber-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-sm text-amber-900 truncate">{invoiceImageFile.name}</div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => invoiceImageCameraRef.current?.click()}
                      >
                        <Camera className="mr-1 h-3 w-3" />
                        {t('invoiceImageTakePhoto')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => invoiceImageInputRef.current?.click()}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {t('invoiceImagePickFile')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => invoiceImageCameraRef.current?.click()}
                      className="w-full border-amber-300 text-amber-900 hover:bg-amber-100"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {t('invoiceImageTakePhoto')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => invoiceImageInputRef.current?.click()}
                      className="w-full border-amber-300 text-amber-900 hover:bg-amber-100"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {t('invoiceImagePickFile')}
                    </Button>
                  </div>
                )}
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

      {/* 2026-06-24: 일괄 선택 삭제 액션 바 */}
      {sel.selectedCount > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between">
          <span className="text-xs text-slate-700">{tBulk('bulkSelectedN', { count: sel.selectedCount })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={sel.clear}>{tBulk('deselectAll')}</Button>
            <Button size="sm" variant="ghost" className="text-red-600 text-xs h-7" disabled={bulkBusy} onClick={bulkDelete}>
              {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
              {tBulk('bulkDelete')}
            </Button>
          </div>
        </div>
      )}

      {/* 2026-06-24: 인보이스 미첨부 경고 — 인도네시아 세무 실무상 모든 거래에 인보이스 첨부 필수 */}
      {transactions.length > 0 && pendingInvoice > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800">
            <b>{t('countItems', { count: pendingInvoice })}</b>{t('invoiceMissingWarnBody')}
          </p>
        </div>
      )}

      {/* SPT Masa 제출 상태 배너 — CUSTOMER 가 어디까지 왔는지 한눈에. */}
      {!isConsultant && customerId && (
        <>
          {filingExists ? (
            <Card className="mb-4 border-emerald-300 bg-emerald-50">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900">{t('sptSubmittedTitle', { period })}</p>
                  <p className="text-[11px] text-emerald-700">{t('sptSubmittedBody')}</p>
                </div>
              </CardContent>
            </Card>
          ) : submissionRequest ? (
            <Card className="mb-4 border-amber-300 bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-semibold text-amber-900">{t('sptPendingTitle', { period })}</p>
                  <p className="text-[11px] text-amber-700">
                    {t('sptPendingBody', { ts: new Date(submissionRequest.requestedAt).toLocaleString() })}
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
                    // 서버 row 도 CANCELLED 로 마크 (다기기 동기화).
                    void fetch(`/api/customer/spt-masa-request?taxType=PPh23&period=${period}`, {
                      method: 'DELETE',
                    }).catch(() => { /* silent */ });
                  }}
                >
                  {t('sptCancelRequest')}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* WHT one-sheet import result — persists until dismissed so users see
          inserts that went to tables this page doesn't list (PPh4(2)/PPh26/PPN). */}
      {lastImport && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm text-emerald-900">
                    {t('bulkUploadDoneTitle', { period: lastImport.period })}
                  </h3>
                  <span className="text-[10px] text-emerald-700">
                    {new Date(lastImport.at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Link href={`/${locale}/tax/pph23`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPh 23</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.pph23}</p>
                  </Link>
                  <Link href={`/${locale}/tax/pph42`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPh 4(2)</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.pph42}</p>
                  </Link>
                  <Link href={`/${locale}/tax/pph26`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPh 26</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.pph26}</p>
                  </Link>
                  <Link href={`/${locale}/tax/ppn`} className="rounded border border-emerald-200 bg-white px-3 py-2 hover:border-emerald-400 transition-colors">
                    <p className="text-[10px] text-gray-500">PPN MASUKAN</p>
                    <p className="font-mono font-bold text-emerald-700">{lastImport.ppn}</p>
                  </Link>
                </div>
                {lastImport.failed > 0 && (
                  <p className="mt-2 text-[11px] text-red-600">
                    {t('bulkUploadFailedLine', { failed: lastImport.failed })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-700 hover:text-emerald-900"
                onClick={() => setLastImport(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
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
                  <th className="p-2 text-center w-8">
                    {transactions.length > 0 && (
                      <input
                        type="checkbox"
                        checked={sel.isAllSelected}
                        ref={el => { if (el) el.indeterminate = sel.isPartiallySelected; }}
                        onChange={sel.toggleAll}
                      />
                    )}
                  </th>
                  <th className="p-2 text-left">No</th>
                  <th className="p-2 text-left">{t('colCounterparty')}</th>
                  <th className="p-2 text-left">NPWP</th>
                  <th className="p-2 text-left">{t('colTaxType')}</th>
                  <th className="p-2 text-left">{t('colTxType')}</th>
                  <th className="p-2 text-right">{t('colAmount')}</th>
                  <th className="p-2 text-right">{t('colRate')}</th>
                  <th className="p-2 text-center">{t('colStatus')}</th>
                  <th className="p-2 text-center w-12">{t('colInvoicePhoto')}</th>
                  <th className="p-2 text-center">{t('colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-sm text-slate-400">
                      {t('parsedDataEmpty')}
                    </td>
                  </tr>
                )}
                  {transactions.map((tx, i) => {
                    const isForeign = !tx.counterparty_npwp;
                    const isExpanded = expandedTx === tx.id;
                    return (
                      <Fragment key={tx.id}>
                        <tr className={`border-t ${isForeign ? 'bg-red-50' : ''} ${isExpanded ? 'bg-blue-50/40' : ''} ${sel.isSelected(tx.id) ? 'ring-2 ring-red-200' : ''}`}>
                          <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={sel.isSelected(tx.id)}
                              onChange={() => sel.toggle(tx.id)}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {!tx.invoice_document_id && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-red-500 flex-shrink-0"
                                  aria-label={t('invoiceMissingAria')}
                                />
                              )}
                              <div className="font-medium text-xs">{tx.counterparty_name}</div>
                            </div>
                            {isForeign && (
                              <div className="text-[9px] text-red-600 mt-0.5">
                                {t('foreignTag')}
                              </div>
                            )}
                            {!tx.invoice_document_id && (
                              <div className="text-[9px] text-red-600 mt-0.5">
                                {t('invoiceMissingBadge')}
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
                            {tx.invoice_document_id ? (
                              <button
                                type="button"
                                onClick={() => openEvidence(tx.id)}
                                className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 hover:underline"
                                title={t('viewEvidence')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            ) : (
                              <details className="inline-block relative">
                                <summary
                                  className="cursor-pointer inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-[11px] list-none"
                                  title={t('invoiceMissing')}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <Camera className="h-3.5 w-3.5" />
                                </summary>
                                <div className="absolute right-0 mt-1 z-10 bg-white border border-amber-200 rounded shadow-lg p-2 w-44 text-left">
                                  <button
                                    type="button"
                                    onClick={() => triggerInvoiceCamera(tx.id)}
                                    className="block w-full text-left px-2 py-1.5 text-xs text-amber-900 hover:bg-amber-50 rounded"
                                  >
                                    📷 {t('invoiceImageTakePhoto')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => triggerInvoiceFile(tx.id)}
                                    className="block w-full text-left px-2 py-1.5 text-xs text-amber-900 hover:bg-amber-50 rounded"
                                  >
                                    📄 {t('invoiceImagePickFile')}
                                  </button>
                                </div>
                              </details>
                            )}
                          </td>
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
                            <td colSpan={11} className="p-3">
                              <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900 flex items-center gap-2 mb-3">
                                <Pencil className="h-3.5 w-3.5 shrink-0" />
                                <span>{t('editBanner')}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('editFieldDate')}</Label>
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
                                  <Label className="text-[10px] text-gray-400">DPP ({t('colAmount')})</Label>
                                  <NumberInput
                                    className="h-8 text-xs font-mono"
                                    value={tx.gross_amount}
                                    onCommit={newVal => {
                                      if (Number.isFinite(newVal) && newVal !== tx.gross_amount) {
                                        updateTransaction(tx.id, {
                                          grossAmount: newVal,
                                          serviceType: tx.service_type,
                                          counterpartyNpwp: tx.counterparty_npwp ?? '',
                                        });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('colTaxType')}</Label>
                                  <select
                                    className="h-8 text-xs w-full rounded border border-gray-300 px-2 bg-white"
                                    defaultValue={tx.service_type}
                                    onBlur={e => {
                                      if (e.target.value !== tx.service_type) {
                                        updateTransaction(tx.id, {
                                          serviceType: e.target.value,
                                          grossAmount: tx.gross_amount,
                                          counterpartyNpwp: tx.counterparty_npwp ?? '',
                                        });
                                      }
                                    }}
                                  >
                                    {SERVICE_TYPES.map(s => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('labelInvoiceNumber')}</Label>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    defaultValue={tx.invoice_number ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.invoice_number ?? '')) {
                                        updateTransaction(tx.id, { invoiceNumber: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('labelInvoiceDate')}</Label>
                                  <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    defaultValue={tx.invoice_date ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.invoice_date ?? '')) {
                                        updateTransaction(tx.id, { invoiceDate: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">{t('labelPaymentDate')}</Label>
                                  <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    defaultValue={tx.payment_date ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.payment_date ?? '')) {
                                        updateTransaction(tx.id, { paymentDate: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Label className="text-[10px] text-gray-400">{t('editFieldDescription')}</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    defaultValue={tx.description ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.description ?? '')) {
                                        updateTransaction(tx.id, { description: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Label className="text-[10px] text-gray-400">{t('labelCounterpartyAddress')}</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    defaultValue={tx.counterparty_address ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.counterparty_address ?? '')) {
                                        updateTransaction(tx.id, { counterpartyAddress: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Label className="text-[10px] text-gray-400">{t('labelNotes')}</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    defaultValue={tx.notes ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.notes ?? '')) {
                                        updateTransaction(tx.id, { notes: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">Bukti Potong No</Label>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    defaultValue={tx.bukti_potong_number ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.bukti_potong_number ?? '')) {
                                        updateTransaction(tx.id, { buktiPotongNumber: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-gray-400">Bukti Potong Date</Label>
                                  <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    defaultValue={tx.bukti_potong_date ?? ''}
                                    onBlur={e => {
                                      if (e.target.value !== (tx.bukti_potong_date ?? '')) {
                                        updateTransaction(tx.id, { buktiPotongDate: e.target.value });
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {/* Resolution / regime read-only badges */}
                              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-200 mt-3">
                                {tx.tax_regime && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Regime: {tx.tax_regime}
                                  </Badge>
                                )}
                                {tx.income_type && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Income: {tx.income_type}
                                  </Badge>
                                )}
                                {tx.recipient_country && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Country: {tx.recipient_country}
                                  </Badge>
                                )}
                                {tx.treaty_applied && (
                                  <Badge className="text-[10px] bg-blue-100 text-blue-700">Treaty applied</Badge>
                                )}
                                {tx.is_final && (
                                  <Badge className="text-[10px] bg-purple-100 text-purple-700">Final tax</Badge>
                                )}
                                {tx.npwp_surcharge_applied && (
                                  <Badge className="text-[10px] bg-red-100 text-red-700">+100% (no NPWP)</Badge>
                                )}
                                {tx.rental_asset_type && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Asset: {tx.rental_asset_type}
                                  </Badge>
                                )}
                                {tx.interest_source && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Source: {tx.interest_source}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-3 border-t border-gray-200 mt-3">
                                <div>
                                  <p className="text-gray-500">{t('k122_6803af')}</p>
                                  <p className="font-bold">{(tx.tax_rate * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">PPh {t('k13_e2bf5c')}</p>
                                  <p className="font-mono font-bold text-emerald-700">{fmtRp(tx.tax_amount)}</p>
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
                              <div className="bg-indigo-50 rounded p-2 text-xs flex items-start gap-2 mt-3">
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
                              <div className="flex gap-2 pt-2 mt-2">
                                <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => handleDelete(tx.id)}>
                                  <X className="h-3 w-3 mr-1" />{t('k129_30e15a')}
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
          {transactions.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400">
              {t('totalCountLabel', { count: transactions.length })}
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
                // 고객(CUSTOMER) 은 hard rule #3 (Tax Filing Actor ≠ Platform) 에
                // 의해 SPT Masa 직접 생성 권한이 없음. 대신 customer ↔ AI 상담원
                // chat 으로 제출 요청을 보내고, 운영팀(consultant) 이 확인 후 진짜
                // filing 생성. consultant 세션은 기존대로 직접 POST.
                if (!isConsultant) {
                  const totalGross = transactions.reduce((s, tx) => s + Number(tx.gross_amount), 0);
                  const totalTax = transactions.reduce((s, tx) => s + Number(tx.tax_amount), 0);
                  const tRes = await fetch('/api/customer-ai/threads/find-or-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contextKind: 'PPH23', contextPeriod: period }),
                  });
                  const tj = await tRes.json().catch(() => ({}));
                  const threadId = tj.data?.id;
                  if (!threadId) {
                    showMsg('error', t('sptRetryHint'));
                    return;
                  }
                  const content = [
                    t('chatSubmitTitle', { period }),
                    t('chatSubmitLineCount', { count: transactions.length }),
                    t('chatSubmitLineDpp', { amount: totalGross.toLocaleString('id-ID') }),
                    t('chatSubmitLinePph', { amount: totalTax.toLocaleString('id-ID') }),
                    t('chatSubmitLineFooter'),
                  ].join('\n');
                  const mRes = await fetch(`/api/customer-ai/threads/${threadId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }),
                  });
                  if (mRes.ok) {
                    showMsg('success', t('submitToOperatorSent', { count: transactions.length }));
                    // localStorage 마커 + 화면 상태 즉시 갱신 (optimistic).
                    const stamp = { requestedAt: new Date().toISOString() };
                    if (typeof window !== 'undefined' && reqStorageKey) {
                      try { window.localStorage.setItem(reqStorageKey, JSON.stringify(stamp)); } catch { /* quota */ }
                    }
                    setSubmissionRequest(stamp);
                    // 서버 추적 row upsert — 다기기 동기화 source of truth.
                    void fetch('/api/customer/spt-masa-request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ taxType: 'PPh23', period, threadId }),
                    }).catch(() => { /* silent — localStorage 만으로도 동작 */ });
                  } else {
                    showMsg('error', t('sptRetryHint'));
                  }
                  return;
                }
                // Consultant: 기존 직접 생성 흐름.
                const res = await fetch('/api/tax/spt-masa', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ customerId, taxType: 'PPh23', period }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success === true) {
                  showMsg(
                    'success',
                    `SPT Masa PPh 23 ${t('k12_c05543')} (filing ${data.filingId?.slice(0, 8) ?? ''}, ${t('sptOpsQueueRegistered')})`,
                  );
                  loadData();
                } else {
                  const detail = data.message || data.error || `HTTP ${res.status}`;
                  showMsg(
                    'error',
                    `SPT Masa ${t('k14_5cf2ad')} — ${detail}. ${t('sptRetryHint')}`,
                  );
                }
              } catch (err) {
                const detail = err instanceof Error ? err.message : t('networkError');
                showMsg(
                  'error',
                  `${t('k15_175c5f')} — ${detail}. ${t('internetCheckHint')}`,
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            {isConsultant ? t('btnSubmitValidate') : t('submitToOperator')}
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
          {/* 2026-06-22: 업로드 방식 — csv 일괄 업로드일 때만 (manual entry 는 행 단위) */}
          {pendingAction === 'csv' && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-semibold">{t('uploadMode')}</Label>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="uploadMode"
                    className="mt-0.5"
                    checked={uploadMode === 'replace'}
                    onChange={() => setUploadMode('replace')}
                  />
                  <div>
                    <span className="font-semibold">{t('uploadModeReplaceLabel')}</span>
                    <span className="block text-[10px] text-gray-500">{t('uploadModeReplaceDesc')}</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="uploadMode"
                    className="mt-0.5"
                    checked={uploadMode === 'append'}
                    onChange={() => setUploadMode('append')}
                  />
                  <div>
                    <span className="font-semibold">{t('uploadModeAppendLabel')}</span>
                    <span className="block text-[10px] text-gray-500">{t('uploadModeAppendDesc')}</span>
                  </div>
                </label>
              </div>
            </div>
          )}
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

      {/* v19 §6 — 증빙 보기 전용 모달 */}
      {evidence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEvidence(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('evidenceModalTitle')}</h2>
                {(evidence.counterpartyName || evidence.invoiceNumber) && (
                  <p className="text-xs text-gray-500">
                    {evidence.counterpartyName}{evidence.invoiceNumber ? ` · ${evidence.invoiceNumber}` : ''}
                  </p>
                )}
              </div>
              <button className="text-gray-400 hover:text-gray-700" onClick={() => setEvidence(null)}>✕</button>
            </div>
            <div className="p-5">
              {evidence.loading ? (
                <div className="py-16 text-center text-sm text-gray-400">{t('loading')}</div>
              ) : evidence.error ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-14 text-center text-sm text-gray-400">
                  {evidence.error === 'no invoice photo attached' ? t('evidenceNone') : evidence.error}
                </div>
              ) : evidence.signedUrl ? (
                <div className="space-y-3">
                  {evidence.mimeType?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evidence.signedUrl} alt={evidence.fileName || 'invoice'} className="mx-auto max-h-[60vh] rounded-lg object-contain" />
                  ) : evidence.mimeType === 'application/pdf' ? (
                    <iframe src={evidence.signedUrl} title="invoice" className="h-[60vh] w-full rounded-lg border" />
                  ) : (
                    <p className="text-sm text-gray-500">{evidence.fileName}</p>
                  )}
                  <a
                    href={evidence.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    {t('evidenceOpenNewTab')} ↗
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
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
              <span>e-Bupot {t('k141_fbbdd4')} {pendingBP}{t('k142_004ba2')} &ldquo;e-Bupot {t('k115_2daf49')}&rdquo; {t('k143_b53d8b')}</span>
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
              <Link href={`/${locale}/tax/monthly-payments`}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                {t('k153_d76082')}
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
