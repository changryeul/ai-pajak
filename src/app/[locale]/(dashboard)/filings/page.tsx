'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FilingStatusList } from '@/components/filings';
import { CompanyFilingsView } from '@/components/filings/CompanyFilingsView';
import { PageTitle } from '@/components/layout/PageTitle';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { FileText, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

interface StatResponse {
  total: number;
  underReview: number;
  filed: number;
  rejected: number;
}

export default function FilingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { session } = useSession();

  const [stats, setStats] = useState<StatResponse | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        // Single fetch with a big limit; cheaper than firing 4 filtered queries.
        const res = await fetch('/api/tax/filings?limit=200', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const filings = (json?.data as { status: string }[]) || [];
        setStats({
          total: filings.length,
          underReview: filings.filter((f) => f.status === 'UNDER_REVIEW').length,
          filed: filings.filter((f) => f.status === 'FILED').length,
          rejected: filings.filter((f) => f.status === 'REJECTED').length,
        });
      } catch {
        /* non-fatal */
      }
    }
    loadStats();
  }, []);

  // COMPANY customers see the redesigned filings history view (yearly/monthly,
  // status cards, NTPN/BPE columns, AI auto-processing).
  if (session && hasRole(session, UserRole.CUSTOMER) && session.customerType === 'COMPANY') {
    return <CompanyFilingsView />;
  }

  const fmt = (n: number | null | undefined) => (n == null ? '—' : String(n));
  const cards = [
    { label: t('filings.totalFilings'), value: stats?.total, icon: FileText, color: 'bg-blue-100 text-blue-600' },
    { label: t('filings.pendingReview'), value: stats?.underReview, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
    { label: t('filings.accepted'), value: stats?.filed, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    { label: t('filings.overdue'), value: stats?.rejected, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <PageTitle title="Pelaporan Pajak" />
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('filings.title')}</h1>
          <p className="text-gray-500 mt-1">{t('filings.description')}</p>
        </div>
        <Button onClick={() => router.push(`/${locale}/tax/spt-tahunan`)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('tax.newFiling')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{fmt(c.value)}</p>
                  <p className="text-sm text-gray-500">{c.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <FilingStatusList />
      </div>
    </div>
  );
}
