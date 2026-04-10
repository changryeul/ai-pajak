'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { fmtRp } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  PieChart,
  ArrowRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const MultiYearComparison = dynamic(() => import('@/components/reports/MultiYearComparison'), { ssr: false });

type ReportType = 'tax_summary' | 'filing_history' | 'payment_history' | 'annual_summary';

interface ReportOption {
  id: ReportType;
  title: string;
  description: string;
  icon: typeof FileText;
}

export default function ReportsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isGenerating, setIsGenerating] = useState<ReportType | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const reportOptions: ReportOption[] = [
    {
      id: 'tax_summary',
      title: t('reports.taxSummary') || 'Tax Summary Report',
      description: t('reports.taxSummaryDesc') || 'Overview of all taxes filed and paid for the selected period',
      icon: PieChart,
    },
    {
      id: 'filing_history',
      title: t('reports.filingHistory') || 'Filing History Report',
      description: t('reports.filingHistoryDesc') || 'Complete history of all tax filings and their status',
      icon: FileText,
    },
    {
      id: 'payment_history',
      title: t('reports.paymentHistory') || 'Payment History Report',
      description: t('reports.paymentHistoryDesc') || 'Record of all tax payments and billing transactions',
      icon: DollarSign,
    },
    {
      id: 'annual_summary',
      title: t('reports.annualSummary') || 'Annual Tax Summary',
      description: t('reports.annualSummaryDesc') || 'Comprehensive annual report for SPT Tahunan preparation',
      icon: TrendingUp,
    },
  ];

  const handleGenerateReport = async (reportType: ReportType) => {
    setIsGenerating(reportType);

    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In production, this would call an API endpoint
    // For now, navigate to report detail
    router.push(`/${locale}/reports/${reportType}?year=${selectedYear}`);

    setIsGenerating(null);
  };

  const quickStats = [
    {
      label: t('reports.totalFilings'),
      value: '12',
      change: t('reports.changeThisYear', { count: '+3' }),
      icon: FileText,
      color: 'blue',
    },
    {
      label: t('reports.totalTaxPaid'),
      value: fmtRp(45500000),
      change: t('reports.changeVsLastYear', { percent: '+12%' }),
      icon: DollarSign,
      color: 'green',
    },
    {
      label: t('reports.avgProcessingTime'),
      value: t('reports.days', { count: '2.3' }),
      change: t('reports.days', { count: '-0.5' }),
      icon: Calendar,
      color: 'purple',
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('reports.title') || 'Reports'}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('reports.description') || 'Generate and download tax reports'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color];
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-green-600">{stat.change}</p>
                  </div>
                  <div className={`rounded-lg ${colors.bg} p-3`}>
                    <Icon className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Options */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t('reports.availableReports') || 'Available Reports'}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reportOptions.map((report) => {
            const Icon = report.icon;
            const isGeneratingThis = isGenerating === report.id;
            return (
              <Card key={report.id} className="hover:border-blue-300 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleGenerateReport(report.id)}
                          disabled={isGenerating !== null}
                        >
                          {isGeneratingThis ? (
                            <>
                              <span className="animate-spin mr-2">...</span>
                              {t('reports.generating')}
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-1" />
                              {t('reports.generate') || 'Generate'}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/${locale}/reports/${report.id}?year=${selectedYear}`)}
                        >
                          {t('reports.viewOnline') || 'View Online'}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Multi-Year Comparison */}
      <div className="mb-8">
        <MultiYearComparison />
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('reports.recentlyGenerated') || 'Recently Generated Reports'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t('reports.noRecentReports') || 'No reports generated yet'}</p>
            <p className="text-sm mt-1">
              {t('reports.selectReportToGenerate') || 'Select a report type above to generate your first report'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
