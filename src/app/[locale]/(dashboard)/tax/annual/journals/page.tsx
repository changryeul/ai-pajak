'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Plus, Loader2, CheckCircle, AlertTriangle, Save, X, Trash2,
  Upload, Sparkles, ArrowRight,
} from 'lucide-react';
import { useRef } from 'react';
import { fmtRp } from '@/lib/utils';

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  source: string;
  lines: Array<{ account_code: string; account_name?: string; debit: number; credit: number }>;
}

interface CoaItem { code: string; name_id: string; account_type: string; }

export default function JournalsPage() {
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear - 1);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; company_name?: string; full_name: string }>>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [coa, setCoa] = useState<CoaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fDesc, setFDesc] = useState('');
  const [fLines, setFLines] = useState<Array<{ account_code: string; debit: string; credit: string }>>([
    { account_code: '', debit: '', credit: '' },
    { account_code: '', debit: '', credit: '' },
  ]);

  const isConsultant = session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';

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

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Load journals + CoA
  const loadData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/journals?customerId=${customerId}&year=${year}`);
      const d = await res.json();
      if (d.success) {
        setJournals(d.data?.journals || []);
        if (d.data?.coa) setCoa(d.data.coa);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [customerId, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Form totals
  const formDebit = fLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const formCredit = fLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(formDebit - formCredit) < 1;

  const handleSave = async () => {
    if (!fDesc.trim()) { showMsg('error', '설명을 입력하세요'); return; }
    if (!isBalanced) { showMsg('error', '차변과 대변이 일치하지 않습니다'); return; }
    const validLines = fLines.filter(l => l.account_code && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { showMsg('error', '최소 2줄 이상 입력하세요'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/accounting/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          fiscalYear: year,
          entryDate: fDate,
          description: fDesc,
          lines: validLines.map((l, i) => ({
            account_code: l.account_code,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            line_order: i + 1,
          })),
        }),
      });
      const d = await res.json();
      if (d.success) {
        showMsg('success', '저널 저장 완료');
        setShowForm(false);
        setFDesc('');
        setFLines([{ account_code: '', debit: '', credit: '' }, { account_code: '', debit: '', credit: '' }]);
        loadData();
      } else {
        showMsg('error', d.error || '저장 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          저널 입력 (Jurnal Umum)
        </h1>
        <p className="text-sm text-gray-500 mt-1">복식부기 저널 입력 → 재무제표 자동 생성</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isConsultant && (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="고객" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? '닫기' : '저널 추가'}
        </Button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Journal entry form */}
      {showForm && (
        <Card className="mb-4 border-indigo-200">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">새 저널 입력</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">날짜</Label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">설명 (Keterangan)</Label>
                <Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="예: Penjualan jasa konsultasi" />
              </div>
            </div>

            <div>
              <Label className="text-xs">상세 (차변/대변)</Label>
              <table className="w-full text-xs border-collapse mt-1">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-1 text-left border">계정</th>
                    <th className="p-1 text-right border w-32">차변 (Debit)</th>
                    <th className="p-1 text-right border w-32">대변 (Credit)</th>
                    <th className="p-1 border w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {fLines.map((line, i) => (
                    <tr key={i}>
                      <td className="p-0.5 border">
                        <select value={line.account_code}
                          onChange={e => { const next = [...fLines]; next[i] = { ...next[i], account_code: e.target.value }; setFLines(next); }}
                          className="w-full h-7 px-1 text-xs border-0">
                          <option value="">계정 선택</option>
                          {coa.map(a => <option key={a.code} value={a.code}>{a.code} {a.name_id}</option>)}
                        </select>
                      </td>
                      <td className="p-0.5 border">
                        <Input type="number" className="h-7 text-xs font-mono text-right" value={line.debit}
                          onChange={e => { const next = [...fLines]; next[i] = { ...next[i], debit: e.target.value, credit: '' }; setFLines(next); }} />
                      </td>
                      <td className="p-0.5 border">
                        <Input type="number" className="h-7 text-xs font-mono text-right" value={line.credit}
                          onChange={e => { const next = [...fLines]; next[i] = { ...next[i], credit: e.target.value, debit: '' }; setFLines(next); }} />
                      </td>
                      <td className="p-0.5 border text-center">
                        {fLines.length > 2 && (
                          <button onClick={() => setFLines(fLines.filter((_, j) => j !== i))}><X className="h-3 w-3 text-gray-400" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={isBalanced ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="p-1 border font-bold">합계</td>
                    <td className="p-1 border text-right font-mono font-bold">{fmtRp(formDebit)}</td>
                    <td className="p-1 border text-right font-mono font-bold">{fmtRp(formCredit)}</td>
                    <td className="p-1 border text-center">{isBalanced ? '✓' : '✗'}</td>
                  </tr>
                </tfoot>
              </table>
              <Button size="sm" variant="outline" className="mt-1" onClick={() => setFLines([...fLines, { account_code: '', debit: '', credit: '' }])}>
                <Plus className="h-3 w-3 mr-1" />행 추가
              </Button>
            </div>

            <Button onClick={handleSave} disabled={saving || !isBalanced}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              저장
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bank → Journal converter */}
      <BankToJournalSection customerId={customerId} year={year} onSaved={loadData} showMsg={showMsg} />

      {/* Journal list */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-bold text-sm mb-3">{year}년 저널 ({journals.length}건)</h3>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : journals.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>저널이 없습니다. "저널 추가" 버튼으로 시작하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {journals.map(j => (
                <div key={j.id} className="p-3 rounded-lg border text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono text-[9px] bg-indigo-100 text-indigo-700">{j.entry_number}</Badge>
                      <span className="text-gray-500">{j.entry_date}</span>
                      <span className="font-medium">{j.description}</span>
                    </div>
                    <Badge variant="outline" className="text-[8px]">{j.source}</Badge>
                  </div>
                  <div className="ml-4 space-y-0.5">
                    {(j.lines || []).map((l, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="font-mono text-gray-500 w-12">{l.account_code}</span>
                        <span className="flex-1">{l.account_name || ''}</span>
                        <span className="font-mono w-28 text-right">{l.debit > 0 ? fmtRp(l.debit) : ''}</span>
                        <span className="font-mono w-28 text-right">{l.credit > 0 ? fmtRp(l.credit) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Bank → Journal Converter ──
function BankToJournalSection({
  customerId, year, onSaved, showMsg,
}: {
  customerId: string; year: number;
  onSaved: () => void;
  showMsg: (type: 'success' | 'error', text: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [preview, setPreview] = useState<Array<{
    entryDate: string; description: string;
    lines: Array<{ account_code: string; account_name: string; debit: number; credit: number }>;
    confidence: string; matchedRule: string;
  }> | null>(null);
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCsv = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const txs: Array<{ date: string; description: string; debit: number; credit: number }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 4) continue;
      txs.push({
        date: cols[0]?.trim().replace(/['"]/g, '') || '',
        description: cols[1]?.trim().replace(/['"]/g, '') || '',
        debit: Math.abs(Number(cols[2]?.replace(/[^0-9.-]/g, '')) || 0),
        credit: Math.abs(Number(cols[3]?.replace(/[^0-9.-]/g, '')) || 0),
      });
    }
    return txs;
  };

  const handlePreview = async () => {
    const txs = parseCsv(csvData);
    if (txs.length === 0) { showMsg('error', 'CSV 데이터가 없거나 형식이 맞지 않습니다'); return; }
    setProcessing(true);
    try {
      const res = await fetch('/api/accounting/bank-to-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, fiscalYear: year, transactions: txs, action: 'preview' }),
      });
      const d = await res.json();
      if (d.success) {
        setPreview(d.data.journals);
        setSummary(d.data.summary);
      } else { showMsg('error', d.error || '변환 실패'); }
    } catch { showMsg('error', '서버 오류'); }
    finally { setProcessing(false); }
  };

  const handleSave = async () => {
    const txs = parseCsv(csvData);
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank-to-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, fiscalYear: year, transactions: txs, action: 'save' }),
      });
      const d = await res.json();
      if (d.success) {
        showMsg('success', d.message);
        setPreview(null);
        setCsvData('');
        onSaved();
      } else { showMsg('error', d.error || '저장 실패'); }
    } catch { showMsg('error', '서버 오류'); }
    finally { setSaving(false); }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvData(e.target?.result as string || '');
    reader.readAsText(files[0]);
  };

  return (
    <Card className="mb-4 border-dashed border-blue-300">
      <CardContent className="p-4">
        <button type="button" onClick={() => setShow(!show)}
          className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-sm">은행거래 → 저널 자동 변환</span>
            <Badge className="bg-blue-100 text-blue-700 text-[9px]">AI</Badge>
          </div>
          <ArrowRight className={`h-4 w-4 text-gray-400 transition-transform ${show ? 'rotate-90' : ''}`} />
        </button>

        {show && (
          <div className="mt-4 space-y-3">
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
              <p className="font-bold">사용 방법</p>
              <p className="mt-1">은행 거래내역 CSV를 붙여넣거나 파일을 업로드하세요.</p>
              <p className="mt-1 font-mono text-[10px]">CSV 형식: 날짜, 설명, 출금(Debit), 입금(Credit)</p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" />CSV 파일
              </Button>
              <input ref={fileRef} type="file" className="hidden" accept=".csv,.txt"
                onChange={e => handleFileUpload(e.target.files)} />
            </div>

            <textarea
              className="w-full h-32 p-2 border rounded text-[10px] font-mono"
              value={csvData}
              onChange={e => setCsvData(e.target.value)}
              placeholder="date,description,debit,credit
2025-01-05,Pembayaran gaji karyawan,42500000,0
2025-01-08,Transfer masuk PT ABC,0,85000000
2025-01-10,Setor Pajak PPh 21,8750000,0"
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={handlePreview} disabled={processing || !csvData.trim()}>
                {processing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                미리보기
              </Button>
              {preview && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  전체 저장 ({preview.length}건)
                </Button>
              )}
            </div>

            {/* Preview */}
            {preview && (
              <div>
                <div className="flex gap-2 mb-2 text-xs">
                  <Badge className="bg-green-100 text-green-700">HIGH {summary.high}</Badge>
                  <Badge className="bg-amber-100 text-amber-700">MEDIUM {summary.medium}</Badge>
                  <Badge className="bg-red-100 text-red-700">LOW {summary.low}</Badge>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {preview.map((j, i) => (
                    <div key={i} className="p-2 rounded border text-[10px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-500">{j.entryDate}</span>
                        <span className="flex-1 truncate">{j.description}</span>
                        <Badge className={
                          j.confidence === 'HIGH' ? 'text-[8px] bg-green-100 text-green-700' :
                          j.confidence === 'MEDIUM' ? 'text-[8px] bg-amber-100 text-amber-700' :
                          'text-[8px] bg-red-100 text-red-700'
                        }>{j.confidence}</Badge>
                      </div>
                      <div className="ml-3 text-[9px] text-gray-600">
                        {j.lines.map((l, li) => (
                          <span key={li}>
                            {l.account_code} {l.account_name} {l.debit > 0 ? `Dr ${fmtRp(l.debit)}` : `Cr ${fmtRp(l.credit)}`}
                            {li < j.lines.length - 1 ? ' / ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
