'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
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
  Repeat2,
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
  closing_session_id: string | null;
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

// Coretax era: 납부 = 신고 — PAYMENT_UPLOADED/PAYMENT_VERIFIED/DJP_SUBMITTED/
// BPE_UPLOADED 4개 구방식 상태 제거. PAYMENT_PENDING(고객 전송·납부대기)이
// 실질 종료 상태이며 COMPLETED 는 향후 Coretax 연동의 자동완료 전용.
const ALL_STATUSES = [
  'PENDING',
  'DATA_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'EBILLING_GENERATED',
  'PAYMENT_PENDING',
  'COMPLETED',
  'FAILED',
] as const;

const TAX_TYPES = ['PPh21', 'PPh23', 'PPh25', 'PPh29', 'PPN', 'SPT1770SS', 'SPT1770S', 'SPT1770'];

function fmt(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

interface OperatorOption {
  id: string;
  name: string;
  active_items: number;
  max_clients: number;
}

export default function OperatorQueuePage() {
  const t = useTranslations('operator');
  const tq = useTranslations('operatorQueue');
  const { session } = useSession();

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
    PENDING:            { label: t('statusPending'),           color: 'text-gray-700',    bg: 'bg-gray-100',     icon: Clock },
    DATA_REVIEW:        { label: t('statusDataReview'),        color: 'text-blue-700',    bg: 'bg-blue-100',     icon: FileText },
    PENDING_APPROVAL:   { label: t('statusPendingApproval'),   color: 'text-orange-700',  bg: 'bg-orange-100',   icon: Clock },
    APPROVED:           { label: t('statusApproved'),          color: 'text-emerald-700', bg: 'bg-emerald-100',  icon: CheckCircle },
    EBILLING_GENERATED: { label: t('statusEbillingGenerated'), color: 'text-indigo-700',  bg: 'bg-indigo-100',   icon: Building2 },
    PAYMENT_PENDING:    { label: t('statusPaymentPending'),    color: 'text-yellow-700',  bg: 'bg-yellow-100',   icon: Clock },
    COMPLETED:          { label: t('statusCompleted'),         color: 'text-green-700',   bg: 'bg-green-100',    icon: CheckCircle },
    FAILED:             { label: t('statusFailed'),            color: 'text-red-700',     bg: 'bg-red-100',      icon: AlertCircle },
  };

  const ACTION_CONFIG: Record<string, { label: string; action: string; color: string }> = {
    PENDING:            { label: t('actionReview'),            action: 'review',            color: 'bg-blue-600 hover:bg-blue-700' },
    DATA_REVIEW:        { label: t('actionRequestApproval'),   action: 'request-approval',  color: 'bg-orange-600 hover:bg-orange-700' },
    PENDING_APPROVAL:   { label: t('actionApprove'),           action: 'approve',           color: 'bg-emerald-600 hover:bg-emerald-700' },
    APPROVED:           { label: t('actionGenerateEbilling'),  action: 'generate-ebilling', color: 'bg-indigo-600 hover:bg-indigo-700' },
    EBILLING_GENERATED: { label: t('actionNotifyCustomer'),    action: 'notify-customer',   color: 'bg-yellow-600 hover:bg-yellow-700' },
    // PAYMENT_PENDING 이후는 고객 납부 대기 — Coretax 가 NTPN 을 자동 생성하므로
    // 운영팀 수동 액션 없음 (완료 전이는 향후 Coretax 연동 자동화 전용).
  };

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
  // 'all' | 'monthly' | 'closing' — 결산건만 보고 싶을 때 사용
  const [filterKind, setFilterKind] = useState<string>('all');

  // Inline edit state
  const [editState, setEditState] = useState<{
    itemId: string;
    ebillingCode: string;
    notes: string;
    failedReason: string;
  }>({
    itemId: '',
    ebillingCode: '',
    notes: '',
    failedReason: '',
  });

  // Reassign state (supervisor only)
  const isSupervisor = session?.role === UserRole.TAX_OPERATOR_LEAD || session?.role === UserRole.TAX_OPERATOR_SUPERVISOR;
  const [reassignItemId, setReassignItemId] = useState<string | null>(null);
  const [reassignOperatorId, setReassignOperatorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [operators, setOperators] = useState<OperatorOption[]>([]);

  useEffect(() => {
    if (isSupervisor) {
      fetch('/api/operator/workload')
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            setOperators(json.data.operators.filter((op: OperatorOption & { status: string }) => op.status === 'active'));
          }
        })
        .catch(() => {});
    }
  }, [isSupervisor]);

  const handleReassign = async (itemId: string) => {
    if (!reassignOperatorId || !reassignReason) return;
    setActionLoading(itemId);
    try {
      const res = await fetch('/api/operator/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          action: 'reassign',
          targetOperatorId: reassignOperatorId,
          reassignmentReason: reassignReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: t('reassignSuccess'), type: 'success' });
        setReassignItemId(null);
        setReassignOperatorId('');
        setReassignReason('');
        loadData();
      } else {
        setMessage({ text: json.error || t('errorOccurred'), type: 'error' });
      }
    } catch {
      setMessage({ text: t('networkError'), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const loadData = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterTaxType) params.set('taxType', filterTaxType);
      if (filterYear) params.set('year', filterYear);
      if (filterMonth) params.set('month', filterMonth);
      if (filterKind && filterKind !== 'all') params.set('kind', filterKind);

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
  }, [filterStatus, filterTaxType, filterYear, filterMonth, filterKind]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (itemId: string, action: string) => {
    // For actions that need input, expand the row instead
    if (action === 'generate-ebilling') {
      setExpandedId(itemId);
      setEditState({
        itemId,
        ebillingCode: '',
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
        setMessage({ text: json.message || t('statusUpdated'), type: 'success' });
        setExpandedId(null);
        loadData(pagination.page);
      } else {
        setMessage({ text: json.error || t('errorOccurred'), type: 'error' });
      }
    } catch {
      setMessage({ text: t('networkError'), type: 'error' });
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
    if (editState.notes) extra.notes = editState.notes;
    executeAction(editState.itemId, action, extra);
  };

  const handleFail = (itemId: string) => {
    const extra: Record<string, string> = {};
    if (editState.failedReason) extra.failedReason = editState.failedReason;
    if (editState.notes) extra.notes = editState.notes;
    executeAction(itemId, 'fail', extra);
  };

  // Supervisor reject for PENDING_APPROVAL rows. Uses window.prompt for the
  // reason field — a richer inline form would be nicer but requires more
  // state plumbing; the API requires `rejectedReason` so we capture the
  // minimum here.
  const handleReject = (itemId: string) => {
    const reason = window.prompt(tq('rejectReasonPrompt'));
    if (!reason || !reason.trim()) {
      setMessage({ text: tq('rejectReasonRequired'), type: 'error' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    executeAction(itemId, 'reject', { rejectedReason: reason.trim() });
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
            {t('taxOperator')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('queueTitle')}</h1>
          <p className="text-indigo-100 text-sm mt-2">{t('queueSubtitle')}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            {/* Kind filter (월신고 / 연결산) */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{tq('kindFilter')}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
              >
                <option value="all">{tq('kindAll')}</option>
                <option value="monthly">{tq('kindMonthly')}</option>
                <option value="closing">{tq('kindClosing')}</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{t('filterStatus')}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">{t('filterAll')}</option>
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                ))}
              </select>
            </div>

            {/* Tax Type filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{t('filterTaxType')}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterTaxType}
                onChange={(e) => setFilterTaxType(e.target.value)}
              >
                <option value="">{t('filterAll')}</option>
                {TAX_TYPES.map(tt => (
                  <option key={tt} value={tt}>{tt}</option>
                ))}
              </select>
            </div>

            {/* Year filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{t('filterYear')}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">{t('filterAll')}</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{t('filterMonth')}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="">{t('filterAll')}</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
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
                {t('searchButton')}
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
            {t('queueListCount', { count: pagination.total })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-gray-500 mt-2">{t('loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <ListChecks className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">{t('noItems')}</p>
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
                    {/* Desktop row (md+) */}
                    <div
                      className="hidden md:flex items-center gap-3 py-3 px-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusCfg.color}`} />

                      <div className="flex-1 min-w-0 grid grid-cols-6 gap-2 items-center">
                        {/* Customer */}
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {item.customer?.customer_name || '-'}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {item.customer?.npwp || '-'}
                          </p>
                        </div>

                        {/* Tax Type (+ closing badge if linked to a closing session) */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {item.tax_type}
                          </Badge>
                          {item.closing_session_id && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border-0">
                              {tq('closingBadge')}
                            </Badge>
                          )}
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

                      {/* Action (desktop) */}
                      <div className="flex-shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                        {/* Supervisor-only reject button for PENDING_APPROVAL rows */}
                        {item.status === 'PENDING_APPROVAL' && isSupervisor && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-7 border-red-200 text-red-700 hover:bg-red-50"
                            disabled={actionLoading === item.id}
                            onClick={() => handleReject(item.id)}
                          >
                            {tq('reject')}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Mobile card (< md) */}
                    <div
                      className="md:hidden py-4 px-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        <StatusIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${statusCfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.customer?.customer_name || '-'}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate font-mono">
                            {item.customer?.npwp || '—'}
                          </p>
                        </div>
                        <Badge className={`text-[10px] flex-shrink-0 ${statusCfg.bg} ${statusCfg.color} border-0`}>
                          {statusCfg.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-3 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {item.tax_type}
                          </Badge>
                          {item.closing_session_id && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border-0">
                              {tq('closingBadge')}
                            </Badge>
                          )}
                          <span className="text-gray-500">
                            {item.tax_year}/{String(item.tax_period).padStart(2, '0')}
                          </span>
                        </div>
                        <span className="font-mono text-gray-900 text-right">
                          {fmt(item.amount || 0)}
                        </span>
                      </div>

                      {/* Mobile action row — full-width buttons with min-h-11 (44px tap target) */}
                      {(actionCfg || (item.status === 'PENDING_APPROVAL' && isSupervisor)) && (
                        <div
                          className="flex gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionCfg && (
                            <Button
                              className={`flex-1 min-h-11 text-xs font-bold text-white ${actionCfg.color}`}
                              disabled={actionLoading === item.id}
                              onClick={() => handleAction(item.id, actionCfg.action)}
                            >
                              {actionLoading === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {actionCfg.label}
                                  <ArrowRight className="h-4 w-4 ml-1" />
                                </>
                              )}
                            </Button>
                          )}
                          {item.status === 'PENDING_APPROVAL' && isSupervisor && (
                            <Button
                              variant="outline"
                              className="flex-1 min-h-11 text-xs font-bold border-red-200 text-red-700 hover:bg-red-50"
                              disabled={actionLoading === item.id}
                              onClick={() => handleReject(item.id)}
                            >
                              {tq('reject')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-3 pb-4 bg-gray-50 border-t">
                        {item.closing_session_id && (
                          <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                            {tq('closingHint')}
                          </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-4 pt-4">
                          {/* Details */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('details')}</h4>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">{t('customerType')}:</span>
                                <p className="font-medium">{item.customer?.customer_type || '-'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">{t('createdAt')}:</span>
                                <p className="font-medium">{new Date(item.created_at).toLocaleDateString('ko-KR')}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">{t('updatedAt')}:</span>
                                <p className="font-medium">{new Date(item.updated_at).toLocaleDateString('ko-KR')}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">{t('amount')}:</span>
                                <p className="font-medium font-mono">{fmt(item.amount || 0)}</p>
                              </div>
                            </div>

                            {item.ebilling_code && (
                              <div className="text-xs">
                                <span className="text-gray-500">{t('ebillingCode')}:</span>
                                <p className="font-mono font-medium bg-white px-2 py-1 rounded mt-1">{item.ebilling_code}</p>
                              </div>
                            )}

                            {item.bpe_number && (
                              <div className="text-xs">
                                <span className="text-gray-500">{t('bpeNumber')}:</span>
                                <p className="font-mono font-medium bg-white px-2 py-1 rounded mt-1">{item.bpe_number}</p>
                              </div>
                            )}

                            {item.bpe_date && (
                              <div className="text-xs">
                                <span className="text-gray-500">{t('bpeDate')}:</span>
                                <p className="font-medium">{new Date(item.bpe_date).toLocaleDateString('ko-KR')}</p>
                              </div>
                            )}

                            {item.notes && (
                              <div className="text-xs">
                                <span className="text-gray-500">{t('notes')}:</span>
                                <p className="mt-1 bg-white p-2 rounded text-gray-700">{item.notes}</p>
                              </div>
                            )}

                            {item.failed_reason && (
                              <div className="text-xs">
                                <span className="text-red-500">{t('failReason')}:</span>
                                <p className="mt-1 bg-red-50 p-2 rounded text-red-700">{item.failed_reason}</p>
                              </div>
                            )}
                          </div>

                          {/* Action Form */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('action')}</h4>

                            {/* e-Billing input for DATA_REVIEW status */}
                            {item.status === 'DATA_REVIEW' && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-700 block mb-1">
                                    {t('ebillingCodeRequired')}
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={t('enterEbillingCodePlaceholder')}
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
                                  {t('actionGenerateEbilling')}
                                </Button>
                              </div>
                            )}

                            {/* Notes field for all statuses */}
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">{t('notes')}</label>
                              <textarea
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                rows={2}
                                placeholder={t('notesInputPlaceholder')}
                                value={editState.itemId === item.id ? editState.notes : ''}
                                onChange={(e) => setEditState(prev => ({ ...prev, itemId: item.id, notes: e.target.value }))}
                              />
                            </div>

                            {/* Fail action - available for any status except COMPLETED/FAILED */}
                            {!['COMPLETED', 'FAILED'].includes(item.status) && (
                              <div className="pt-2 border-t">
                                <div className="mb-2">
                                  <label className="text-xs font-medium text-red-600 block mb-1">{t('failReason')}</label>
                                  <input
                                    type="text"
                                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    placeholder={t('enterFailReasonPlaceholder')}
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
                                  {t('actionFail')}
                                </Button>
                              </div>
                            )}

                            {/* Reassign - supervisor only, not COMPLETED/FAILED */}
                            {isSupervisor && !['COMPLETED', 'FAILED'].includes(item.status) && (
                              <div className="pt-2 border-t">
                                {reassignItemId === item.id ? (
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-violet-600 block">{t('reassignOperator')}</label>
                                    <Select value={reassignOperatorId} onValueChange={setReassignOperatorId}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder={t('selectOperator')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {operators.map(op => (
                                          <SelectItem key={op.id} value={op.id}>
                                            {op.name} ({op.active_items}/{op.max_clients})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <input
                                      type="text"
                                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                      placeholder={t('reassignReason')}
                                      value={reassignReason}
                                      onChange={e => setReassignReason(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-xs"
                                        disabled={!reassignOperatorId || !reassignReason || actionLoading === item.id}
                                        onClick={() => handleReassign(item.id)}
                                      >
                                        {actionLoading === item.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Repeat2 className="h-3 w-3 mr-1" />}
                                        {t('reassignConfirm')}
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setReassignItemId(null)}>
                                        {t('cancel')}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full text-violet-600 border-violet-200 hover:bg-violet-50 text-xs"
                                    onClick={() => setReassignItemId(item.id)}
                                  >
                                    <Repeat2 className="h-3 w-3 mr-1" />
                                    {t('reassign')}
                                  </Button>
                                )}
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-4 mt-4 border-t">
              <p className="text-xs text-gray-500 text-center sm:text-left">
                {t('itemsRange', {
                  total: pagination.total,
                  start: (pagination.page - 1) * pagination.limit + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                })}
              </p>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => loadData(pagination.page - 1)}
                  className="text-xs min-h-10 flex-1 sm:flex-none"
                >
                  {t('previous')}
                </Button>
                <span className="text-xs text-gray-500 flex items-center px-2">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadData(pagination.page + 1)}
                  className="text-xs min-h-10 flex-1 sm:flex-none"
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
