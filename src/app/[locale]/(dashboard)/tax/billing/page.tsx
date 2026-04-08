'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Loader2, CheckCircle, AlertTriangle, Upload, Download,
  FileText, DollarSign, Clock, Eye, Camera, Send,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

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

const STATUS_MAP: Record<string, { label: string; color: string; step: number }> = {
  PENDING: { label: '접수 대기', color: 'bg-gray-100 text-gray-700', step: 0 },
  DATA_REVIEW: { label: '자료 검토중', color: 'bg-blue-100 text-blue-700', step: 1 },
  PENDING_APPROVAL: { label: '승인 대기', color: 'bg-amber-100 text-amber-700', step: 1 },
  APPROVED: { label: '승인 완료', color: 'bg-green-100 text-green-700', step: 2 },
  EBILLING_GENERATED: { label: 'ID Billing 발급', color: 'bg-indigo-100 text-indigo-700', step: 2 },
  PAYMENT_PENDING: { label: '납부 대기', color: 'bg-orange-100 text-orange-700', step: 3 },
  PAYMENT_UPLOADED: { label: '납부증빙 제출', color: 'bg-cyan-100 text-cyan-700', step: 3 },
  PAYMENT_VERIFIED: { label: '납부 확인', color: 'bg-teal-100 text-teal-700', step: 4 },
  DJP_SUBMITTED: { label: 'DJP 제출완료', color: 'bg-purple-100 text-purple-700', step: 5 },
  BPE_UPLOADED: { label: 'BPE 수령', color: 'bg-emerald-100 text-emerald-700', step: 5 },
  COMPLETED: { label: '완료', color: 'bg-green-200 text-green-800', step: 5 },
  FAILED: { label: '실패', color: 'bg-red-100 text-red-700', step: 0 },
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function TaxBillingPage() {
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const proofInputRef = useRef<HTMLInputElement>(null);

  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [ntpnInput, setNtpnInput] = useState<Record<string, { ntpn: string; amount: string; date: string }>>({});
  const [submittingNtpn, setSubmittingNtpn] = useState<string | null>(null);

  const handleSubmitNtpn = async (itemId: string) => {
    const inp = ntpnInput[itemId];
    if (!inp?.ntpn || inp.ntpn.length < 16) {
      showMsg('error', 'NTPN은 16자리 숫자입니다');
      return;
    }
    setSubmittingNtpn(itemId);
    try {
      const res = await fetch('/api/tax/monthly-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-payment',
          paymentId: itemId,
          ntpn: inp.ntpn,
          amount: Number(inp.amount) || 0,
          paidDate: inp.date || new Date().toISOString().split('T')[0],
          paymentMethod: 'BANK_TRANSFER',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', 'NTPN이 등록되었습니다. AI가 납부를 확인합니다.');
        setNtpnInput(prev => { const next = { ...prev }; delete next[itemId]; return next; });
        loadItems();
      } else {
        showMsg('error', data.error || 'NTPN 등록 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSubmittingNtpn(null);
    }
  };

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
        const all = data.data || [];
        setItems(all.filter((i: BillingItem) => i.tax_period_year === year));
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Upload payment proof
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
        // Update queue item with payment proof
        try {
          await fetch('/api/customer/payment-proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueItemId: itemId, fileUrl: uploadData.data?.signedUrl || uploadData.data?.path }),
          });
        } catch { /* */ }
        showMsg('success', '납부 증빙이 제출되었습니다. AI가 자동으로 확인 처리합니다.');
        loadItems();
      } else {
        showMsg('error', '업로드 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setUploading(null);
    }
  };

  // Group by month
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getItemsForMonth = (month: number) => items.filter(i => i.tax_period_month === month);

  const billingPending = items.filter(i => ['EBILLING_GENERATED', 'PAYMENT_PENDING'].includes(i.status)).length;
  const proofNeeded = items.filter(i => ['EBILLING_GENERATED', 'PAYMENT_PENDING'].includes(i.status)).length;
  const completed = items.filter(i => i.status === 'COMPLETED').length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-600" />
          세금 청구서 발행 · 납부 증빙 제출
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          AI가 생성한 ID Billing을 확인하고, 납부 증빙을 제출합니다
        </p>
      </div>

      {/* Educational banner */}
      <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200">
        <div className="text-xs text-indigo-900 space-y-1">
          <p className="font-bold">이 페이지의 절차:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-indigo-800">
            <li>자료 제출 완료 후 → <b>AI가 자동으로 계산·검토</b> 수행 (고객 액션 불필요)</li>
            <li>AI가 <b>ID Billing</b>을 생성하여 이곳에 등록합니다</li>
            <li>고객님은 ID Billing 코드로 <b>은행/ATM/모바일뱅킹</b>에서 납부합니다</li>
            <li>납부 후 <b>납부 증빙(NTPN 영수증)</b>을 여기에 업로드합니다</li>
            <li>AI가 납부 확인 후 → DJP 제출 → BPE 수령 → 완료</li>
          </ol>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">전체 건수</p>
          <p className="text-xl font-bold">{items.length}건</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500"><CardContent className="p-3">
          <p className="text-[10px] text-orange-600">납부 대기</p>
          <p className="text-xl font-bold text-orange-700">{billingPending}건</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-green-500"><CardContent className="p-3">
          <p className="text-[10px] text-green-600">완료</p>
          <p className="text-xl font-bold text-green-700">{completed}건</p>
        </CardContent></Card>
      </div>

      {/* Year selector */}
      <div className="flex gap-3 mb-4">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear].map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Monthly billing list */}
      {loading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-gray-400">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{year}년 청구 내역이 없습니다</p>
            <p className="text-xs mt-1">자료 제출이 완료되면 AI가 ID Billing을 생성합니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {months.map(month => {
            const monthItems = getItemsForMonth(month);
            if (monthItems.length === 0) return null;
            const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

            return (
              <Card key={month} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Clock className="h-3 w-3 text-gray-400" />{monthLabel}
                  </h3>
                  <div className="space-y-2">
                    {monthItems.map(item => {
                      const st = STATUS_MAP[item.status] || STATUS_MAP.PENDING;
                      const needsPayment = ['EBILLING_GENERATED', 'PAYMENT_PENDING'].includes(item.status);
                      const needsProof = needsPayment;

                      return (
                        <div key={item.id} className="p-3 rounded-lg border hover:border-gray-300">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">{item.tax_type}</Badge>
                              <Badge className={`text-[9px] ${st.color}`}>{st.label}</Badge>
                              {item.amount > 0 && <span className="text-xs font-mono">{fmtRp(item.amount)}</span>}
                            </div>
                          </div>

                          {/* ID Billing display */}
                          {item.ebilling_code && (
                            <div className="p-2 bg-indigo-50 rounded-lg mb-2">
                              <p className="text-[10px] text-indigo-600">ID Billing (Kode Billing)</p>
                              <p className="font-mono font-bold text-lg text-indigo-900">{item.ebilling_code}</p>
                              <p className="text-[10px] text-indigo-700 mt-1">
                                이 코드로 은행/ATM/모바일뱅킹에서 납부하세요.
                                납부 후 NTPN 영수증을 아래에서 업로드하세요.
                              </p>
                            </div>
                          )}

                          {/* Payment proof upload */}
                          {needsProof && (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline"
                                onClick={() => {
                                  setSelectedItem(item.id);
                                  proofInputRef.current?.click();
                                }}
                                disabled={uploading === item.id}>
                                {uploading === item.id
                                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  : <Upload className="h-3 w-3 mr-1" />}
                                납부 증빙 업로드
                              </Button>
                              <Button size="sm" variant="outline"
                                onClick={() => {
                                  setSelectedItem(item.id);
                                  const input = document.createElement('input');
                                  input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
                                  input.onchange = (e) => handleUploadProof(item.id, (e.target as HTMLInputElement).files);
                                  input.click();
                                }}
                                disabled={uploading === item.id}>
                                <Camera className="h-3 w-3 mr-1" />촬영
                              </Button>
                            </div>
                          )}

                          {/* NTPN input form */}
                          {needsProof && (
                            <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-[10px] font-bold text-green-900 mb-2">납부 완료 후 NTPN 번호를 입력하세요</p>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div className="md:col-span-2">
                                  <Label className="text-[10px]">NTPN (16자리)</Label>
                                  <Input
                                    className="h-8 text-xs font-mono"
                                    value={ntpnInput[item.id]?.ntpn || ''}
                                    onChange={e => setNtpnInput(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], ntpn: e.target.value.replace(/\D/g, '').slice(0, 16) }
                                    }))}
                                    placeholder="1234567890123456"
                                    maxLength={16}
                                  />
                                  <p className="text-[9px] text-gray-400 mt-0.5">
                                    {(ntpnInput[item.id]?.ntpn || '').length}/16자리
                                    {(ntpnInput[item.id]?.ntpn || '').length === 16 && ' ✓'}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-[10px]">납부 금액 (Rp)</Label>
                                  <Input type="number"
                                    className="h-8 text-xs font-mono"
                                    value={ntpnInput[item.id]?.amount || String(item.amount || '')}
                                    onChange={e => setNtpnInput(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], amount: e.target.value }
                                    }))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">납부일</Label>
                                  <Input type="date"
                                    className="h-8 text-xs"
                                    value={ntpnInput[item.id]?.date || new Date().toISOString().split('T')[0]}
                                    onChange={e => setNtpnInput(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], date: e.target.value }
                                    }))}
                                  />
                                </div>
                              </div>
                              <Button size="sm" className="mt-2"
                                onClick={() => handleSubmitNtpn(item.id)}
                                disabled={submittingNtpn === item.id || (ntpnInput[item.id]?.ntpn || '').length < 16}>
                                {submittingNtpn === item.id
                                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  : <Send className="h-3 w-3 mr-1" />}
                                NTPN 제출
                              </Button>
                            </div>
                          )}

                          {/* Payment confirmed */}
                          {item.payment_verified_at && (
                            <div className="text-[10px] text-green-700 mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              납부 확인 완료 {item.payment_date && `(${item.payment_date})`}
                              {item.payment_amount && ` — ${fmtRp(item.payment_amount)}`}
                            </div>
                          )}

                          {/* BPE */}
                          {item.bpe_number && (
                            <div className="text-[10px] text-purple-700 mt-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              BPE: {item.bpe_number}
                            </div>
                          )}

                          {/* Completed */}
                          {item.status === 'COMPLETED' && (
                            <div className="text-[10px] text-green-700 mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />신고 완료
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <input ref={proofInputRef} type="file" className="hidden" accept="image/*,.pdf"
        onChange={e => {
          if (selectedItem) handleUploadProof(selectedItem, e.target.files);
        }} />
    </div>
  );
}
