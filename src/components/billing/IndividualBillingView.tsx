'use client';

/**
 * INDIVIDUAL customer billing view — Phase D.
 *
 * Unlike COMPANY customers (monthly subscription), INDIVIDUALs pay per SPT
 * filing. This page surfaces:
 *
 *   1. Plan catalog (1770SS / 1770S / 1770) sourced from
 *      /api/billing/individual-spt GET, each with a "Pay + file" CTA.
 *   2. Pending transactions — customer started checkout but did not complete.
 *   3. Completed transactions — full filing payment history.
 *
 * The POST endpoint handles graceful Midtrans degradation (returns
 * `snapToken: null` + `snapError` when PG is missing). We surface the
 * resulting transaction regardless and let the user retry payment later.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Receipt,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: 'SPT_1770SS' | 'SPT_1770S' | 'SPT_1770';
  shortName: string;
  priceIdr: number;
  priceWithVat: number;
  featureCount: number;
}

interface Transaction {
  id: string;
  invoice_number: string;
  service_type: string;
  description: string | null;
  amount_total: number;
  payment_status: string;
  created_at: string;
  payment_url?: string | null;
}

interface CatalogResponse {
  plans: Plan[];
  pendingTransactions: Transaction[];
}

function fmtIdr(v: number): string {
  return `Rp ${v.toLocaleString('id-ID')}`;
}

function sptColor(id: Plan['id']) {
  if (id === 'SPT_1770SS') return { grad: 'from-blue-500 to-cyan-600', ring: 'from-blue-100 to-cyan-50', accent: 'blue' };
  if (id === 'SPT_1770S') return { grad: 'from-violet-500 to-fuchsia-600', ring: 'from-violet-100 to-fuchsia-50', accent: 'violet' };
  return { grad: 'from-emerald-500 to-teal-600', ring: 'from-emerald-100 to-teal-50', accent: 'emerald' };
}

export function IndividualBillingView() {
  const t = useTranslations('individualBilling');
  const tPlans = useTranslations('pricingPlans');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [checkoutId, setCheckoutId] = useState<Plan['id'] | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [catRes, invRes] = await Promise.all([
        fetch('/api/billing/individual-spt', { credentials: 'include' }),
        fetch('/api/billing/invoices?limit=20', { credentials: 'include' }),
      ]);
      if (catRes.ok) {
        const j = await catRes.json();
        setCatalog(j.data as CatalogResponse);
      }
      if (invRes.ok) {
        const j = await invRes.json();
        const list = (j.data ?? []) as Array<{
          id: string;
          invoiceNumber?: string;
          invoice_number?: string;
          total?: number;
          amount?: number;
          status: string;
          createdAt?: string;
          created_at?: string;
          description?: string;
        }>;
        setHistory(
          list
            .filter((i) => (i.status ?? '').toUpperCase() !== 'PENDING')
            .map((i) => ({
              id: i.id,
              invoice_number: i.invoiceNumber ?? i.invoice_number ?? '',
              service_type: '',
              description: i.description ?? null,
              amount_total: i.total ?? i.amount ?? 0,
              payment_status: i.status,
              created_at: i.createdAt ?? i.created_at ?? '',
            })),
        );
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  async function startCheckout(plan: Plan) {
    setCheckoutId(plan.id);
    setCheckoutMsg(null);
    try {
      const res = await fetch('/api/billing/individual-spt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sptType: plan.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setCheckoutMsg(j.error || t('checkoutFailed'));
        return;
      }
      if (j.data?.paymentUrl) {
        window.location.href = j.data.paymentUrl;
        return;
      }
      if (j.data?.snapToken) {
        setCheckoutMsg(t('snapTokenReady'));
        await load();
        return;
      }
      // Graceful degrade: transaction created, no Snap token (Midtrans not configured)
      setCheckoutMsg(t('pendingCreated'));
      await load();
    } catch {
      setCheckoutMsg(t('checkoutFailed'));
    } finally {
      setCheckoutId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-600" />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-6 text-sm text-red-600">
          {error || t('loadError')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-violet-200 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            {t('heroEyebrow')}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('heroTitle')}</h1>
          <p className="text-violet-200 mt-2 text-sm max-w-2xl">{t('heroSubtitle')}</p>
        </div>
      </div>

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('sectionPlans')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {catalog.plans.map((plan) => {
            const c = sptColor(plan.id);
            const busy = checkoutId === plan.id;
            return (
              <Card
                key={plan.id}
                className="rounded-2xl border-0 shadow-sm overflow-hidden flex flex-col"
              >
                <div className={cn('p-5 bg-gradient-to-br', c.ring)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', c.grad)}>
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-medium">{t('plan.perFiling')}</div>
                      <div className="font-bold text-gray-900 text-lg leading-tight">{tPlans(`${plan.id}.name`)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">
                      {fmtIdr(plan.priceIdr)}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t('plan.vatInclusive', { total: fmtIdr(plan.priceWithVat) })}
                    </div>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col bg-white">
                  <p className="text-sm text-gray-700 mb-3">{tPlans(`${plan.id}.description`)}</p>
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {Array.from({ length: plan.featureCount }, (_, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {tPlans(`${plan.id}.features.f${i + 1}`)}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn('w-full bg-gradient-to-r text-white border-0 shadow-sm hover:opacity-95', c.grad)}
                    disabled={busy}
                    onClick={() => void startCheckout(plan)}
                  >
                    {busy ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('plan.processing')}</>
                    ) : (
                      t('plan.selectCta')
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        {checkoutMsg && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{checkoutMsg}</span>
          </div>
        )}
      </div>

      {/* Pending transactions */}
      {catalog.pendingTransactions.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-amber-100 via-orange-50 to-yellow-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('sectionPending')}</div>
                <div className="text-xs text-gray-500">{t('sectionPendingHint')}</div>
              </div>
            </div>
          </div>
          <CardContent className="p-0 divide-y">
            {catalog.pendingTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-amber-50/40">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{tx.description || tx.invoice_number}</div>
                  <div className="text-xs text-gray-500 font-mono">{tx.invoice_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{fmtIdr(tx.amount_total)}</div>
                  <div className="text-xs text-amber-600">{t('pendingBadge')}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-100 via-gray-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{t('sectionHistory')}</div>
              <div className="text-xs text-gray-500">{t('sectionHistoryHint')}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">{t('emptyHistory')}</div>
          ) : (
            <div className="divide-y">
              {history.map((tx) => {
                const paid = tx.payment_status.toUpperCase() === 'PAID';
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                          paid ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {paid ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {tx.description || tx.invoice_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString('id-ID') : ''} · {tx.invoice_number}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{fmtIdr(tx.amount_total)}</div>
                      <div className={cn('text-xs', paid ? 'text-emerald-600' : 'text-gray-500')}>
                        {tx.payment_status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-[11px] text-gray-400 text-center">
        {t('footerNote')}
      </div>
    </div>
  );
}
