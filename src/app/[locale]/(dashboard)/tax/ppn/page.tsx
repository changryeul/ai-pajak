'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/hooks/useSession';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import {
  FileText, Loader2, CheckCircle, AlertTriangle, Check, X,
  DollarSign, TrendingUp, TrendingDown, Minus, Sparkles,
  ArrowUpRight, ArrowDownLeft,
  Download, FileUp, ChevronDown, ChevronRight, Pencil,
} from 'lucide-react';
import { useRef } from 'react';
import { ScreenHeader } from '@/components/tax';
import { PageTitle } from '@/components/layout/PageTitle';
import { importPpnWholesaleFile } from '@/lib/tax/bulk-import/ppn-wholesale-importer';

interface Faktur {
  id: string;
  serial_number: string | null;
  transaction_type: 'OUTPUT' | 'INPUT';
  faktur_date: string;
  tax_period: string;
  buyer_name: string;
  buyer_npwp: string;
  seller_name: string;
  seller_npwp: string;
  dpp: number;
  ppn_amount: number;
  ppnbm_amount: number;
  total_amount: number;
  status: string;
  items: Array<{ description: string; quantity: number; unit_price: number; dpp: number; ppn_amount: number }>;
}

interface FakturMonthly {
  id: string;
  faktur_type: string;
  faktur_number: string;
  faktur_date: string;
  counterparty_name: string;
  counterparty_npwp: string;
  dpp: number;
  dpp_nilai_lain: number | null;  // PMK 131/2024 adjusted DPP (Phase 3.1)
  is_luxury: boolean | null;
  ppn: number;
  status: string;
}

type TabId = 'faktur' | 'reconciliation';
type FakturFilter = 'ALL' | 'OUTPUT' | 'INPUT';

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

export default function PPNPage() {
  const t = useTranslations('ppnPage');
  const tsc = useTranslations('taxScreen');
  const { session } = useSession();
  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId();
  const params = useParams();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [activeTab, setActiveTab] = useState<TabId>('faktur');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<FakturFilter>('ALL');

  // Faktur data
  const [fakturs, setFakturs] = useState<FakturMonthly[]>([]);
  const [summary, setSummary] = useState({ outputTax: 0, inputTax: 0, netPpn: 0, status: 'NIHIL', keluaranCount: 0, masukanCount: 0 });

  // Inline edit state (mirrors PPh21 MonthlyPayslipTab pattern)
  const [expandedFakturId, setExpandedFakturId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  const period = `${year}-${String(month).padStart(2, '0')}`;

  // Month picker — opens before wholesale upload (file/camera/manual modes
  // removed in Phase 4 simplification; only template + wholesale remain).
  const wholesaleInputRef = useRef<HTMLInputElement>(null);
  const [uploadingWholesale, setUploadingWholesale] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickedYear, setPickedYear] = useState<number>(currentYear);
  const [pickedMonth, setPickedMonth] = useState<number>(currentMonth);
  const [confirmedPeriod, setConfirmedPeriod] = useState<string | null>(null);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  const openMonthPicker = () => {
    setMonthPickerOpen(true);
  };

  /**
   * Wholesale VAT compliance upload — extracts VAT OUT + VAT IN in one pass
   * and POSTs to /api/tax/ppn-bulk-import. Distinct from `handleFakturUpload`
   * (single faktur images via /api/documents/upload + OCR) — wholesale path
   * is for the customer's monthly compliance Excel that already lists every
   * faktur in a 16-column ledger.
   */
  const handleWholesaleUpload = async (file: File | null, uploadPeriod?: string) => {
    if (!file || !customerId) return;
    const importPeriod = uploadPeriod || confirmedPeriod || period;
    if (!importPeriod) {
      showMsg('error', t('monthPickerDesc'));
      return;
    }
    setUploadingWholesale(true);
    try {
      let summary: Awaited<ReturnType<typeof importPpnWholesaleFile>>;
      try {
        summary = await importPpnWholesaleFile(file);
      } catch (parseErr) {
        showMsg('error', t('wholesalePpnFailed', { reason: (parseErr as Error).message }));
        setUploadingWholesale(false);
        return;
      }

      if (summary.outImported === 0 && summary.inImported === 0) {
        showMsg('error', t('wholesalePpnFailed', { reason: `no rows parsed (errors: ${summary.errors.length})` }));
        setUploadingWholesale(false);
        return;
      }

      const res = await fetch('/api/tax/ppn-bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxPeriod: importPeriod,
          outCsv: summary.outCsv,
          inCsv: summary.inCsv,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showMsg('error', t('wholesalePpnFailed', { reason: data.error || `HTTP ${res.status}` }));
        return;
      }
      const d = data.data || {};
      const outMsg = t('wholesaleOutImported', { count: d.outInserted ?? 0 });
      const inMsg = t('wholesaleInImported', { count: d.inInserted ?? 0 });
      const luxuryCount = d.luxuryClassified ?? 0;
      const luxuryMsg = luxuryCount > 0
        ? ` · ${t('luxuryClassifiedToast', { count: luxuryCount })}`
        : '';
      showMsg('success', `${outMsg} / ${inMsg}${luxuryMsg}`);

      // Sync the page period selector to the imported month and refresh.
      const [py, pm] = importPeriod.split('-').map(Number);
      if (py && pm) { setYear(py); setMonth(pm); }
      loadFakturs();
    } catch (err) {
      showMsg('error', t('wholesalePpnFailed', { reason: err instanceof Error ? err.message : 'unknown' }));
    } finally {
      setUploadingWholesale(false);
    }
  };

  const downloadPpnTemplate = async () => {
    try {
      const headers = ['faktur_type', 'faktur_number', 'faktur_date', 'counterparty_name', 'counterparty_npwp', 'description', 'dpp', 'ppn'];
      const sample: (string | number)[] = ['OUTPUT', '0100002500000001', '2026-04-15', 'PT Buyer', '01.234.567.8-901.000', 'Jasa konsultasi', 10000000, 1100000];

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const aoa: (string | number)[][] = [headers, sample];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, 'PPN Faktur 데이터');

      const guideRows: string[][] = [
        ['컬럼 / Column', '설명 / Keterangan'],
        ['faktur_type', 'OUTPUT(매출/KELUARAN) 또는 INPUT(매입/MASUKAN) (필수)'],
        ['faktur_number', '16자리 Faktur Pajak 번호 / Nomor Faktur Pajak (16 digit)'],
        ['faktur_date', '발행일 YYYY-MM-DD / Tanggal faktur'],
        ['counterparty_name', '거래처 이름 (필수) / Nama lawan transaksi (wajib)'],
        ['counterparty_npwp', '거래처 NPWP (01.234.567.8-901.000)'],
        ['description', '거래 내역 / Deskripsi barang atau jasa'],
        ['dpp', 'DPP — 부가세 제외 금액 (필수, 숫자) / Dasar Pengenaan Pajak (wajib)'],
        ['ppn', 'PPN 11% — DPP × 11% / PPN 11% dari DPP'],
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
      wsGuide['!cols'] = [{ wch: 22 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, '안내 - Petunjuk');

      XLSX.writeFile(wb, 'ppn_template.xlsx');
      showMsg('success', t('templateComingSoon'));
    } catch (err) {
      showMsg('error', `${t('templateDownloadFailed')}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const confirmMonthPicker = () => {
    const p = periodLabel(pickedYear, pickedMonth);
    setConfirmedPeriod(p);
    setMonthPickerOpen(false);
    setTimeout(() => {
      wholesaleInputRef.current?.click();
    }, 50);
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Load faktur data
  const loadFakturs = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/ppn-faktur-monthly?customerId=${customerId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setFakturs(data.data.fakturs || []);
        // API returns outputTax/inputTax as {count,totalDpp,totalPpn}; flatten
        // to the numbers this page renders with `fmt(...)`.
        const raw = data.data.summary || {};
        setSummary({
          outputTax: Number(raw.outputTax?.totalPpn ?? 0),
          inputTax: Number(raw.inputTax?.totalPpn ?? 0),
          netPpn: Number(raw.netPpn ?? 0),
          status: raw.status || 'NIHIL',
          keluaranCount: Number(raw.outputTax?.count ?? 0),
          masukanCount: Number(raw.inputTax?.count ?? 0),
        });
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId, period]);

  useEffect(() => { loadFakturs(); }, [loadFakturs]);

  /**
   * Inline edit — partial PATCH to PUT /api/tax/ppn-faktur-monthly. Server
   * 응답은 { success: true } 만 — 보낸 값을 snake_case 로 매핑해 로컬 상태에
   * 머지하고, dpp 가 바뀌면 ppn + dpp_nilai_lain 이 서버 재계산되므로 refetch.
   */
  const updateFaktur = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/tax/ppn-faktur-monthly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        const mapped: Record<string, unknown> = {};
        if (updates.fakturNumber !== undefined) mapped.faktur_number = (updates.fakturNumber as string) || '';
        if (updates.fakturDate !== undefined) mapped.faktur_date = updates.fakturDate as string;
        if (updates.counterpartyName !== undefined) mapped.counterparty_name = updates.counterpartyName as string;
        if (updates.counterpartyNpwp !== undefined) mapped.counterparty_npwp = updates.counterpartyNpwp as string;
        if (updates.fakturType !== undefined) mapped.faktur_type = updates.fakturType as string;
        if (updates.dpp !== undefined) mapped.dpp = Number(updates.dpp);
        if (updates.ppn !== undefined) mapped.ppn = Number(updates.ppn);
        if (updates.dppNilaiLain !== undefined) mapped.dpp_nilai_lain = Number(updates.dppNilaiLain);
        if (updates.isLuxury !== undefined) mapped.is_luxury = updates.isLuxury === true;
        setFakturs(prev => prev.map(f => f.id === id ? { ...f, ...mapped } as FakturMonthly : f));
        setSavedAt(prev => ({ ...prev, [id]: Date.now() }));
        setTimeout(() => {
          setSavedAt(prev => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
        }, 1500);
        showMsg('success', t('savedToast'));
        // dpp 변경 시 server 가 ppn + dpp_nilai_lain 재계산 → refetch 로 정확한
        // 값 동기화. fakturType 변경도 4-card 합계 재집계 위해 refetch.
        if (updates.dpp !== undefined || updates.fakturType !== undefined) {
          loadFakturs();
        }
      } else {
        showMsg('error', t('saveFailed'));
      }
    } catch {
      showMsg('error', t('saveFailed'));
    }
  };

  const filteredFakturs = filter === 'ALL' ? fakturs : fakturs.filter(f => f.faktur_type === (filter === 'OUTPUT' ? 'KELUARAN' : 'MASUKAN'));

  const netStatus = summary.netPpn > 0 ? 'KURANG_BAYAR' : summary.netPpn < 0 ? 'LEBIH_BAYAR' : 'NIHIL';
  const statusConfig = {
    KURANG_BAYAR: { label: t('statusKurangBayar'), color: 'bg-red-100 text-red-700', icon: TrendingUp },
    LEBIH_BAYAR: { label: t('statusLebihBayar'), color: 'bg-green-100 text-green-700', icon: TrendingDown },
    NIHIL: { label: t('statusNihil'), color: 'bg-gray-100 text-gray-600', icon: Minus },
  };
  const currentStatus = statusConfig[netStatus];

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: 'faktur', label: t('tabFaktur'), icon: FileText },
    { id: 'reconciliation', label: t('tabReconciliation'), icon: DollarSign },
  ];

  if (!session) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600 mb-4" />
        <p className="text-gray-500 text-sm">{t('loadingSession')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <PageTitle title="PPN" />
      <ScreenHeader
        title="e-Faktur & PPN"
        step={1}
        aiSteps={[tsc('stepDataCollect'), tsc('stepVatCalc'), tsc('stepFilingRefund')]}
      />

      {/* Consultant customer picker — only shown for CONSULTANT_JTC /
          TAX_ADVISOR_JTC. CUSTOMER role keeps the existing UI unchanged. */}
      {isConsultant && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="ppn-customer" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {tsc('selectCustomer')}
          </label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{tsc('noAssignedCustomers')}</span>
          ) : (
            <select
              id="ppn-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 4-card summary (prototype alignment: Output / Input / Prev Balance / Final) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3">
          <p className="text-gray-500 text-xs flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{t('ppnKeluaran')}</p>
          <p className="font-bold text-lg">{fmt(summary.outputTax)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-gray-500 text-xs flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{t('ppnMasukan')}</p>
          <p className="font-bold text-lg">{fmt(summary.inputTax)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-gray-500 text-xs">{t('prevBalance')}</p>
          <p className="font-bold text-lg">{fmt(0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-gray-500 text-xs">{t('finalResult')}</p>
          <p className="font-bold text-lg">{fmt(Math.abs(summary.netPpn))}</p>
          <Badge className={`${currentStatus.color} text-[10px] mt-1`}>{currentStatus.label}</Badge>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Faktur Management */}
      {activeTab === 'faktur' && (
        <div>
          {/* Single input card — template + wholesale xlsx only (Phase 4 simplification) */}
          <div className="mb-4">
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
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { void downloadPpnTemplate(); }}>
                    <Download className="h-3 w-3 mr-1" />{t('inputTemplateDownloadBtn')}
                  </Button>
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={openMonthPicker}
                    disabled={uploadingWholesale || !customerId}
                  >
                    {uploadingWholesale ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileUp className="h-3 w-3 mr-1" />}
                    Wholesale (VAT OUT + VAT IN)
                  </Button>
                  {confirmedPeriod && (
                    <p className="text-[10px] text-emerald-700 text-center">
                      {t('monthPickerSelected', { period: confirmedPeriod })}
                    </p>
                  )}
                  <input ref={wholesaleInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                    onChange={e => handleWholesaleUpload(e.target.files?.[0] ?? null)} />
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                    {t('uploadHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              {(['ALL', 'OUTPUT', 'INPUT'] as FakturFilter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f === 'ALL' ? t('filterAll') + ' (' + fakturs.length + ')' : f === 'OUTPUT' ? t('filterKeluaran') + ' (' + fakturs.filter(x => x.faktur_type === 'KELUARAN').length + ')' : t('filterMasukan') + ' (' + fakturs.filter(x => x.faktur_type === 'MASUKAN').length + ')'}
                </button>
              ))}
            </div>
          </div>

          {/* Faktur List — inline edit (PPh21 패턴): 행 클릭 → expand → onBlur PUT */}
          {isLoading ? (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
          ) : filteredFakturs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('noFaktur')}</p>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2.5 px-3 w-8"></th>
                        <th className="text-left py-2.5 px-3">{t('thFakturNo')}</th>
                        <th className="text-left py-2.5 px-3">{t('thDate')}</th>
                        <th className="text-center py-2.5 px-3">{t('thType')}</th>
                        <th className="text-left py-2.5 px-3">{t('thCounterparty')}</th>
                        <th className="text-right py-2.5 px-3">DPP</th>
                        <th className="text-right py-2.5 px-3">{t('dppNilaiLain')}</th>
                        <th className="text-right py-2.5 px-3">PPN</th>
                        <th className="text-center py-2.5 px-3">{t('luxuryHeader')}</th>
                        <th className="text-center py-2.5 px-3">Status</th>
                        <th className="text-right py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredFakturs.map(f => {
                        const isExpanded = expandedFakturId === f.id;
                        return (
                          <Fragment key={f.id}>
                            <tr
                              className="hover:bg-blue-50/40 group cursor-pointer transition-colors"
                              onClick={() => setExpandedFakturId(isExpanded ? null : f.id)}
                              title={t('editHint')}
                            >
                              <td className="py-2 px-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">{f.faktur_number || '—'}</td>
                              <td className="py-2 px-3 text-xs text-gray-500">{f.faktur_date}</td>
                              <td className="py-2 px-3 text-center">
                                <Badge className={`text-[10px] ${f.faktur_type === 'KELUARAN' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                  {f.faktur_type === 'KELUARAN' ? 'OUT' : 'IN'}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-xs">{f.counterparty_name}</td>
                              <td className="py-2 px-3 text-right font-mono text-xs">{fmt(f.dpp)}</td>
                              <td className="py-2 px-3 text-right font-mono text-xs text-gray-500">{f.dpp_nilai_lain != null ? fmt(Number(f.dpp_nilai_lain)) : '—'}</td>
                              <td className="py-2 px-3 text-right font-mono text-xs font-medium text-orange-600">{fmt(f.ppn)}</td>
                              <td className="py-2 px-3 text-center">
                                {f.is_luxury === true ? (
                                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">💎 LUXURY</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-gray-500">{t('luxuryEssential')}</Badge>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                              </td>
                              <td className="py-2 px-3 text-right">
                                {savedAt[f.id] ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 text-[11px] font-medium animate-pulse">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    {t('savedToast')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-400 group-hover:text-blue-600 text-[11px] transition-colors">
                                    <Pencil className="h-3 w-3" />
                                    {t('editHint')}
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50/50">
                                <td colSpan={11} className="p-4">
                                  <div className="space-y-3">
                                    {/* Edit banner */}
                                    <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900 flex items-center gap-2">
                                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                                      <span>{t('editBanner')}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <Label className="text-[10px] text-gray-400">{t('thType')}</Label>
                                        <select
                                          className="h-8 text-xs w-full rounded border border-gray-300 px-2 bg-white"
                                          defaultValue={f.faktur_type}
                                          onBlur={e => {
                                            if (e.target.value !== f.faktur_type) {
                                              updateFaktur(f.id, { fakturType: e.target.value });
                                            }
                                          }}
                                        >
                                          <option value="KELUARAN">KELUARAN (OUT)</option>
                                          <option value="MASUKAN">MASUKAN (IN)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">{t('thFakturNo')}</Label>
                                        <Input
                                          className="h-8 text-xs font-mono"
                                          defaultValue={f.faktur_number ?? ''}
                                          onBlur={e => {
                                            if (e.target.value !== (f.faktur_number ?? '')) {
                                              updateFaktur(f.id, { fakturNumber: e.target.value });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">{t('thDate')}</Label>
                                        <Input
                                          type="date"
                                          className="h-8 text-xs"
                                          defaultValue={f.faktur_date}
                                          onBlur={e => {
                                            if (e.target.value && e.target.value !== f.faktur_date) {
                                              updateFaktur(f.id, { fakturDate: e.target.value });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">{t('thCounterparty')}</Label>
                                        <Input
                                          className="h-8 text-xs"
                                          defaultValue={f.counterparty_name ?? ''}
                                          onBlur={e => {
                                            if (e.target.value !== (f.counterparty_name ?? '')) {
                                              updateFaktur(f.id, { counterpartyName: e.target.value });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">NPWP</Label>
                                        <Input
                                          className="h-8 text-xs font-mono"
                                          defaultValue={f.counterparty_npwp ?? ''}
                                          onBlur={e => {
                                            if (e.target.value !== (f.counterparty_npwp ?? '')) {
                                              updateFaktur(f.id, { counterpartyNpwp: e.target.value });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">DPP</Label>
                                        <Input
                                          type="number"
                                          className="h-8 text-xs font-mono"
                                          defaultValue={f.dpp}
                                          onBlur={e => {
                                            const newVal = Number(e.target.value);
                                            if (Number.isFinite(newVal) && newVal !== Number(f.dpp)) {
                                              // dpp 만 보내면 서버가 ppn + dpp_nilai_lain 재계산
                                              updateFaktur(f.id, { dpp: newVal, isLuxury: f.is_luxury === true });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">{t('dppNilaiLain')}</Label>
                                        <Input
                                          type="number"
                                          className="h-8 text-xs font-mono"
                                          defaultValue={f.dpp_nilai_lain ?? 0}
                                          onBlur={e => {
                                            const newVal = Number(e.target.value);
                                            if (Number.isFinite(newVal) && newVal !== Number(f.dpp_nilai_lain ?? 0)) {
                                              updateFaktur(f.id, { dppNilaiLain: newVal });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-gray-400">PPN</Label>
                                        <Input
                                          type="number"
                                          className="h-8 text-xs font-mono"
                                          defaultValue={f.ppn}
                                          onBlur={e => {
                                            const newVal = Number(e.target.value);
                                            if (Number.isFinite(newVal) && newVal !== Number(f.ppn)) {
                                              updateFaktur(f.id, { ppn: newVal });
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                    {/* Luxury toggle — PMK 131/2024.
                                        Essential goods: dpp × 11/12 적용 = effective 11%.
                                        Luxury items: full 12% PPN (HS code per PMK Lampiran A). */}
                                    <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-amber-900">{t('luxuryToggleLabel')}</p>
                                        <p className="text-[11px] text-amber-700/80 mt-0.5">{t('luxuryToggleHint')}</p>
                                      </div>
                                      <label className="inline-flex items-center cursor-pointer gap-2">
                                        <input
                                          type="checkbox"
                                          checked={f.is_luxury === true}
                                          onChange={e => {
                                            // 토글 시 dpp 같이 보내야 서버가 dpp_nilai_lain 재계산
                                            updateFaktur(f.id, { isLuxury: e.target.checked, dpp: Number(f.dpp) });
                                          }}
                                          className="w-4 h-4 accent-amber-600"
                                        />
                                        <span className="text-xs font-medium text-amber-900">
                                          {f.is_luxury === true ? '💎 LUXURY' : t('luxuryEssential')}
                                        </span>
                                      </label>
                                    </div>
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
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100"><ArrowUpRight className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">{t('ppnKeluaran')}</p>
                    <p className="text-xl font-bold">{fmt(summary.outputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.keluaranCount} {t('fakturCount')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100"><ArrowDownLeft className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">{t('ppnMasukan')}</p>
                    <p className="text-xl font-bold">{fmt(summary.inputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.masukanCount} {t('fakturCount')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${netStatus === 'KURANG_BAYAR' ? 'bg-red-100' : netStatus === 'LEBIH_BAYAR' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {(() => { const Icon = currentStatus.icon; return <Icon className="h-5 w-5" />; })()}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net PPN</p>
                    <p className="text-xl font-bold">{fmt(Math.abs(summary.netPpn))}</p>
                    <Badge className={`${currentStatus.color} text-[10px]`}>{currentStatus.label}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Keluaran */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />{t('fakturKeluaran')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">{t('buyerHeader')}</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">{t('noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Masukan */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />{t('fakturMasukan')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">{t('sellerHeader')}</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">{t('noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">{t('infoTitle')}</p>
              <p>{t('infoDesc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* PPN Refund Section */}
      <PPNRefundSection locale={locale} />

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
              {t('cancel')}
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

// ══════════════════════════════════════════════════════
// PPN 환급 신청 (Restitusi PPN)
// ══════════════════════════════════════════════════════
function PPNRefundSection({ locale }: { locale: string }) {
  const [showRefund, setShowRefund] = useState(false);
  const t = useTranslations('ppnPage');
  const [refundStep, setRefundStep] = useState(1);
  const [agreedFees, setAgreedFees] = useState(false);
  const [agreedAudit, setAgreedAudit] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundPeriod, setRefundPeriod] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const operatingCost = 20_000_000; // Rp 20 juta
  const successFeeRate = 0.07; // 7%
  const estimatedRefund = Number(refundAmount) || 0;
  const estimatedSuccessFee = Math.round(estimatedRefund * successFeeRate);
  const totalEstimatedCost = operatingCost + estimatedSuccessFee;

  if (!showRefund) {
    return (
      <Card className="mt-6 border-2 border-dashed border-emerald-300 hover:border-emerald-400 transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-sm">PPN {t('k29_789ddc')}</p>
                <p className="text-xs text-gray-500">{t('k30_96e0f6')}</p>
              </div>
            </div>
            <Button onClick={() => setShowRefund(true)} variant="outline">
              {t('k31_1a2b6d')} <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-emerald-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 rounded-t-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                PPN {t('k29_789ddc')}
              </h2>
              <p className="text-sm text-emerald-100 mt-1">Jakarta Tax Consulting {t('k32_6e2104')}</p>
            </div>
            <button onClick={() => setShowRefund(false)} className="text-white/70 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            {[
              { id: 1, label: t('k33_7844a2') },
              { id: 2, label: t('k34_aae1bf') },
              { id: 3, label: t('k35_829a90') },
              { id: 4, label: t('k13_4f8e30') },
            ].map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    refundStep >= s.id ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{refundStep > s.id ? <Check className="h-3 w-3" /> : s.id}</div>
                  <p className="text-[9px] mt-1">{s.label}</p>
                </div>
                {i < 3 && <div className={`h-0.5 flex-1 ${refundStep > s.id ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: 환급 절차 설명 */}
          {refundStep === 1 && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <p className="font-bold text-sm text-emerald-900 mb-2">PPN {t('k36_09f6dc')}?</p>
                <p className="text-xs text-emerald-800">
                  {t('k37_be38dd')}
                  {t('k38_445cc6')} <b>&ldquo;Restitusi PPN&rdquo;</b>{t('k39_081b53')}
                </p>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="font-bold text-sm text-red-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  {t('k40_1766bd')}: {t('k41_f6b4c4')}
                </p>
                <p className="text-xs text-red-800">
                  PPN {t('k42_0eac31')} <b>{t('k43_cbf9a9')}</b>{t('k44_63354a')}
                  {t('auditLegal')}
                </p>
                <p className="text-xs text-red-800 mt-1">
                  {t('k46_d7dee2')} <b>3~12{t('k47_f667f2')}</b>{t('k48_ce06b2')}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border">
                <p className="font-bold text-sm mb-3">{t('k49_55fa8f')}</p>
                <div className="space-y-2 text-xs">
                  {[
                    { step: '1', title: t('k50_e0cc70'), desc: t('k50_e0cc70'), duration: '1~2' + t('k47_f667f2') },
                    { step: '2', title: t('k113_5fd53c') + ' ' + t('k6_d6ed72'), desc: 'SPT Masa PPN Lebih Bayar — Restitusi → DJP ' + t('k6_d6ed72'), duration: '1' + t('k56_1d0584') },
                    { step: '3', title: 'DJP ' + t('k54_ee04da'), desc: 'DJP ' + t('k55_b63cd9'), duration: '1~3' + t('k47_f667f2') },
                    { step: '4', title: t('k56_d6fa73'), desc: t('auditStep4Desc'), duration: t('auditStep4Duration') },
                    { step: '5', title: t('k58_a43bd6'), desc: t('auditStep5Desc'), duration: t('auditStep5Duration') },
                    { step: '6', title: t('k60_6345b9'), desc: t('k60_6345b9'), duration: '1' + t('k47_f667f2') },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <Badge className="bg-emerald-100 text-emerald-700 flex-shrink-0">{item.step}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{item.title}</p>
                          <span className="text-[10px] text-gray-400">{item.duration}</span>
                        </div>
                        <p className="text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 비용 확인 */}
          {refundStep === 2 && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4 border">
                <p className="font-bold text-sm mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  JTC {t('k62_db9d38')}
                </p>

                <div className="space-y-3">
                  {/* Operating cost */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-blue-900">{t('k63_2b3c5e')}</p>
                      <p className="text-lg font-bold font-mono text-blue-700">Rp 20,000,000</p>
                    </div>
                    <p className="text-[11px] text-blue-700">
                      {t('k64_bc4bdb')}
                    </p>
                    <ul className="text-[10px] text-blue-600 mt-2 space-y-0.5">
                      <li>• Faktur Pajak / {t('k65_3418e5')}</li>
                      <li>• DJP {t('k66_d7896e')}</li>
                      <li>• {t('k67_6a481d')}</li>
                      <li>• {t('k68_f9fd91')}</li>
                    </ul>
                  </div>

                  {/* Success fee */}
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-emerald-900">{t('k69_b31bb9')}</p>
                      <p className="text-lg font-bold font-mono text-emerald-700">{t('k70_69edb3')}</p>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      {t('refundFeeNote')}
                    </p>
                  </div>

                  {/* Estimate calculator */}
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-xs font-bold mb-2">{t('k72_a4a9a0')}</p>
                    <div>
                      <Label className="text-[10px]">{t('k73_ab8f53')}</Label>
                      <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                        placeholder="500000000" className="font-mono h-8 text-xs" />
                    </div>
                    {estimatedRefund > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span>{t('k74_d089c1')}</span><span className="font-mono">Rp 20,000,000</span></div>
                        <div className="flex justify-between"><span>{t('k69_b31bb9')} (7% × {new Intl.NumberFormat('id-ID').format(estimatedRefund)})</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedSuccessFee)}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1"><span>{t('k76_2db159')}</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalEstimatedCost)}</span></div>
                        <div className="flex justify-between text-emerald-700 font-bold"><span>{t('k77_594f62')}</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund - totalEstimatedCost)}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Agreements */}
              <div className="space-y-2">
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreedFees} onChange={e => setAgreedFees(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium">{t('k78_77194a')} <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">{t('costSummary')}</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreedAudit} onChange={e => setAgreedAudit(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium">{t('k81_e0de89')} <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">PPN {t('k82_441317')}</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: 신청 정보 */}
          {refundStep === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('k83_98cd0b')}</Label>
                  <Input value={refundPeriod} onChange={e => setRefundPeriod(e.target.value)}
                    placeholder={t('periodPlaceholder')} />
                </div>
                <div>
                  <Label className="text-xs">{t('k73_ab8f53')}</Label>
                  <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                    className="font-mono" placeholder="500000000" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('k84_19e87b')}</Label>
                <select value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  <option value="">{t('k85_f1d7fb')}</option>
                  <option value="EXCESS_INPUT">{t('k86_d00397')} {'>'} Keluaran)</option>
                  <option value="EXPORT">{t('k87_eb6282')}</option>
                  <option value="CAPITAL_GOODS">{t('k88_5266a8')}</option>
                  <option value="PKP_TERMINATION">PKP {t('k89_d53d30')}</option>
                  <option value="OTHER">{t('k90_7f598d')}</option>
                </select>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 border border-amber-200">
                <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{t('k91_84f2f6')}</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• {t('k92_0d7003')} + Masukan) {t('k93_d47e1e')}</li>
                  <li>• {t('requiredDocs')}</li>
                  <li>• {t('k95_b95354')}</li>
                  <li>• {t('k96_197524')}</li>
                  <li>• e-Faktur {t('k97_f6f0cc')}</li>
                </ul>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900">JTC {t('k98_3eba7d')}:</p>
                <ul className="text-[11px] text-emerald-800 mt-1 space-y-0.5">
                  <li>✓ {t('k99_93c016')} — {t('k100_b7e27c')}</li>
                  <li>✓ {t('sptRestitusi')}</li>
                  <li>✓ DJP {t('k101_bb490b')} — {t('k102_7441f9')} + {t('k103_4aac74')}</li>
                  <li>✓ {t('k104_2a6e81')}</li>
                  <li>✓ {t('skplbResult')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 4: 완료 */}
          {refundStep === 4 && !submitted && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="font-bold text-lg">{t('refundAccepted')}</p>
              <p className="text-sm text-gray-600 mt-2">
                JTC {t('k107_04e227')}
              </p>
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1">{t('k108_ed1d88')}</p>
                <div className="space-y-0.5">
                  <p>{t('k109_7bc7c5')}: {refundPeriod || '-'}</p>
                  <p>{t('k110_38e8ae')}: {estimatedRefund > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund) : '-'}</p>
                  <p>{t('k74_d089c1')}: Rp 20,000,000</p>
                  <p>{t('k69_b31bb9')}: {t('k70_69edb3')}</p>
                </div>
              </div>
              <Button className="mt-6" onClick={() => { setShowRefund(false); setRefundStep(1); }}>
                {t('k111_218e2a')}
              </Button>
            </div>
          )}

          {/* Navigation */}
          {refundStep < 4 && (
            <div className="flex justify-between pt-2">
              {refundStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setRefundStep(refundStep - 1)}>
                  {t('k112_cb1dc9')}
                </Button>
              ) : <div />}
              <Button size="sm"
                disabled={
                  (refundStep === 2 && (!agreedFees || !agreedAudit)) ||
                  (refundStep === 3 && (!refundPeriod || !refundReason))
                }
                onClick={() => {
                  if (refundStep === 3) {
                    setSubmitted(true);
                  }
                  setRefundStep(refundStep + 1);
                }}
              >
                {refundStep === 3 ? t('k113_5fd53c') : t('k114_fe6879')}
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
