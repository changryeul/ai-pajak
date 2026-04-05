'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Plus, Save, ChevronDown, ChevronRight, Users,
  DollarSign, AlertTriangle, CheckCircle, Calculator,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Payslip {
  id: string;
  customer_id: string;
  employee_id: string;
  period: string;
  working_days: number;
  absent_days: number;
  overtime_hours: number;
  base_salary: number;
  overtime_pay: number;
  meal_allowance: number;
  transport_allowance: number;
  position_allowance: number;
  other_allowances: number;
  bonus: number;
  thr: number;
  commission: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  jht_employee: number;
  jp_employee: number;
  loan_deduction: number;
  other_deductions: number;
  total_gross: number;
  total_deduction: number;
  pph21_tax: number;
  ter_rate: number;
  net_salary: number;
  status: string;
  employee?: { id: string; employee_name: string; employee_npwp: string; ptkp_category: string; gross_salary: number };
}

interface Props {
  customerId: string;
}

export function MonthlyPayslipTab({ customerId }: Props) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [period, setPeriod] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState({ totalEmployees: 0, totalGross: 0, totalDeduction: 0, totalPph21: 0, totalNet: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadPayslips = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/monthly-payslip?customerId=${customerId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setPayslips(data.data || []);
        setSummary(data.summary || { totalEmployees: 0, totalGross: 0, totalDeduction: 0, totalPph21: 0, totalNet: 0 });
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId, period]);

  useEffect(() => { loadPayslips(); }, [loadPayslips]);

  const generatePayslips = async () => {
    if (!confirm(`${period} 급여 명세를 생성하시겠습니까? 활성 직원 전체가 복사됩니다.`)) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/monthly-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, period }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        loadPayslips();
      } else {
        showMsg('error', data.error);
      }
    } catch { showMsg('error', 'Failed'); }
    finally { setIsSaving(false); }
  };

  const updatePayslip = async (id: string, updates: Partial<Payslip>) => {
    try {
      const res = await fetch('/api/tax/monthly-payslip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        // Update locally
        setPayslips(prev => prev.map(p => p.id === id ? data.data : p));
        // Refresh summary
        loadPayslips();
      }
    } catch { /* */ }
  };

  // Month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">기간</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {payslips.length === 0 && (
          <Button size="sm" onClick={generatePayslips} disabled={isSaving || !customerId}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {period} 급여 생성
          </Button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          'p-3 rounded-xl text-sm flex items-center gap-2',
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        )}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Summary */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" />직원 수</p>
              <p className="font-bold text-lg">{summary.totalEmployees}명</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />총 지급</p>
              <p className="font-bold text-sm">{fmtRp(summary.totalGross)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">PPh 21 합계</p>
              <p className="font-bold text-sm text-blue-700">{fmtRp(summary.totalPph21)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
            <CardContent className="p-3">
              <p className="text-xs text-green-600">실수령 합계</p>
              <p className="font-bold text-sm text-green-700">{fmtRp(summary.totalNet)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
      ) : payslips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-gray-400">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">{period} 급여 명세가 없습니다</p>
            <p className="text-xs">위 버튼으로 활성 직원의 급여 명세를 생성하세요</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payslips.map(ps => {
            const isExpanded = expandedId === ps.id;
            return (
              <Card key={ps.id} className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ps.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div className="text-left min-w-0">
                        <p className="font-medium text-sm truncate">{ps.employee?.employee_name}</p>
                        <p className="text-[10px] text-gray-400">
                          {ps.employee?.ptkp_category} • {ps.employee?.employee_npwp || 'NPWP 없음'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-shrink-0">
                      <div className="text-right">
                        <p className="text-gray-400 text-[10px]">총 지급</p>
                        <p className="font-mono">{fmtRp(ps.total_gross)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-500 text-[10px]">PPh 21</p>
                        <p className="font-mono text-blue-600 font-medium">{fmtRp(ps.pph21_tax)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-500 text-[10px]">실수령</p>
                        <p className="font-mono text-green-600 font-bold">{fmtRp(ps.net_salary)}</p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-gray-50/50 space-y-4">
                      {/* 근태 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">근태</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">근무일</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.working_days}
                              onBlur={e => updatePayslip(ps.id, { working_days: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">결근일</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.absent_days}
                              onBlur={e => updatePayslip(ps.id, { absent_days: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">초과근무 (시간)</Label>
                            <Input type="number" className="h-8 text-xs" defaultValue={ps.overtime_hours}
                              onBlur={e => updatePayslip(ps.id, { overtime_hours: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 기본급 + 수당 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">기본급 + 수당</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">기본급</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.base_salary}
                              onBlur={e => updatePayslip(ps.id, { base_salary: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">초과근무 수당</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.overtime_pay}
                              onBlur={e => updatePayslip(ps.id, { overtime_pay: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">식대</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.meal_allowance}
                              onBlur={e => updatePayslip(ps.id, { meal_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">교통비</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.transport_allowance}
                              onBlur={e => updatePayslip(ps.id, { transport_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">직책수당</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.position_allowance}
                              onBlur={e => updatePayslip(ps.id, { position_allowance: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">기타 수당</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.other_allowances}
                              onBlur={e => updatePayslip(ps.id, { other_allowances: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 보너스 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">보너스</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">보너스</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bonus}
                              onBlur={e => updatePayslip(ps.id, { bonus: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">THR (명절)</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.thr}
                              onBlur={e => updatePayslip(ps.id, { thr: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">커미션</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.commission}
                              onBlur={e => updatePayslip(ps.id, { commission: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 공제 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">공제</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-[10px] text-gray-400">BPJS 건강</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bpjs_kesehatan}
                              onBlur={e => updatePayslip(ps.id, { bpjs_kesehatan: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">BPJS 고용</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.bpjs_ketenagakerjaan}
                              onBlur={e => updatePayslip(ps.id, { bpjs_ketenagakerjaan: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">JHT</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.jht_employee}
                              onBlur={e => updatePayslip(ps.id, { jht_employee: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">JP (연금)</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.jp_employee}
                              onBlur={e => updatePayslip(ps.id, { jp_employee: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">대출 상환</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.loan_deduction}
                              onBlur={e => updatePayslip(ps.id, { loan_deduction: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">기타 공제</Label>
                            <Input type="number" className="h-8 text-xs font-mono" defaultValue={ps.other_deductions}
                              onBlur={e => updatePayslip(ps.id, { other_deductions: Number(e.target.value) })} />
                          </div>
                        </div>
                      </div>

                      {/* 계산 결과 */}
                      <div className="bg-blue-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">총 지급</p>
                          <p className="font-bold text-sm">{fmtRp(ps.total_gross)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">총 공제</p>
                          <p className="font-bold text-sm">{fmtRp(ps.total_deduction)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600 flex items-center gap-1"><Calculator className="h-3 w-3" />PPh 21 (TER {(ps.ter_rate * 100).toFixed(1)}%)</p>
                          <p className="font-bold text-sm text-blue-700">{fmtRp(ps.pph21_tax)}</p>
                        </div>
                        <div>
                          <p className="text-green-600">실수령액</p>
                          <p className="font-bold text-sm text-green-700">{fmtRp(ps.net_salary)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
