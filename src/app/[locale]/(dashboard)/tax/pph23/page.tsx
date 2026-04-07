'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Calculator, Shield,
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
}

interface Customer {
  id: string;
  full_name: string;
  company_name?: string;
}

// ── Service types (PMK 141/2015) ──
const SERVICE_TYPES = [
  { value: 'DIVIDEN', label: '배당 (Dividen)', rate: '15%' },
  { value: 'BUNGA', label: '이자 (Bunga)', rate: '15%' },
  { value: 'ROYALTI', label: '로열티 (Royalti)', rate: '15%' },
  { value: 'HADIAH', label: '상금 (Hadiah/Penghargaan)', rate: '15%' },
  { value: 'SEWA', label: '임대 (Sewa)', rate: '2%' },
  { value: 'JASA_TEKNIK', label: '기술 서비스 (Jasa Teknik)', rate: '2%' },
  { value: 'JASA_MANAJEMEN', label: '경영 서비스 (Jasa Manajemen)', rate: '2%' },
  { value: 'JASA_KONSULTAN', label: '컨설팅 (Jasa Konsultan)', rate: '2%' },
  { value: 'JASA_LAINNYA', label: '기타 서비스 (Jasa Lainnya)', rate: '2%' },
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

  // Tax resolution preview
  const [resolutionPreview, setResolutionPreview] = useState<{
    taxType: string; rate: number; reason: string; legalBasis: string;
  } | null>(null);

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

  // Preview tax resolution when counterparty changes
  useEffect(() => {
    if (!fCounterparty || !fGrossAmount || !fUseResolution) {
      setResolutionPreview(null);
      return;
    }
    const cp = counterparties.find(c => c.id === fCounterparty);
    if (!cp) return;

    // Simple client-side preview (actual resolution runs server-side)
    const hasNpwp = !!cp.npwp;
    const baseRate = ['DIVIDEN', 'BUNGA', 'ROYALTI', 'HADIAH'].includes(fServiceType) ? 0.15 : 0.02;
    const rate = hasNpwp ? baseRate : baseRate * 2;
    setResolutionPreview({
      taxType: 'PPh 23',
      rate,
      reason: hasNpwp
        ? `${fServiceType} 표준 세율 ${(baseRate * 100).toFixed(0)}%`
        : `${fServiceType} — NPWP 미보유 할증 ${(rate * 100).toFixed(0)}% (Pasal 23(1a))`,
      legalBasis: 'Pasal 23 UU PPh',
    });
  }, [fCounterparty, fServiceType, fGrossAmount, fUseResolution, counterparties]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const pendingBP = transactions.filter(t => !t.bukti_potong_number).length;
  const completedBP = transactions.filter(t => !!t.bukti_potong_number).length;

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

      {/* Add transaction form */}
      <Card className="mb-4">
        <CardContent className="p-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} disabled={!customerId}>
              <Plus className="h-4 w-4 mr-1" />거래 추가
            </Button>
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
                          {st.label} ({st.rate})
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

              {/* Tax resolution preview */}
              {resolutionPreview && fGrossAmount && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-indigo-900">
                        세액 미리보기: {fmtRp(Number(fGrossAmount) * resolutionPreview.rate)}
                        <span className="font-normal text-indigo-600 ml-2">({(resolutionPreview.rate * 100).toFixed(1)}%)</span>
                      </p>
                      <p className="text-indigo-700 mt-0.5">{resolutionPreview.reason}</p>
                      <p className="text-indigo-500 text-[10px]">{resolutionPreview.legalBasis}</p>
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
