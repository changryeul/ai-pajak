'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ListChecks,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowRight,
  Upload,
  Building2,
  Loader2,
  RefreshCw,
  Headphones,
} from 'lucide-react';

interface QueueItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period: number;
  tax_year: number;
  amount: number;
  status: string;
  ebilling_code: string | null;
  bpe_number: string | null;
  bpe_date: string | null;
  notes: string | null;
  failed_reason: string | null;
  created_at: string;
  updated_at: string;
  operator_id: string;
  customer: {
    id: string;
    customer_name: string;
    npwp: string;
    customer_type: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ALL_STATUSES = [
  'PENDING',
  'DATA_REVIEW',
  'EBILLING_GENERATED',
  'PAYMENT_CONFIRMED',
  'DJP_SUBMITTED',
  'BPE_UPLOADED',
  'COMPLETED',
  'FAILED',
] as const;

const TAX_TYPES = ['PPh21', 'PPh23', 'PPh25', 'PPh29', 'PPN', 'SPT1770SS', 'SPT1770S', 'SPT1770', 'SPT1771'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  PENDING:            { label: '대기',          color: 'text-gray-700',   bg: 'bg-gray-100',    icon: Clock },
  DATA_REVIEW:        { label: '데이터 검토',   color: 'text-blue-700',   bg: 'bg-blue-100',    icon: FileText },
  EBILLING_GENERATED: { label: 'e-Billing 생성', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Building2 },
  PAYMENT_CONFIRMED:  { label: '납부 확인',     color: 'text-purple-700', bg: 'bg-purple-100',  icon: CheckCircle },
  DJP_SUBMITTED:      { label: 'DJP 제출됨',    color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Upload },
  BPE_UPLOADED:       { label: 'BPE 업로드됨',  color: 'text-teal-700',   bg: 'bg-teal-100',   icon: Upload },
  COMPLETED:          { label: '완료',          color: 'text-green-700',  bg: 'bg-green-100',   icon: CheckCircle },
  FAILED:             { label: '실패',          color: 'text-red-700',    bg: 'bg-red-100',     icon: AlertCircle },
};

const ACTION_CONFIG: Record<string, { label: string; action: string; color: string }> = {
  PENDING:            { label: '검토 시작',       action: 'review',            color: 'bg-blue-600 hover:bg-blue-700' },
  DATA_REVIEW:        { label: 'e-Billing 생성',  action: 'generate-ebilling', color: 'bg-indigo-600 hover:bg-indigo-700' },
  EBILLING_GENERATED: { label: '납부 확인',       action: 'confirm-payment',   color: 'bg-purple-600 hover:bg-purple-700' },
  PAYMENT_CONFIRMED:  { label: 'DJP 제출',       action: 'submit-djp',        color: 'bg-amber-600 hover:bg-amber-700' },
  DJP_SUBMITTED:      { label: 'BPE 업로드',     action: 'upload-bpe',        color: 'bg-teal-600 hover:bg-teal-700' },
  BPE_UPLOADED:       { label: '완료 처리',       action: 'complete',          color: 'bg-green-600 hover:bg-green-700' },
};

function fmt(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function OperatorQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTaxType, setFilterTaxType] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>('');

  // Inline edit state
  const [editState, setEditState] = useState<{
    itemId: string;
    ebillingCode: string;
    bpeNumber: string;
    bpeDate: string;
    notes: string;
    failedReason: string;
  }>({
    itemId: '',
    ebillingCode: '',
    bpeNumber: '',
    bpeDate: '',
    notes: '',
    failedReason: '',
  });

  const loadData = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterTaxType) params.set('taxType', filterTaxType);
      if (filterYear) params.set('year', filterYear);
      if (filterMonth) params.set('month', filterMonth);

      const res = await fetch(`/api/operator/queue?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.items);
        setPagination(json.data.pagination);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterTaxType, filterYear, filterMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (itemId: string, action: string) => {
    // For actions that need input, expand the row instead
    if (action === 'generate-ebilling' || action === 'upload-bpe') {
      setExpandedId(itemId);
      setEditState({
        itemId,
        ebillingCode: '',
        bpeNumber: '',
        bpeDate: '',
        notes: '',
        failedReason: '',
      });
      return;
    }

    await executeAction(itemId, action, {});
  };

  const executeAction = async (
    itemId: string,
    action: string,
    extra: Record<string, string>
  ) => {
    setActionLoading(itemId);
    try {
      const res = await fetch('/api/operator/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, action, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: json.message || '상태가 업데이트되었습니다.', type: 'success' });
        setExpandedId(null);
        loadData(pagination.page);
      } else {
        setMessage({ text: json.error || '오류가 발생했습니다.', type: 'error' });
      }
    } catch {
      setMessage({ text: '네트워크 오류가 발생했습니다.', type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleExpandedSubmit = (action: string) => {
    const extra: Record<string, string> = {};
    if (action === 'generate-ebilling') {
      if (!editState.ebillingCode) return;
      extra.ebillingCode = editState.ebillingCode;
    }
    if (action === 'upload-bpe') {
      if (!editState.bpeNumber || !editState.bpeDate) return;
      extra.bpeNumber = editState.bpeNumber;
      extra.bpeDate = editState.bpeDate;
    }
    if (editState.notes) extra.notes = editState.notes;
    executeAction(editState.itemId, action, extra);
  };

  const handleFail = (itemId: string) => {
    const extra: Record<string, string> = {};
    if (editState.failedReason) extra.failedReason = editState.failedReason;
    if (editState.notes) extra.notes = editState.notes;
    executeAction(itemId, 'fail', extra);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10">
          <p className="text-indigo-200 text-sm flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            Tax Operator
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">접수 대기열</h1>
          <p className="text-indigo-100 text-sm mt-2">세금 신고 접수 건을 상세하게 관리합니다.</p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Status filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">상태</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">전체</option>
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                ))}
              </select>
            </div>

            {/* Tax Type filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">세금 유형</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterTaxType}
                onChange={(e) => setFilterTaxType(e.target.value)}
              >
                <option value="">전체</option>
                {TAX_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Year filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">연도</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">전체</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">월</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="">전체</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => loadData()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                검색
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary Bar */}
      {!isLoading && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = items.filter(i => i.status === s).length;
            const isActive = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(isActive ? '' : s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {cfg.label}
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                  isActive ? 'bg-white/50' : 'bg-gray-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Queue Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            대기열 ({pagination.total}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-gray-500 mt-2">로딩 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <ListChecks className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">해당하는 항목이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {items.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                const actionCfg = ACTION_CONFIG[item.status];
                const isExpanded = expandedId === item.id;
                const StatusIcon = statusCfg.icon;

                return (
                  <div key={item.id} className="border-b last:border-0">
                    {/* Row */}
                    <div
                      className="flex items-center gap-3 py-3 px-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusCfg.color}`} />

                      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
                        {/* Customer */}
                        <div className="col-span-2 md:col-span-2">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {item.customer?.customer_name || '-'}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {item.customer?.npwp || '-'}
                          </p>
                        </div>

                        {/* Tax Type */}
                        <div>
                          <Badge variant="outline" className="text-[10px]">
                            {item.tax_type}
                          </Badge>
                        </div>

                        {/* Period */}
                        <div className="text-xs text-gray-600">
                          {item.tax_year}/{String(item.tax_period).padStart(2, '0')}
                        </div>

                        {/* Amount */}
                        <div className="text-xs font-mono text-right">
                          {fmt(item.amount || 0)}
                        </div>

                        {/* Status */}
                        <div className="text-center">
                          <Badge className={`text-[10px] ${statusCfg.bg} ${statusCfg.color} border-0`}>
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {actionCfg && (
                          <Button
                            size="sm"
                            className={`text-[10px] h-7 text-white ${actionCfg.color}`}
                            disabled={actionLoading === item.id}
                            onClick={() => handleAction(item.id, actionCfg.action)}
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                {actionCfg.label}
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-3 pb-4 bg-gray-50 border-t">
                        <div className="grid md:grid-cols-2 gap-4 pt-4">
                          {/* Details */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">상세 정보</h4>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">고객 유형:</span>
                                <p className="font-medium">{item.customer?.customer_type || '-'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">접수일:</span>
                                <p className="font-medium">{new Date(item.created_at).toLocaleDateString('ko-KR')}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">최종 업데이트:</span>
                                <p className="font-medium">{new Date(item.updated_at).toLocaleDateString('ko-KR')}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">금액:</span>
                                <p className="font-medium font-mono">{fmt(item.amount || 0)}</p>
                              </div>
                            </div>

                            {item.ebilling_code && (
                              <div className="text-xs">
                                <span className="text-gray-500">e-Billing 코드:</span>
                                <p className="font-mono font-medium bg-white px-2 py-1 rounded mt-1">{item.ebilling_code}</p>
                              </div>
                            )}

                            {item.bpe_number && (
                              <div className="text-xs">
                                <span className="text-gray-500">BPE 번호:</span>
                                <p className="font-mono font-medium bg-white px-2 py-1 rounded mt-1">{item.bpe_number}</p>
                              </div>
                            )}

                            {item.bpe_date && (
                              <div className="text-xs">
                                <span className="text-gray-500">BPE 날짜:</span>
                                <p className="font-medium">{new Date(item.bpe_date).toLocaleDateString('ko-KR')}</p>
                              </div>
                            )}

                            {item.notes && (
                              <div className="text-xs">
                                <span className="text-gray-500">메모:</span>
                                <p className="mt-1 bg-white p-2 rounded text-gray-700">{item.notes}</p>
                              </div>
                            )}

                            {item.failed_reason && (
                              <div className="text-xs">
                                <span className="text-red-500">실패 사유:</span>
                                <p className="mt-1 bg-red-50 p-2 rounded text-red-700">{item.failed_reason}</p>
                              </div>
                            )}
                          </div>

                          {/* Action Form */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">액션</h4>

                            {/* e-Billing input for DATA_REVIEW status */}
                            {item.status === 'DATA_REVIEW' && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-700 block mb-1">
                                    e-Billing 코드 *
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e-Billing 코드 입력"
                                    value={editState.itemId === item.id ? editState.ebillingCode : ''}
                                    onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, ebillingCode: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                                  disabled={actionLoading === item.id || !editState.ebillingCode}
                                  onClick={() => handleExpandedSubmit('generate-ebilling')}
                                >
                                  {actionLoading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Building2 className="h-3 w-3 mr-1" />
                                  )}
                                  e-Billing 생성
                                </Button>
                              </div>
                            )}

                            {/* BPE input for DJP_SUBMITTED status */}
                            {item.status === 'DJP_SUBMITTED' && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-700 block mb-1">
                                    BPE 번호 *
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="BPE 번호 입력"
                                    value={editState.itemId === item.id ? editState.bpeNumber : ''}
                                    onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, bpeNumber: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-700 block mb-1">
                                    BPE 날짜 *
                                  </label>
                                  <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editState.itemId === item.id ? editState.bpeDate : ''}
                                    onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, bpeDate: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs"
                                  disabled={actionLoading === item.id || !editState.bpeNumber || !editState.bpeDate}
                                  onClick={() => handleExpandedSubmit('upload-bpe')}
                                >
                                  {actionLoading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Upload className="h-3 w-3 mr-1" />
                                  )}
                                  BPE 업로드
                                </Button>
                              </div>
                            )}

                            {/* Notes field for all statuses */}
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">메모</label>
                              <textarea
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                rows={2}
                                placeholder="메모 입력 (선택사항)"
                                value={editState.itemId === item.id ? editState.notes : ''}
                                onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, notes: e.target.value }))}
                              />
                            </div>

                            {/* Fail action - available for any status except COMPLETED/FAILED */}
                            {!['COMPLETED', 'FAILED'].includes(item.status) && (
                              <div className="pt-2 border-t">
                                <div className="mb-2">
                                  <label className="text-xs font-medium text-red-600 block mb-1">실패 사유</label>
                                  <input
                                    type="text"
                                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    placeholder="실패 사유 입력"
                                    value={editState.itemId === item.id ? editState.failedReason : ''}
                                    onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, failedReason: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full text-red-600 border-red-200 hover:bg-red-50 text-xs"
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleFail(item.id)}
                                >
                                  {actionLoading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                  )}
                                  실패 처리
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <p className="text-xs text-gray-500">
                {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => loadData(pagination.page - 1)}
                  className="text-xs"
                >
                  이전
                </Button>
                <span className="text-xs text-gray-500 flex items-center px-2">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadData(pagination.page + 1)}
                  className="text-xs"
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
