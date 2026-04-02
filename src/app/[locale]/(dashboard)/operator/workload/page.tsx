'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Users,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  CheckCircle,
} from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  employee_id: string;
  email: string;
  role: string;
  max_clients: number;
  status: string;
  active_items: number;
  pending_items: number;
  in_progress_items: number;
  utilization_pct: number;
}

interface UnassignedItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  created_at: string;
  customer: { id: string; customer_name: string; npwp: string } | null;
}

interface WorkloadData {
  operators: Operator[];
  unassigned_items: UnassignedItem[];
  summary: {
    total_operators: number;
    active_operators: number;
    total_unassigned: number;
    avg_utilization_pct: number;
  };
}

export default function WorkloadPage() {
  const t = useTranslations('operator');
  const [data, setData] = useState<WorkloadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assigningItems, setAssigningItems] = useState<Record<string, string>>({});
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkOperatorId, setBulkOperatorId] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operator/workload');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const res = await fetch('/api/operator/auto-assign', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: 'success',
          text: t('autoAssignSuccess', { assigned: json.data.assigned, overflow: json.data.overflow }),
        });
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleAssignItem = async (itemId: string, operatorId: string) => {
    try {
      const res = await fetch('/api/operator/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          action: 'reassign',
          targetOperatorId: operatorId,
          reassignmentReason: 'Manual assignment from workload page',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: t('statusUpdated') });
        loadData();
      } else {
        setMessage({ type: 'error', text: json.error || t('errorOccurred') });
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkOperatorId || selectedItems.size === 0) return;
    for (const itemId of selectedItems) {
      await handleAssignItem(itemId, bulkOperatorId);
    }
    setSelectedItems(new Set());
    setBulkOperatorId('');
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge className="bg-emerald-100 text-emerald-700">{status}</Badge>;
    if (status === 'on_leave') return <Badge className="bg-yellow-100 text-yellow-700">{t('onLeave')}</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">{t('inactive')}</Badge>;
  };

  const getUtilColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600';
    if (pct >= 70) return 'text-yellow-600';
    return 'text-emerald-600';
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        <span className="ml-2 text-gray-500">{t('loadingData')}</span>
      </div>
    );
  }

  const activeOperators = data.operators.filter(op => op.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('workloadTitle')}
            </p>
            <h1 className="text-2xl font-bold mt-1">{t('workloadSubtitle')}</h1>
          </div>
          <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">{t('totalOperators')}</p>
            <p className="text-2xl font-bold">{data.summary.total_operators}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">{t('activeOperators')}</p>
            <p className="text-2xl font-bold">{data.summary.active_operators}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">{t('avgUtilization')}</p>
            <p className="text-2xl font-bold">{data.summary.avg_utilization_pct}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-violet-200">{t('unassignedItems')}</p>
            <p className="text-2xl font-bold">{data.summary.total_unassigned}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Operator Workload Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" /> {t('totalOperators')} ({data.operators.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.operators.map(op => (
            <Card key={op.id} className={op.status !== 'active' ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{op.name}</CardTitle>
                      <p className="text-xs text-gray-500">{op.employee_id}</p>
                    </div>
                  </div>
                  {getStatusBadge(op.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('activeItems')}</span>
                    <span className="font-medium">{op.active_items} / {op.max_clients}</span>
                  </div>
                  <Progress value={op.utilization_pct} className="h-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">{t('utilization')}</span>
                    <span className={`font-semibold ${getUtilColor(op.utilization_pct)}`}>
                      {op.utilization_pct}%
                    </span>
                  </div>
                  {op.utilization_pct >= 100 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {t('capacityFull')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Unassigned Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            {t('unassignedItems')} ({data.unassigned_items.length})
          </h2>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <Select value={bulkOperatorId} onValueChange={setBulkOperatorId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t('selectOperator')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeOperators.map(op => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} ({op.active_items}/{op.max_clients})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleBulkAssign} disabled={!bulkOperatorId}>
                  {t('bulkAssign')} ({selectedItems.size})
                </Button>
              </div>
            )}
            <Button
              onClick={handleAutoAssign}
              disabled={autoAssigning || data.unassigned_items.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {autoAssigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {t('autoAssignAll')}
            </Button>
          </div>
        </div>

        {data.unassigned_items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
            <p>{t('noUnassignedItems')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === data.unassigned_items.length}
                      onChange={() => {
                        if (selectedItems.size === data.unassigned_items.length) {
                          setSelectedItems(new Set());
                        } else {
                          setSelectedItems(new Set(data.unassigned_items.map(i => i.id)));
                        }
                      }}
                    />
                  </th>
                  <th className="p-3 text-left">{t('customerName')}</th>
                  <th className="p-3 text-left">{t('taxType')}</th>
                  <th className="p-3 text-left">{t('period')}</th>
                  <th className="p-3 text-right">{t('amount')}</th>
                  <th className="p-3 text-left">{t('createdAt')}</th>
                  <th className="p-3 text-left">{t('assignTo')}</th>
                </tr>
              </thead>
              <tbody>
                {data.unassigned_items.map(item => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                      />
                    </td>
                    <td className="p-3 font-medium">
                      {item.customer?.customer_name || item.customer_id.slice(0, 8)}
                      {item.customer?.npwp && (
                        <p className="text-xs text-gray-400">{item.customer.npwp}</p>
                      )}
                    </td>
                    <td className="p-3">{item.tax_type}</td>
                    <td className="p-3">{item.tax_period_year}/{String(item.tax_period_month).padStart(2, '0')}</td>
                    <td className="p-3 text-right font-mono">Rp {item.amount.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Select
                        value={assigningItems[item.id] || ''}
                        onValueChange={(val) => {
                          setAssigningItems(prev => ({ ...prev, [item.id]: val }));
                          handleAssignItem(item.id, val);
                        }}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder={t('selectOperator')} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeOperators.map(op => (
                            <SelectItem key={op.id} value={op.id} disabled={op.utilization_pct >= 100}>
                              {op.name} ({op.active_items}/{op.max_clients})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
