'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Plus, Receipt, FileText, DollarSign, CheckCircle,
  AlertTriangle, Download, Sparkles, X, ChevronDown, ChevronRight,
  Calculator, Shield, Upload, Camera, Image, ArrowRight,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

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
  has_cod: boolean | null;
  vendor_is_property_owner: boolean | null;
  is_related_party: boolean | null;
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
const SERVICE_TYPES: Array<{ value: string; label: string; note: string }> = [
  { value: 'DIVIDEN', label: '배당 (Dividen)', note: '국적·지분율·재투자에 따라 0%~20%' },
  { value: 'BUNGA', label: '이자 (Bunga)', note: 'PPh 23 15% 또는 treaty rate' },
  { value: 'ROYALTI', label: '로열티 (Royalti)', note: 'PPh 23 15% 또는 treaty rate' },
  { value: 'HADIAH', label: '상금 (Hadiah/Penghargaan)', note: 'PPh 23 15%' },
  { value: 'SEWA', label: '임대 (Sewa)', note: '건물/토지→PPh 4(2) 10%, 기계→PPh 23 2%' },
  { value: 'JASA_TEKNIK', label: '기술 서비스 (Jasa Teknik)', note: 'PPh 23 2%' },
  { value: 'JASA_MANAJEMEN', label: '경영 서비스 (Jasa Manajemen)', note: 'PPh 23 2%' },
  { value: 'JASA_KONSULTAN', label: '컨설팅 (Jasa Konsultan)', note: 'PPh 23 2%' },
  { value: 'JASA_LAINNYA', label: '기타 서비스 (Jasa Lainnya)', note: 'PPh 23 2%' },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function PPh23Page() {
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
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `거래 추가 완료 — 세액 ${fmtRp(data.data?.tax_amount || 0)}`);
        setFGrossAmount('');
        setFInvoiceNumber('');
        setFDescription('');
        setResolutionPreview(null);
        loadData();
      } else {
        showMsg('error', data.error || '추가 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSaving(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id: string) => {
    if (!confirm('거래를 삭제하시겠습니까?')) return;
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
        showMsg('success', `e-Bupot ${data.data?.generated || 0}건 생성 완료`);
        loadData();
      } else {
        showMsg('error', data.error || 'e-Bupot 생성 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
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
  }, [fCounterparty, fServiceType, fGrossAmount, fTransactionDate, fDescription, fUseResolution, counterparties]);

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
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string; file_name: string; document_type: string; ocr_status: string;
    ocr_result?: { extractedData?: Record<string, unknown>; confidence?: number };
    created_at: string;
  }>>([]);
  const [uploading, setUploading] = useState(false);

  // Load documents for this period
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/documents?customerId=${customerId}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUploadedDocs(d.data || []); })
      .catch(() => {});
  }, [customerId, period, transactions]);

  const handleDocUpload = async (files: FileList | null) => {
    if (!files || !customerId) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      fd.append('documentType', 'INVOICE');
      fd.append('uploadSource', 'WEB');
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
      showMsg('success', `${count}건 업로드 완료. OCR 처리 중...`);
      setTimeout(() => {
        fetch(`/api/documents?customerId=${customerId}&period=${period}`)
          .then(r => r.json())
          .then(d => { if (d.success) setUploadedDocs(d.data || []); })
          .catch(() => {});
      }, 2000);
    }
    setUploading(false);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-emerald-600" />
          원천세 PPh 23 / PPh 4(2)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          거래 입력 → 자동 세액 계산 → e-Bupot 생성 → SPT Masa 제출
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isConsultant && (
          <div>
            <Label className="text-xs">고객</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="고객 선택" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">기간</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
          <p className="text-[10px] text-gray-500">거래 건수</p>
          <p className="text-xl font-bold">{summary.transactionCount}건</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">총 지급액</p>
          <p className="text-sm font-bold font-mono">{fmtRp(summary.totalGross)}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500"><CardContent className="p-3">
          <p className="text-[10px] text-emerald-600">원천징수 세액 합계</p>
          <p className="text-sm font-bold font-mono text-emerald-700">{fmtRp(summary.totalTax)}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">e-Bupot</p>
          <p className="text-sm font-bold">
            <span className="text-green-600">{completedBP}</span>
            {pendingBP > 0 && <span className="text-amber-600"> / {pendingBP} 대기</span>}
          </p>
        </CardContent></Card>
      </div>

      {/* Document upload section */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" />
              증빙 자료 ({uploadedDocs.length}건)
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !customerId}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                파일 업로드
              </Button>
              {cameraAvailable && (
                <Button size="sm" variant="outline" disabled={uploading || !customerId}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = (e) => handleDocUpload((e.target as HTMLInputElement).files);
                    input.click();
                  }}>
                  <Camera className="h-3 w-3 mr-1" />촬영
                </Button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv" multiple
                onChange={e => handleDocUpload(e.target.files)} />
            </div>
          </div>

          {uploadedDocs.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 border-2 border-dashed rounded-lg">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>인보이스, 영수증, Faktur Pajak 등 증빙을 업로드하세요</p>
              <p className="text-[10px] mt-1">OCR이 자동으로 금액/거래처 정보를 추출합니다</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {uploadedDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded border text-xs hover:bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={
                      doc.ocr_status === 'COMPLETED' ? 'text-[8px] bg-green-100 text-green-700' :
                      doc.ocr_status === 'PROCESSING' ? 'text-[8px] bg-blue-100 text-blue-700' :
                      'text-[8px] bg-gray-100 text-gray-600'
                    }>
                      {doc.ocr_status === 'COMPLETED' ? 'OCR완료' : doc.ocr_status === 'PROCESSING' ? '처리중' : '대기'}
                    </Badge>
                    <span className="truncate">{doc.file_name}</span>
                    {doc.ocr_result?.confidence && (
                      <span className="text-[9px] text-gray-400">{(doc.ocr_result.confidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  {doc.ocr_status === 'COMPLETED' && doc.ocr_result?.extractedData && (
                    <div className="flex items-center gap-2 text-[10px] text-green-700 flex-shrink-0">
                      <Sparkles className="h-3 w-3" />
                      {Object.entries(doc.ocr_result.extractedData).slice(0, 2).map(([k, v]) => (
                        <span key={k}>{k}: {typeof v === 'number' ? fmtRp(v) : String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR → Auto-create transactions + NPWP validation + DGT Form */}
      {uploadedDocs.filter(d => d.ocr_status === 'COMPLETED' && d.ocr_result?.extractedData).length > 0 && (
        <Card className="mb-4 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              AI 인식 결과 → 거래 자동 생성
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              업로드한 인보이스/Faktur Pajak에서 추출한 정보입니다. 확인 후 "거래로 추가"를 클릭하세요.
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
                          <span className="font-medium">{cpName || '거래처 불명'}</span>
                          {hasNpwp && <Badge className="text-[8px] bg-green-100 text-green-700">NPWP ✓</Badge>}
                          {!hasNpwp && !isForeign && <Badge className="text-[8px] bg-red-100 text-red-700">NPWP 없음!</Badge>}
                          {isForeign && <Badge className="text-[8px] bg-amber-100 text-amber-700">국외</Badge>}
                        </div>
                        {hasNpwp && <p className="font-mono text-[10px] text-gray-500">{cpNpwp}</p>}
                        {amount > 0 && <p className="font-mono">DPP: {fmtRp(amount)}</p>}
                        <p className="text-[10px] text-gray-400">{doc.file_name}</p>

                        {/* NPWP missing warning — domestic company */}
                        {!hasNpwp && !isForeign && (
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200 text-[10px] text-red-800">
                            <p className="font-bold">⚠️ NPWP 필수 — 국내 기업은 반드시 NPWP가 있어야 합니다</p>
                            <p className="mt-0.5">거래처에 NPWP를 요청하세요. NPWP 없이 거래를 등록하면 세율이 2배(100% 할증) 적용됩니다.</p>
                          </div>
                        )}

                        {/* Foreign company — DGT Form required */}
                        {isForeign && (
                          <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800">
                            <p className="font-bold">🌍 국외 거래 — Tax Treaty 적용 시 추가 서류 필요</p>
                            <ul className="mt-0.5 space-y-0.5">
                              <li>• <b>DGT Form</b> (Directorate General of Taxes) — 조세조약 세율 적용 필수 서류</li>
                              <li>• <b>해외 거주자 증명 (Certificate of Domicile / SKD)</b> — 상대국 세무당국 발급</li>
                              <li>• 위 서류 없이는 PPh 26 표준 세율(20%) 적용</li>
                              <li>• 서류는 "자료 업로드" 메뉴에서 업로드해 주세요</li>
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
                          showMsg('success', `"${cpName}" 거래 정보가 자동 입력되었습니다. 확인 후 저장하세요.`);
                        }}>
                        <ArrowRight className="h-3 w-3 mr-1" />거래로 추가
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
              NPWP 미등록 거래 {transactions.filter(t => !t.counterparty_npwp).length}건 — 세율 2배 할증 적용 중
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              인도네시아 국내 기업은 모두 NPWP를 보유하고 있습니다. 거래처에 NPWP를 요청하여 업데이트하세요.
              NPWP 미등록 시 PPh 23 세율이 2%→4%, 15%→30%로 가산됩니다 (Pasal 23(1a)).
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
                <Plus className="h-4 w-4 mr-1" />수동 거래 추가
              </Button>
              <p className="text-[11px] text-gray-400">인보이스를 업로드하면 위에서 자동으로 거래 정보가 추출됩니다</p>
            </div>
          ) : (
            <form onSubmit={handleAddTransaction} className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">새 거래 입력</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">거래 상대방 *</Label>
                  {counterparties.length > 0 ? (
                    <Select value={fCounterparty} onValueChange={setFCounterparty}>
                      <SelectTrigger><SelectValue placeholder="거래처 선택" /></SelectTrigger>
                      <SelectContent>
                        {counterparties.map(cp => (
                          <SelectItem key={cp.id} value={cp.id}>
                            {cp.name} {cp.npwp ? `(${cp.npwp})` : '(NPWP 없음)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
                      등록된 거래처가 없습니다. 아래에서 빠르게 추가하세요.
                    </div>
                  )}
                  <button type="button" onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="text-[11px] text-blue-600 hover:underline mt-1 flex items-center gap-1">
                    <Plus className="h-3 w-3" />{showQuickAdd ? '닫기' : '새 거래처 빠른 등록'}
                  </button>

                  {/* Quick-add counterparty inline */}
                  {showQuickAdd && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                      <p className="text-[10px] font-medium text-blue-800">거래처 빠른 등록</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={qName} onChange={e => setQName(e.target.value)}
                          placeholder="회사명 *" className="h-8 text-xs" />
                        <Input value={qNpwp} onChange={e => setQNpwp(e.target.value)}
                          placeholder="NPWP (선택)" className="h-8 text-xs font-mono" />
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
                              showMsg('success', `거래처 "${qName}" 등록 완료`);
                            } else {
                              showMsg('error', data.error || '등록 실패');
                            }
                          } catch { showMsg('error', '서버 오류'); }
                          finally { setAddingCp(false); }
                        }}
                      >
                        {addingCp ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        등록
                      </Button>
                    </div>
                  )}

                  {fCounterparty && (() => {
                    const cp = counterparties.find(c => c.id === fCounterparty);
                    return cp && !cp.npwp ? (
                      <p className="text-[10px] text-red-600 mt-1">⚠️ NPWP 미보유 — 세율 2배 할증</p>
                    ) : null;
                  })()}
                </div>
                <div>
                  <Label className="text-xs">거래 유형 *</Label>
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
                  <Label className="text-xs">총 지급액 (DPP) *</Label>
                  <Input type="number" value={fGrossAmount} onChange={e => setFGrossAmount(e.target.value)}
                    placeholder="100000000" className="font-mono" required />
                </div>
                <div>
                  <Label className="text-xs">거래일</Label>
                  <Input type="date" value={fTransactionDate} onChange={e => setFTransactionDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">인보이스 번호</Label>
                  <Input value={fInvoiceNumber} onChange={e => setFInvoiceNumber(e.target.value)} placeholder="INV/2026/03/001" />
                </div>
                <div>
                  <Label className="text-xs">설명</Label>
                  <Input value={fDescription} onChange={e => setFDescription(e.target.value)} placeholder="거래 내용" />
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

              {/* Tax resolution preview — from server engine */}
              {resolvingTax && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />세율 계산 중...
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
                          <Badge className="bg-amber-600 text-white text-[10px]">NPWP 미보유 할증</Badge>
                        )}
                        <span className="font-mono text-indigo-900 font-bold">
                          {(resolutionPreview.rate * 100).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-base font-bold text-indigo-900">
                        세액 {fmtRp(resolutionPreview.taxAmount || Number(fGrossAmount) * resolutionPreview.rate)}
                      </p>
                      <p className="text-[11px] text-indigo-700 mt-1">
                        지급 후 수령액: {fmtRp(resolutionPreview.netAmount || Number(fGrossAmount) * (1 - resolutionPreview.rate))}
                      </p>
                      <div className="mt-2 p-2 bg-white/60 rounded border border-indigo-100">
                        <p className="text-indigo-900 font-medium">{resolutionPreview.reason}</p>
                        <p className="text-indigo-500 text-[10px] mt-0.5">📖 {resolutionPreview.legalBasis}</p>
                      </div>
                      {resolutionPreview.taxType === 'PPh26' && (
                        <p className="text-[10px] text-amber-700 mt-2">
                          ⚠ 비거주자 거래 — Certificate of Domicile(CoD) 및 DGT Form 제출 확인 필요
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
                  AI 자동 세율 판별 (Tax Resolution Engine)
                </label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !fCounterparty || !fGrossAmount}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calculator className="h-3 w-3 mr-1" />}
                  계산 및 저장
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>취소</Button>
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
              <b>{pendingBP}건</b>의 거래에 e-Bupot 번호가 미부여입니다
            </p>
          </div>
          <Button size="sm" onClick={handleGenerateBP} disabled={generatingBP}>
            {generatingBP ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
            e-Bupot 일괄 생성
          </Button>
        </div>
      )}

      {/* Transaction list */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {period} 거래 내역 ({transactions.length}건)
          </h3>

          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              거래 내역이 없습니다. 위 "거래 추가" 버튼으로 시작하세요.
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
                            <p className="text-gray-500">거래 상대방 NPWP</p>
                            <p className="font-mono">{tx.counterparty_npwp || '미등록'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">세율</p>
                            <p className="font-bold">{(tx.tax_rate * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">e-Bupot 번호</p>
                            <p className="font-mono">{tx.bukti_potong_number || '미생성'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">e-Bupot 날짜</p>
                            <p>{tx.bukti_potong_date || '-'}</p>
                          </div>
                        </div>
                        {tx.description && (
                          <div className="text-xs"><p className="text-gray-500">설명</p><p>{tx.description}</p></div>
                        )}

                        {/* Tax determination reason */}
                        <div className="bg-indigo-50 rounded p-2 text-xs flex items-start gap-2">
                          <Shield className="h-3 w-3 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-indigo-900">세율 결정 근거</p>
                            <p className="text-indigo-700">
                              {tx.service_type} — {tx.counterparty_npwp ? '표준' : 'NPWP 미보유 할증'} 세율 {(tx.tax_rate * 100).toFixed(1)}%
                              {!tx.counterparty_npwp && ' (Pasal 23(1a) 100% 가산)'}
                            </p>
                            <p className="text-indigo-500 text-[10px]">Pasal 23 UU PPh / PMK 141/PMK.03/2015</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => handleDelete(tx.id)}>
                            <X className="h-3 w-3 mr-1" />삭제
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

      {/* ══════════════════════════════════════════ */}
      {/* Filing process steps — 5~7단계 통합       */}
      {/* ══════════════════════════════════════════ */}
      {transactions.length > 0 && (
        <FilingSteps
          customerId={customerId}
          period={period}
          transactions={transactions}
          summary={summary}
          pendingBP={pendingBP}
          onRefresh={loadData}
          showMsg={showMsg}
          locale={locale}
        />
      )}
    </div>
  );
}

// ── Filing Steps Sub-component ──
function FilingSteps({
  customerId, period, transactions, summary, pendingBP, onRefresh, showMsg, locale,
}: {
  customerId: string;
  period: string;
  transactions: Transaction[];
  summary: Summary;
  pendingBP: number;
  onRefresh: () => void;
  showMsg: (type: 'success' | 'error', text: string) => void;
  locale: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [creatingSPT, setCreatingSPT] = useState(false);
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
    { id: 1, label: '거래 입력', done: transactions.length > 0, desc: `${summary.transactionCount}건 · ${fmtRp(summary.totalTax)}` },
    { id: 2, label: 'e-Bupot 생성', done: allBPGenerated, desc: allBPGenerated ? '전체 부여 완료' : `${pendingBP}건 미부여` },
    { id: 3, label: 'SPT Masa 생성', done: sptCreated, desc: sptCreated ? `마감 ${sptResult?.submissionDeadline?.substring(0, 10)}` : '미생성' },
    { id: 4, label: '납부', done: false, desc: '납부 페이지에서 진행' },
    { id: 5, label: 'DJP 제출', done: false, desc: '납부 완료 후 제출' },
  ];

  const handleCreateSPT = async () => {
    setCreatingSPT(true);
    try {
      const res = await fetch('/api/tax/spt-masa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxType: 'PPh23', period }),
      });
      const data = await res.json();
      if (data.success || data.sptMasa) {
        // API returns { success, sptMasa, filingId, ... } at root level
        const spt = data.sptMasa || data.data?.sptMasa;
        if (spt) {
          setSptResult({
            totalGrossIncome: spt.totalGrossIncome || 0,
            totalTaxWithheld: spt.totalTaxWithheld || 0,
            itemCount: spt.itemCount || 0,
            submissionDeadline: spt.submissionDeadline || '',
            isOverdue: spt.isOverdue || false,
            filingId: data.filingId,
          });
        }
        showMsg('success', 'SPT Masa PPh 23 초안이 생성되었습니다');
        onRefresh();
      } else {
        showMsg('error', data.error || data.message || 'SPT Masa 생성 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setCreatingSPT(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-600" />
          {period} PPh 23 신고 진행 상황
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
              <span>e-Bupot 미부여 {pendingBP}건. 위 목록 상단의 "e-Bupot 일괄 생성" 버튼을 클릭하세요.</span>
            </div>
          )}

          {/* Step 3: SPT Masa generation */}
          {allBPGenerated && !sptCreated && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="text-xs">
                  <p className="font-medium text-blue-900">SPT Masa PPh 23 생성 가능</p>
                  <p className="text-blue-700">{summary.transactionCount}건, 세액 {fmtRp(summary.totalTax)}</p>
                </div>
              </div>
              <Button size="sm" onClick={handleCreateSPT} disabled={creatingSPT}>
                {creatingSPT ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                SPT Masa 생성
              </Button>
            </div>
          )}

          {/* Step 3 done → show SPT summary */}
          {sptCreated && sptResult && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-xs font-medium text-green-900">SPT Masa PPh 23 생성 완료</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-gray-500">총 DPP</p><p className="font-mono font-bold">{fmtRp(sptResult.totalGrossIncome)}</p></div>
                <div><p className="text-gray-500">세액 합계</p><p className="font-mono font-bold text-emerald-700">{fmtRp(sptResult.totalTaxWithheld)}</p></div>
                <div>
                  <p className="text-gray-500">신고 마감</p>
                  <p className={sptResult.isOverdue ? 'text-red-600 font-bold' : ''}>
                    {sptResult.submissionDeadline?.substring(0, 10)}
                    {sptResult.isOverdue && ' (연체!)'}
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
                  <p className="font-medium text-indigo-900">납부 진행</p>
                  <p className="text-indigo-700">ID Billing 생성 후 은행에서 납부 → NTPN 입력</p>
                </div>
              </div>
              <a href={`/${locale}/tax/monthly-payments`}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                납부 페이지로
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
