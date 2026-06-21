'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilingTimeline, BPEDownload } from '@/components/filings';
import { DocumentList } from '@/components/documents';

interface FilingDetail {
  id: string;
  taxType: string;
  taxYear: number;
  taxPeriod: string;
  status: string;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxDue: number;
  taxPaid: number;
  incomeData: Record<string, unknown>;
  deductionData: Record<string, unknown>;
  notes: string | null;
  dueDate: string | null;
  submittedAt: string | null;
  bpeNumber: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    companyName: string | null;
    npwp: string | null;
  };
  history: Array<{
    id: string;
    action: string;
    status: string;
    notes: string | null;
    performedBy: {
      id: string;
      fullName: string;
      role: string;
    } | null;
    createdAt: string;
  }>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FilingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const routeParams = useParams();
  const locale = routeParams.locale as string;

  const [filing, setFiling] = useState<FilingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiling = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tax/filings/${id}`);
      const data = await response.json();

      if (data.success) {
        setFiling(data.data);
      } else {
        setError(data.error || 'Failed to load filing');
      }
    } catch (err) {
      console.error('Error fetching filing:', err);
      setError('Failed to load filing');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFiling();
  }, [fetchFiling]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format field names for display
  const formatFieldName = (key: string) => {
    const fieldLabels: Record<string, string> = {
      // Income fields
      employmentIncome: t('filings.fields.employmentIncome'),
      businessIncome: t('filings.fields.businessIncome'),
      rentalIncome: t('filings.fields.rentalIncome'),
      interestIncome: t('filings.fields.interestIncome'),
      dividendIncome: t('filings.fields.dividendIncome'),
      capitalGains: t('filings.fields.capitalGains'),
      otherIncome: t('filings.fields.otherIncome'),
      grossIncome: t('filings.fields.grossIncome'),
      // Deduction fields
      personalDeduction: t('filings.fields.personalDeduction'),
      dependentDeduction: t('filings.fields.dependentDeduction'),
      pensionContribution: t('filings.fields.pensionContribution'),
      healthInsurance: t('filings.fields.healthInsurance'),
      educationExpenses: t('filings.fields.educationExpenses'),
      charitableDonations: t('filings.fields.charitableDonations'),
      otherDeductions: t('filings.fields.otherDeductions'),
    };
    return fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  // Render data object as formatted list
  const renderDataList = (data: Record<string, unknown>) => {
    return (
      <div className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
            <span className="text-gray-600 text-sm">{formatFieldName(key)}</span>
            <span className="font-medium text-sm">
              {typeof value === 'number' ? formatCurrency(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const getTaxTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      PPh21: 'PPh 21',
      PPh23: 'PPh 23',
      PPh_FINAL: 'PPh Final',
      PPN: 'PPN',
      SPT_TAHUNAN: 'SPT Tahunan',
    };
    return typeMap[type] || type;
  };

  // Map taxType to URL path for editing
  const getTaxTypeRoute = (type: string) => {
    const routeMap: Record<string, string> = {
      PPh21: 'pph21',
      PPh23: 'pph23',
      PPh_FINAL: 'pph-final',
      PPN: 'ppn',
      SPT_TAHUNAN: 'spt-tahunan',
    };
    return routeMap[type] || type.toLowerCase().replace(/_/g, '-');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
      DRAFT: { variant: 'outline', className: '' },
      PENDING_REVIEW: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800' },
      IN_REVIEW: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
      PENDING_SUBMISSION: { variant: 'secondary', className: 'bg-orange-100 text-orange-800' },
      SUBMITTED: { variant: 'secondary', className: 'bg-purple-100 text-purple-800' },
      ACCEPTED: { variant: 'default', className: 'bg-green-100 text-green-800' },
      REJECTED: { variant: 'destructive', className: '' },
      AMENDED: { variant: 'outline', className: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status] || { variant: 'outline', className: '' };

    return (
      <Badge variant={config.variant} className={config.className}>
        {t(`filings.status.${status.toLowerCase()}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !filing) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-500">{error || 'Filing not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8" id="docs-anchor">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('common.back')}
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {getTaxTypeLabel(filing.taxType)}
              </h1>
              {getStatusBadge(filing.status)}
            </div>
            <p className="text-gray-500">
              {filing.taxPeriod} {filing.taxYear}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(filing.status === 'DRAFT' || filing.status === 'UNDER_REVIEW') && (
            <Button onClick={() => router.push(`/${locale}/tax/${getTaxTypeRoute(filing.taxType)}?filingId=${filing.id}`)}>
              {t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tax Calculation Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('filings.taxSummary')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">{t('filings.totalIncome')}</span>
                <span className="font-medium">{formatCurrency(filing.totalIncome)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">{t('filings.totalDeductions')}</span>
                <span className="font-medium text-red-600">- {formatCurrency(filing.totalDeductions)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">{t('filings.taxableIncome')}</span>
                <span className="font-medium">{formatCurrency(filing.taxableIncome)}</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-blue-50 rounded px-3">
                <span className="text-blue-900 font-medium">{t('filings.taxDue')}</span>
                <span className="text-xl font-bold text-blue-900">{formatCurrency(filing.taxDue)}</span>
              </div>
              {filing.taxPaid > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('filings.taxPaid')}</span>
                  <span className="font-medium text-green-600">{formatCurrency(filing.taxPaid)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs for detailed information */}
          <Tabs defaultValue="details" className="bg-white rounded-lg shadow-sm border">
            <TabsList className="border-b w-full justify-start rounded-none bg-transparent px-4 pt-4">
              <TabsTrigger value="details">{t('filings.details')}</TabsTrigger>
              <TabsTrigger value="documents">{t('filings.documents')}</TabsTrigger>
              <TabsTrigger value="history">{t('filings.history')}</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Income Data */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('filings.incomeData')}</h4>
                  <div className="bg-gray-50 rounded p-4">
                    {Object.keys(filing.incomeData).length > 0 ? (
                      renderDataList(filing.incomeData)
                    ) : (
                      <p className="text-gray-500 text-sm">{t('filings.noData')}</p>
                    )}
                  </div>
                </div>

                {/* Deduction Data */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('filings.deductionData')}</h4>
                  <div className="bg-gray-50 rounded p-4">
                    {Object.keys(filing.deductionData).length > 0 ? (
                      renderDataList(filing.deductionData)
                    ) : (
                      <p className="text-gray-500 text-sm">{t('filings.noData')}</p>
                    )}
                  </div>
                </div>
              </div>

              {filing.notes && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">{t('filings.notes')}</h4>
                  <p className="text-gray-700 bg-gray-50 rounded p-4">{filing.notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" id="docs" className="p-6 space-y-6">
              {/* 2026-06-21: 공식 문서 카드 grid — 신고 type 별 동적 */}
              <OfficialDocumentsGrid filing={filing} formatCurrency={formatCurrency} />
              <div>
                <h4 className="font-medium text-gray-900 mb-3">{t('filings.attachedDocuments')}</h4>
                <DocumentList taxFilingId={filing.id} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="p-6">
              <FilingTimeline events={filing.history || []} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {t('filings.customerInfo')}
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">{t('filings.name')}</p>
                <p className="font-medium">{filing.customer.companyName || filing.customer.fullName}</p>
              </div>
              {filing.customer.npwp && (
                <div>
                  <p className="text-sm text-gray-500">NPWP</p>
                  <p className="font-medium font-mono">{filing.customer.npwp}</p>
                </div>
              )}
              <Button
                variant="link"
                className="p-0 h-auto text-blue-600"
                onClick={() => router.push(`/${locale}/customers/${filing.customer.id}`)}
              >
                {t('filings.viewCustomer')}
              </Button>
            </div>
          </div>

          {/* Filing Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {t('filings.filingInfo')}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('filings.createdAt')}</span>
                <span>{new Date(filing.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('filings.lastUpdated')}</span>
                <span>{new Date(filing.updatedAt).toLocaleDateString()}</span>
              </div>
              {filing.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('filings.dueDate')}</span>
                  <span className={new Date(filing.dueDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                    {new Date(filing.dueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {filing.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('filings.submittedAt')}</span>
                  <span>{new Date(filing.submittedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* BPE Download */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {t('filings.receiptStatus')}
            </h3>
            <BPEDownload
              filingId={filing.id}
              bpeInfo={{
                id: filing.id,
                bpeNumber: filing.bpeNumber,
                submittedAt: filing.submittedAt,
                acceptedAt: filing.status === 'ACCEPTED' ? filing.updatedAt : null,
                receiptUrl: filing.bpeNumber ? `/api/tax/filings/${filing.id}/bpe` : null,
              }}
              status={filing.status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2026-06-21: 공식 문서 카드 grid — 신고 type 별 동적
// ──────────────────────────────────────────────────────────────────────────
function OfficialDocumentsGrid({
  filing,
  formatCurrency,
}: {
  filing: FilingDetail;
  formatCurrency: (n: number) => string;
}) {
  const t = useTranslations();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const flash = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const downloadSPTMasaPDF = async () => {
    setDownloading('spt-masa');
    try {
      const res = await fetch('/api/tax/spt-masa-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingId: filing.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SPT_Masa_${filing.taxType}_${filing.taxPeriod}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      flash('success', t('filings.docs.downloadStarted'));
    } catch (e) {
      flash('error', e instanceof Error ? e.message : t('filings.docs.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  // 신고 type 별 가용 문서 목록
  const docs: Array<{
    key: string;
    title: string;
    desc: string;
    available: boolean;
    onDownload?: () => void;
    note?: string;
  }> = [];

  // SPT Masa PDF — 모든 월 신고 type 에 공통
  const monthlyTypes = ['PPh21', 'PPh23', 'PPh4_2', 'PPh_FINAL', 'PPN'];
  if (monthlyTypes.includes(filing.taxType)) {
    docs.push({
      key: 'spt-masa',
      title: t('filings.docs.sptMasa.title'),
      desc: t('filings.docs.sptMasa.desc', { period: filing.taxPeriod }),
      available: true,
      onDownload: downloadSPTMasaPDF,
    });
  }

  // e-Bupot 1721-A1 (PPh21) — 직원별 개별 다운로드 필요 → 안내 카드
  if (filing.taxType === 'PPh21') {
    docs.push({
      key: 'ebupot-pph21',
      title: t('filings.docs.ebupotPph21.title'),
      desc: t('filings.docs.ebupotPph21.desc'),
      available: false,
      note: t('filings.docs.ebupotPph21.note'),
    });
  }
  if (filing.taxType === 'PPh23') {
    docs.push({
      key: 'ebupot-pph23',
      title: t('filings.docs.ebupotPph23.title'),
      desc: t('filings.docs.ebupotPph23.desc'),
      available: false,
      note: t('filings.docs.ebupotPph23.note'),
    });
  }
  if (filing.taxType === 'SPT_TAHUNAN') {
    docs.push({
      key: 'spt-tahunan',
      title: t('filings.docs.sptTahunan.title'),
      desc: t('filings.docs.sptTahunan.desc'),
      available: false,
      note: t('filings.docs.sptTahunan.note'),
    });
  }

  // 항상 노출: 납부 정보 카드 (taxDue / taxPaid 표시)
  docs.push({
    key: 'payment-info',
    title: t('filings.docs.paymentInfo.title'),
    desc: `${t('filings.taxDue')}: ${formatCurrency(filing.taxDue)}${filing.taxPaid > 0 ? ` · ${t('filings.taxPaid')}: ${formatCurrency(filing.taxPaid)}` : ''}`,
    available: false,
    note: filing.bpeNumber ? `BPE ${filing.bpeNumber}` : t('filings.docs.paymentInfo.notPaidYet'),
  });

  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-3">{t('filings.docs.heading')}</h4>
      {msg && (
        <div className={`mb-3 p-2 rounded text-xs ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {docs.map((d) => (
          <div key={d.key} className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors">
            <p className="text-sm font-semibold text-slate-900">{d.title}</p>
            <p className="text-xs text-slate-500 mt-1">{d.desc}</p>
            <div className="mt-3 flex items-center justify-between">
              {d.available && d.onDownload ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={d.onDownload}
                  disabled={downloading === d.key}
                >
                  {downloading === d.key ? '...' : t('filings.docs.downloadButton')}
                </Button>
              ) : (
                <span className="text-[10px] text-slate-400">{d.note}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
