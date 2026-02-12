'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';

// Helper function to format currency consistently (avoids hydration mismatch)
function formatCurrencyIDR(amount: number): string {
  // Use pure JS formatting to avoid locale-dependent issues
  const absValue = Math.abs(amount);
  const parts = absValue.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${amount < 0 ? '-' : ''}${parts.join(',')}`;
}

interface Filing {
  id: string;
  filingNumber: string;
  taxType: string;
  taxPeriod: string;
  taxYear: number;
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PAID';
  netTaxDue: number;
  submittedAt: string | null;
}

interface FilingSummaryWidgetProps {
  customerId?: string;
  limit?: number;
}

export function FilingSummaryWidget({ customerId, limit = 5 }: FilingSummaryWidgetProps) {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [filings, setFilings] = useState<Filing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    draft: 0,
    accepted: 0,
  });

  const fetchFilings = useCallback(async () => {
    if (!customerId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/tax/filings?customerId=${customerId}&limit=${limit}`
      );
      const data = await response.json();

      if (data.success) {
        setFilings(data.data);

        // Calculate stats
        const total = data.pagination?.total || data.data.length;
        const submitted = data.data.filter((f: Filing) => f.status === 'SUBMITTED').length;
        const draft = data.data.filter((f: Filing) => f.status === 'DRAFT').length;
        const accepted = data.data.filter((f: Filing) => f.status === 'ACCEPTED' || f.status === 'PAID').length;

        setStats({ total, submitted, draft, accepted });
      }
    } catch (error) {
      console.error('Failed to fetch filings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, limit]);

  useEffect(() => {
    fetchFilings();
  }, [fetchFilings]);

  const getStatusBadge = (status: Filing['status']) => {
    switch (status) {
      case 'ACCEPTED':
      case 'PAID':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'SUBMITTED':
        return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: Filing['status']) => {
    switch (status) {
      case 'ACCEPTED':
      case 'PAID':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'SUBMITTED':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'REJECTED':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatCurrency = (amount: number): string => {
    return formatCurrencyIDR(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          {t('dashboard.taxFilings') || 'Tax Filings'}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${locale}/filings`)}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
                <p className="text-xs text-gray-500">Submitted</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
                <p className="text-xs text-gray-500">Draft</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
                <p className="text-xs text-gray-500">Accepted</p>
              </div>
            </div>

            {/* Recent Filings */}
            {filings.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No tax filings yet</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(`/${locale}/tax/new`)}
                >
                  Start New Filing
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filings.map((filing) => (
                  <div
                    key={filing.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/${locale}/filings/${filing.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(filing.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {filing.taxType} - {filing.taxPeriod}
                        </p>
                        <p className="text-xs text-gray-500">
                          {filing.filingNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(filing.netTaxDue)}
                      </p>
                      {getStatusBadge(filing.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
