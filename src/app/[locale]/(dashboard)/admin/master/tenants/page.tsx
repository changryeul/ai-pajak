'use client';

/**
 * Master — ERP 테넌트 관리 (P6 follow-up, 2026-07-08)
 *
 * MonoFlip 사업운영: EXTERNAL 세무컨설팅 법인 입점 목록 + 중지/재개.
 * PLATFORM_MASTER + TAX_OPERATOR_MASTER (겸직) 접근.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, Users, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

interface TenantRow {
  id: string;
  name: string;
  legalName: string | null;
  licenseNumber: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  consultantCount: number;
  hasFirmAdmin: boolean;
  managedClientCount: number;
  subscription: { tierId: string; status: string } | null;
}

interface Summary {
  total: number;
  active: number;
  withSubscription: number;
  totalManagedClients: number;
}

export default function MasterTenantsPage() {
  const t = useTranslations('masterTenants');
  const locale = useLocale();
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const routeLocale = (params?.locale as string) || 'ko';

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role guard — 사업운영 화면: 두 마스터 모두 허용
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (!hasRole(session, UserRole.TAX_OPERATOR_MASTER, UserRole.PLATFORM_MASTER)) {
      router.replace(`/${routeLocale}/dashboard`);
    }
  }, [session, sessionLoading, router, routeLocale]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/master/tenants');
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : t('loadError'));
      } else {
        setTenants(j.data.tenants);
        setSummary(j.data.summary);
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (tenant: TenantRow) => {
    const confirmMsg = tenant.isActive
      ? t('deactivateConfirm', { name: tenant.name })
      : t('activateConfirm', { name: tenant.name });
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/master/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxPartnerId: tenant.id, isActive: !tenant.isActive }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : t('saveFailed'));
      } else {
        toast.success(tenant.isActive ? t('deactivated') : t('activated'));
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            { label: t('sumTotal'), value: summary.total },
            { label: t('sumActive'), value: summary.active },
            { label: t('sumWithSub'), value: summary.withSubscription },
            { label: t('sumClients'), value: summary.totalManagedClients },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 px-4 py-3 bg-white">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-indigo-600">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-slate-500" />
            {t('tableTitle')}
            <Badge variant="secondary">{tenants.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-8 text-center text-sm text-slate-400">
              {t('empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">{t('colTenant')}</th>
                    <th className="py-2 pr-3">{t('colLicense')}</th>
                    <th className="py-2 pr-3 text-right">{t('colStaff')}</th>
                    <th className="py-2 pr-3">{t('colAdmin')}</th>
                    <th className="py-2 pr-3 text-right">{t('colClients')}</th>
                    <th className="py-2 pr-3">{t('colSubscription')}</th>
                    <th className="py-2 pr-3">{t('colSince')}</th>
                    <th className="py-2 pr-3">{t('colStatus')}</th>
                    <th className="py-2 text-right">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tn) => (
                    <tr key={tn.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-800">{tn.name}</p>
                        {tn.email && <p className="text-xs text-slate-400">{tn.email}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">
                        {tn.licenseNumber ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{tn.consultantCount}</td>
                      <td className="py-2.5 pr-3">
                        {tn.hasFirmAdmin ? (
                          <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            {t('adminYes')}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">{t('adminNo')}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {tn.managedClientCount}
                      </td>
                      <td className="py-2.5 pr-3">
                        {tn.subscription ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            {tn.subscription.tierId}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">
                        {new Date(tn.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td className="py-2.5 pr-3">
                        {tn.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            {t('active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-500">
                            {t('inactive')}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void toggle(tn)}
                        >
                          {tn.isActive ? (
                            <>
                              <ShieldOff className="mr-1 h-3.5 w-3.5 text-red-500" />
                              {t('deactivate')}
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                              {t('activate')}
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
