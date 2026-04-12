'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, X, Send, Ban, ArrowLeft,
  FileText, Building2, Search, AlertTriangle, CheckCircle,
  Sparkles, Edit2,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

type ServiceType = 'CORPORATE_PLAN' | 'TAX_AUDIT' | 'TRANSFER_PRICING' | 'ADVISORY' | 'OTHER';
type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELED';

interface Quote {
  id: string;
  customer_id: string;
  quote_title: string;
  quote_description: string | null;
  service_type: ServiceType;
  monthly_price_idr: number | null;
  one_time_price_idr: number | null;
  valid_from: string;
  valid_until: string | null;
  status: QuoteStatus;
  usage_employees: number | null;
  usage_withholding_per_month: number | null;
  usage_ppn_per_month: number | null;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  customer?: {
    id: string;
    full_name: string;
    company_name: string | null;
    customer_type: string;
  };
}

// SERVICE_TYPE_LABELS and STATUS_LABELS are now inside the component
// so they can use useTranslations(). See the component function body.

const STATUS_COLORS: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  CANCELED: 'bg-gray-100 text-gray-500',
};

const emptyForm = {
  customerId: '',
  quoteTitle: '',
  quoteDescription: '',
  serviceType: 'CORPORATE_PLAN' as ServiceType,
  monthlyPriceIdr: '',
  oneTimePriceIdr: '',
  validUntil: '',
  notes: '',
};

export default function CustomPricingPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('customPricingAdmin');
  const locale = (params?.locale as string) || 'ko';

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
    CORPORATE_PLAN: t('svcCorporatePlan'),
    TAX_AUDIT: t('svcTaxAudit'),
    TRANSFER_PRICING: t('svcTransferPricing'),
    ADVISORY: t('svcAdvisory'),
    OTHER: t('svcOther'),
  };

  const STATUS_LABELS: Record<QuoteStatus, string> = {
    DRAFT: t('stDraft'),
    SENT: t('stSent'),
    ACCEPTED: t('stAccepted'),
    REJECTED: t('stRejected'),
    EXPIRED: t('stExpired'),
    CANCELED: t('stCanceled'),
  };

  // Role guard: master-only
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (!hasRole(session, UserRole.TAX_OPERATOR_MASTER)) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  // Preselect customer from ?customerId param (deep link from master dashboard)
  useEffect(() => {
    const preselectCustomerId = searchParams?.get('customerId');
    if (preselectCustomerId && !showForm) {
      setForm((prev) => ({ ...prev, customerId: preselectCustomerId }));
      setShowForm(true);
    }
  }, [searchParams, showForm]);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/master/custom-pricing${qs}`);
      const data = await res.json();
      if (data.success) setQuotes(data.data || []);
    } catch {
      showMsg('error', t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (q: Quote) => {
    setEditingId(q.id);
    setForm({
      customerId: q.customer_id,
      quoteTitle: q.quote_title,
      quoteDescription: q.quote_description || '',
      serviceType: q.service_type,
      monthlyPriceIdr: q.monthly_price_idr != null ? String(q.monthly_price_idr) : '',
      oneTimePriceIdr: q.one_time_price_idr != null ? String(q.one_time_price_idr) : '',
      validUntil: q.valid_until || '',
      notes: q.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.customerId || !form.quoteTitle) {
      showMsg('error', t('requiredFields'));
      return;
    }
    if (!form.monthlyPriceIdr && !form.oneTimePriceIdr) {
      showMsg('error', t('requiredPrice'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: form.customerId,
        quoteTitle: form.quoteTitle,
        quoteDescription: form.quoteDescription || undefined,
        serviceType: form.serviceType,
        monthlyPriceIdr: form.monthlyPriceIdr ? Number(form.monthlyPriceIdr) : undefined,
        oneTimePriceIdr: form.oneTimePriceIdr ? Number(form.oneTimePriceIdr) : undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
      };

      const res = await fetch('/api/admin/master/custom-pricing', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();

      if (data.success) {
        showMsg('success', editingId ? t('editSuccess') : t('saveSuccess'));
        resetForm();
        setShowForm(false);
        loadQuotes();
      } else {
        showMsg('error', data.error || t('saveFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: QuoteStatus) => {
    const transLabels: Record<QuoteStatus, string> = {
      DRAFT: t('transitionDraft'),
      SENT: t('transitionSent'),
      ACCEPTED: t('transitionAccepted'),
      REJECTED: t('transitionRejected'),
      EXPIRED: t('transitionExpired'),
      CANCELED: t('transitionCanceled'),
    };
    if (!confirm(t('confirmStatus', { status: transLabels[newStatus] }))) return;

    try {
      const res = await fetch('/api/admin/master/custom-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', t('statusChanged'));
        loadQuotes();
      } else {
        showMsg('error', data.error || t('statusChangeFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    }
  };

  const filteredQuotes = quotes.filter((q) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      q.quote_title.toLowerCase().includes(lower)
      || (q.customer?.company_name || q.customer?.full_name || '').toLowerCase().includes(lower)
    );
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/${locale}/admin/master`} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> {t('backToMaster')}
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            {t('title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? t('closeForm') : t('newQuote')}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="mb-5 border-2 border-indigo-300">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              {editingId ? t('editQuote') : t('createQuote')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('customerIdLabel')}</Label>
                <Input
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  placeholder="customer.id (UUID)"
                  className="text-xs font-mono"
                  disabled={!!editingId}
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  {t('customerIdHint')}
                </p>
              </div>
              <div>
                <Label className="text-xs">{t('serviceTypeLabel')}</Label>
                <select
                  value={form.serviceType}
                  onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}
                  className="w-full h-9 px-3 rounded-md border border-input text-sm bg-background"
                >
                  {Object.entries(SERVICE_TYPE_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">{t('quoteTitleLabel')}</Label>
                <Input
                  value={form.quoteTitle}
                  onChange={(e) => setForm({ ...form, quoteTitle: e.target.value })}
                  placeholder="{t('quoteTitlePlaceholder')}"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">{t('descriptionLabel')}</Label>
                <Textarea
                  value={form.quoteDescription}
                  onChange={(e) => setForm({ ...form, quoteDescription: e.target.value })}
                  placeholder="{t('descriptionPlaceholder')}"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs">{t('monthlyPriceLabel')}</Label>
                <Input
                  type="number"
                  value={form.monthlyPriceIdr}
                  onChange={(e) => setForm({ ...form, monthlyPriceIdr: e.target.value })}
                  placeholder="5000000"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">{t('oneTimePriceLabel')}</Label>
                <Input
                  type="number"
                  value={form.oneTimePriceIdr}
                  onChange={(e) => setForm({ ...form, oneTimePriceIdr: e.target.value })}
                  placeholder="{t('oneTimePlaceholder')}"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">{t('validUntilLabel')}</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">{t('memoLabel')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="{t('memoPlaceholder')}"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                {editingId ? t('submitEdit') : t('submitCreate')}
              </Button>
              <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                {t('cancelForm')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="{t('searchPlaceholder')}"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded text-[10px] font-medium ${
                statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? t('filterAll') : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Quote list */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {t('emptyList')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredQuotes.map((q) => (
            <Card key={q.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm">{q.quote_title}</span>
                      <Badge className={`text-[9px] ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</Badge>
                      <Badge className="bg-indigo-100 text-indigo-700 text-[9px]">
                        {SERVICE_TYPE_LABELS[q.service_type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {q.customer?.company_name || q.customer?.full_name || q.customer_id.slice(0, 8)}
                    </p>
                    {q.quote_description && (
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{q.quote_description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      {q.monthly_price_idr != null && q.monthly_price_idr > 0 && (
                        <span className="font-mono font-bold text-indigo-900">
                          {t('monthlyPrice', { amount: fmtRp(q.monthly_price_idr) })}
                        </span>
                      )}
                      {q.one_time_price_idr != null && q.one_time_price_idr > 0 && (
                        <span className="font-mono font-bold text-purple-900">
                          {t('oneTimePrice', { amount: fmtRp(q.one_time_price_idr) })}
                        </span>
                      )}
                      {q.valid_until && (
                        <span className="text-gray-500">~{q.valid_until}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {q.status === 'DRAFT' && (
                      <>
                        <Button size="sm" onClick={() => handleStatusChange(q.id, 'SENT')}>
                          <Send className="h-3 w-3 mr-1" /> {t('sendBtn')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(q)}>
                          <Edit2 className="h-3 w-3 mr-1" /> {t('editBtn')}
                        </Button>
                      </>
                    )}
                    {q.status === 'SENT' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(q.id, 'CANCELED')}
                        className="text-red-600 hover:bg-red-50">
                        <Ban className="h-3 w-3 mr-1" /> {t('cancelBtn')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
