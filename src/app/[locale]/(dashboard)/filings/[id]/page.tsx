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
      <div className="flex items-center justify-between mb-8">
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
          {filing.status === 'DRAFT' && (
            <Button onClick={() => router.push(`/${locale}/tax/${filing.taxType.toLowerCase()}/${filing.id}`)}>
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
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(filing.incomeData, null, 2)}
                      </pre>
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
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(filing.deductionData, null, 2)}
                      </pre>
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

            <TabsContent value="documents" className="p-6">
              <DocumentList taxFilingId={filing.id} />
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
