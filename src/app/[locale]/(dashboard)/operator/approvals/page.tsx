'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  User,
} from 'lucide-react';

interface ApprovalItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period: number;
  tax_year: number;
  amount: number;
  status: string;
  notes: string | null;
  review_summary: Record<string, unknown> | null;
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

function fmt(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function ApprovalsPage() {
  const t = useTranslations('operator');

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state per item
  const [formState, setFormState] = useState<Record<string, {
    approvalNotes: string;
    rejectedReason: string;
    showReject: boolean;
  }>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operator/queue?status=PENDING_APPROVAL&limit=100');
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch {
      setMessage({ text: t('networkError'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (itemId: string, action: 'approve' | 'reject') => {
    const form = formState[itemId];
    if (action === 'reject' && !form?.rejectedReason?.trim()) {
      setMessage({ text: t('enterRejectedReason'), type: 'error' });
      return;
    }

    setActionLoading(itemId);
    setMessage(null);
    try {
      const res = await fetch('/api/operator/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          action,
          approvalNotes: form?.approvalNotes || undefined,
          rejectedReason: form?.rejectedReason || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: t('statusUpdated'), type: 'success' });
        setItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        setMessage({ text: data.error || t('errorOccurred'), type: 'error' });
      }
    } catch {
      setMessage({ text: t('networkError'), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const updateForm = (itemId: string, field: string, value: string | boolean) => {
    setFormState(prev => {
      const existing = prev[itemId] || { approvalNotes: '', rejectedReason: '', showReject: false };
      return {
        ...prev,
        [itemId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('approvalsTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('approvalsSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('noApprovalsNeeded')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('pendingApprovals')}: {items.length}</p>

          {items.map(item => {
            const form = formState[item.id];
            const isActing = actionLoading === item.id;

            return (
              <Card key={item.id} className="border-orange-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {item.customer?.customer_name || 'Unknown'}
                      </CardTitle>
                      <div className="text-sm text-gray-500 mt-1">
                        {item.customer?.npwp && <span>NPWP: {item.customer.npwp}</span>}
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('statusPendingApproval')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Details */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{t('taxType')}</span>
                      <p className="font-medium">{item.tax_type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('period')}</span>
                      <p className="font-medium">{item.tax_period}/{item.tax_year}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('amount')}</span>
                      <p className="font-medium">{fmt(item.amount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('createdAt')}</span>
                      <p className="font-medium">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Notes from operator */}
                  {item.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-500">{t('notes')}:</span> {item.notes}
                    </div>
                  )}

                  {/* AI Review Summary */}
                  {item.review_summary && (
                    <div className="p-3 bg-blue-50 rounded-lg text-sm">
                      <div className="flex items-center gap-1 text-blue-700 font-medium mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('reviewSummary')}
                      </div>
                      <pre className="whitespace-pre-wrap text-gray-700 text-xs">
                        {JSON.stringify(item.review_summary, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Approval Notes */}
                  <div className="space-y-2">
                    <Label>{t('approvalNotes')}</Label>
                    <Textarea
                      placeholder={t('enterApprovalNotes')}
                      value={form?.approvalNotes || ''}
                      onChange={e => updateForm(item.id, 'approvalNotes', e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Reject form */}
                  {form?.showReject && (
                    <div className="space-y-2 p-3 bg-red-50 rounded-lg">
                      <Label className="text-red-700">{t('rejectedReason')} *</Label>
                      <Textarea
                        placeholder={t('enterRejectedReason')}
                        value={form?.rejectedReason || ''}
                        onChange={e => updateForm(item.id, 'rejectedReason', e.target.value)}
                        rows={2}
                        className="border-red-200"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={isActing}
                      className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                    >
                      {isActing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {t('actionApprove')}
                    </Button>

                    {form?.showReject ? (
                      <Button
                        variant="destructive"
                        onClick={() => handleAction(item.id, 'reject')}
                        disabled={isActing || !form?.rejectedReason?.trim()}
                        className="flex-1"
                      >
                        {isActing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        {t('actionReject')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => updateForm(item.id, 'showReject', true)}
                        className="text-red-600 border-red-200 hover:bg-red-50 flex-1"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {t('actionReject')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
