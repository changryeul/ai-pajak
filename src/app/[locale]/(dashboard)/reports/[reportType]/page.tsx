'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Download,
  FileText,
  PieChart,
  DollarSign,
  TrendingUp,
  Loader2,
} from 'lucide-react';

type ReportType = 'tax_summary' | 'filing_history' | 'payment_history' | 'annual_summary';

interface ReportData {
  title: string;
  generatedAt: string;
  year: string;
  data: Record<string, unknown>;
}

interface PageProps {
  params: Promise<{ reportType: string }>;
}

const VALID_REPORT_TYPES = ['tax_summary', 'filing_history', 'payment_history', 'annual_summary'];

export default function ReportViewPage({ params }: PageProps) {
  const { reportType } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = searchParams.get('year') || new Date().getFullYear().toString();

  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const reportTitles = useMemo(() => ({
    tax_summary: t('reports.taxSummary') || 'Tax Summary Report',
    filing_history: t('reports.filingHistory') || 'Filing History Report',
    payment_history: t('reports.paymentHistory') || 'Payment History Report',
    annual_summary: t('reports.annualSummary') || 'Annual Tax Summary',
  }), [t]);

  const reportIcons: Record<ReportType, typeof FileText> = {
    tax_summary: PieChart,
    filing_history: FileText,
    payment_history: DollarSign,
    annual_summary: TrendingUp,
  };

  useEffect(() => {
    // Prevent multiple fetches
    if (hasFetched) return;

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      setError(t('reports.invalidReportType') || 'Invalid report type');
      setIsLoading(false);
      return;
    }

    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch from API
        const response = await fetch(`/api/reports?type=${reportType}&year=${year}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch report');
        }

        const reportData: ReportData = {
          title: reportTitles[reportType as ReportType] || reportType,
          generatedAt: new Date().toISOString(),
          year,
          data: result.data,
        };

        setReport(reportData);
        setHasFetched(true);
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(t('reports.errorLoading') || 'Failed to load report');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [reportType, year, t, reportTitles, hasFetched]);

  const handleDownloadPdf = async () => {
    if (!report) return;

    setIsDownloading(true);

    try {
      // Create a printable version of the report
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(t('reports.popupBlocked') || 'Please allow popups to download the PDF');
        return;
      }

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${report.title} - ${year}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #1e40af; margin-bottom: 10px; }
            h2 { color: #374151; margin-top: 30px; }
            .meta { color: #6b7280; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background-color: #f9fafb; font-weight: 600; }
            .amount { text-align: right; }
            .total { font-weight: bold; background-color: #eff6ff; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <p class="meta">${t('reports.yearLabel')}: ${year} | ${t('reports.generatedAt')}: ${new Date(report.generatedAt).toLocaleString()}</p>
          <hr />
          ${generateReportHtml(reportType as ReportType, report.data)}
          <p style="margin-top: 40px; color: #9ca3af; font-size: 12px;">
            AI PAJAK - ${new Date().toLocaleDateString()}
          </p>
        </body>
        </html>
      `;

      printWindow.document.write(reportHtml);
      printWindow.document.close();

      // Use setTimeout to ensure content is rendered before printing
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          // Don't auto-close - let user decide after print dialog
        } catch (printError) {
          console.error('Print error:', printError);
        }
      }, 250);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert(t('reports.errorLoading') || 'Failed to generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const Icon = reportIcons[reportType as ReportType] || FileText;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">{t('reports.generatingReport') || 'Generating report...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
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
            <ArrowLeft className="h-5 w-5 mr-2" />
            {t('common.back')}
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {report?.title}
              </h1>
              <p className="text-gray-500">
                {t('reports.yearLabel') || 'Year'}: {year}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={handleDownloadPdf} disabled={isDownloading || !report}>
          {isDownloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t('reports.downloadPdf') || 'Download PDF'}
        </Button>
      </div>

      {/* Report Content */}
      {reportType === 'tax_summary' && report && (
        <TaxSummaryReport data={report.data} formatCurrency={formatCurrency} t={t} />
      )}

      {reportType === 'filing_history' && report && (
        <FilingHistoryReport data={report.data} t={t} />
      )}

      {reportType === 'payment_history' && report && (
        <PaymentHistoryReport data={report.data} formatCurrency={formatCurrency} t={t} />
      )}

      {reportType === 'annual_summary' && report && (
        <AnnualSummaryReport data={report.data} formatCurrency={formatCurrency} t={t} />
      )}

      {/* Generated Info */}
      <div className="mt-8 text-center text-sm text-gray-500">
        {t('reports.generatedAt') || 'Generated at'}: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : '-'}
      </div>
    </div>
  );
}

// HTML generator for PDF
function generateReportHtml(reportType: ReportType, data: Record<string, unknown>): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  switch (reportType) {
    case 'tax_summary': {
      const taxTypes = data.taxTypes as Array<{ type: string; amount: number; count: number }>;
      return `
        <h2>Summary</h2>
        <table>
          <tr><td>Total Income</td><td class="amount">${formatCurrency(data.totalIncome as number)}</td></tr>
          <tr><td>Total Deductions</td><td class="amount">${formatCurrency(data.totalDeductions as number)}</td></tr>
          <tr><td>Taxable Income</td><td class="amount">${formatCurrency(data.taxableIncome as number)}</td></tr>
          <tr class="total"><td>Tax Due</td><td class="amount">${formatCurrency(data.taxDue as number)}</td></tr>
        </table>
        <h2>Tax by Type</h2>
        <table>
          <tr><th>Type</th><th>Filings</th><th class="amount">Amount</th></tr>
          ${taxTypes?.map(t => `<tr><td>${t.type}</td><td>${t.count}</td><td class="amount">${formatCurrency(t.amount)}</td></tr>`).join('') || ''}
        </table>
      `;
    }
    case 'filing_history': {
      const filings = data.filings as Array<{ type: string; period: string; status: string; date: string }>;
      return `
        <h2>Summary</h2>
        <table>
          <tr><td>Total Filings</td><td>${data.totalFilings}</td></tr>
          <tr><td>Accepted</td><td>${data.accepted}</td></tr>
          <tr><td>Pending</td><td>${data.pending}</td></tr>
          <tr><td>Rejected</td><td>${data.rejected}</td></tr>
        </table>
        <h2>Filing History</h2>
        <table>
          <tr><th>Type</th><th>Period</th><th>Status</th><th>Date</th></tr>
          ${filings?.map(f => `<tr><td>${f.type}</td><td>${f.period}</td><td>${f.status}</td><td>${f.date}</td></tr>`).join('') || ''}
        </table>
      `;
    }
    case 'payment_history': {
      const payments = data.payments as Array<{ type: string; amount: number; date: string; status: string }>;
      return `
        <h2>Summary</h2>
        <table>
          <tr class="total"><td>Total Paid</td><td class="amount">${formatCurrency(data.totalPaid as number)}</td></tr>
        </table>
        <h2>Payment List</h2>
        <table>
          <tr><th>Type</th><th class="amount">Amount</th><th>Date</th><th>Status</th></tr>
          ${payments?.map(p => `<tr><td>${p.type}</td><td class="amount">${formatCurrency(p.amount)}</td><td>${p.date}</td><td>${p.status}</td></tr>`).join('') || ''}
        </table>
      `;
    }
    case 'annual_summary': {
      const monthlyBreakdown = data.monthlyBreakdown as Array<{ month: string; income: number; tax: number }>;
      return `
        <h2>Annual Summary</h2>
        <table>
          <tr><td>Total Income</td><td class="amount">${formatCurrency(data.totalIncome as number)}</td></tr>
          <tr><td>Total Expenses</td><td class="amount">${formatCurrency(data.totalExpenses as number)}</td></tr>
          <tr><td>Net Income</td><td class="amount">${formatCurrency(data.netIncome as number)}</td></tr>
          <tr><td>Total Tax</td><td class="amount">${formatCurrency(data.totalTax as number)}</td></tr>
          <tr class="total"><td>Effective Tax Rate</td><td class="amount">${data.effectiveTaxRate}%</td></tr>
        </table>
        <h2>Monthly Breakdown</h2>
        <table>
          <tr><th>Month</th><th class="amount">Income</th><th class="amount">Tax</th></tr>
          ${monthlyBreakdown?.map(m => `<tr><td>${m.month}</td><td class="amount">${formatCurrency(m.income)}</td><td class="amount">${formatCurrency(m.tax)}</td></tr>`).join('') || ''}
        </table>
      `;
    }
    default:
      return '<p>No data available</p>';
  }
}

// Report Components
interface ReportComponentProps {
  data: Record<string, unknown>;
  formatCurrency?: (amount: number) => string;
  t: ReturnType<typeof useTranslations>;
}

function TaxSummaryReport({ data, formatCurrency, t }: ReportComponentProps) {
  const taxTypes = data.taxTypes as Array<{ type: string; amount: number; count: number }>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.totalIncome') || 'Total Income'}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency?.(data.totalIncome as number)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.totalDeductions') || 'Total Deductions'}</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency?.(data.totalDeductions as number)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.taxableIncome') || 'Taxable Income'}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency?.(data.taxableIncome as number)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.taxDue') || 'Tax Due'}</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatCurrency?.(data.taxDue as number)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.taxByType') || 'Tax by Type'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {taxTypes?.map((tax, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{tax.type}</p>
                  <p className="text-sm text-gray-500">{tax.count} {t('reports.filings') || 'filings'}</p>
                </div>
                <p className="font-bold">{formatCurrency?.(tax.amount)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilingHistoryReport({ data, t }: ReportComponentProps) {
  const filings = data.filings as Array<{ id: string; type: string; period: string; status: string; date: string }>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-gray-900">{data.totalFilings as number}</p>
            <p className="text-sm text-gray-500 mt-1">{t('reports.totalFilings') || 'Total Filings'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-green-600">{data.accepted as number}</p>
            <p className="text-sm text-gray-500 mt-1">{t('reports.accepted') || 'Accepted'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-yellow-600">{data.pending as number}</p>
            <p className="text-sm text-gray-500 mt-1">{t('reports.pending') || 'Pending'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-red-600">{data.rejected as number}</p>
            <p className="text-sm text-gray-500 mt-1">{t('reports.rejected') || 'Rejected'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.recentFilings') || 'Recent Filings'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {filings?.map((filing) => (
              <div key={filing.id} className="flex justify-between items-center py-3">
                <div>
                  <p className="font-medium">{filing.type}</p>
                  <p className="text-sm text-gray-500">{filing.period}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    filing.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                    filing.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {filing.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">{filing.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentHistoryReport({ data, formatCurrency, t }: ReportComponentProps) {
  const payments = data.payments as Array<{ id: string; type: string; amount: number; date: string; status: string }>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500">{t('reports.totalPaid') || 'Total Paid'}</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency?.(data.totalPaid as number)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.paymentList') || 'Payment List'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {payments?.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center py-3">
                <div>
                  <p className="font-medium">{payment.type}</p>
                  <p className="text-sm text-gray-500">{payment.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency?.(payment.amount)}</p>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnnualSummaryReport({ data, formatCurrency, t }: ReportComponentProps) {
  const monthlyBreakdown = data.monthlyBreakdown as Array<{ month: string; income: number; tax: number }>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.totalIncome') || 'Total Income'}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency?.(data.totalIncome as number)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.netIncome') || 'Net Income'}</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency?.(data.netIncome as number)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.effectiveTaxRate') || 'Effective Tax Rate'}</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{data.effectiveTaxRate as number}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.monthlyBreakdown') || 'Monthly Breakdown'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {monthlyBreakdown?.map((month) => (
              <div key={month.month} className="flex justify-between items-center py-3">
                <p className="font-medium">{month.month}</p>
                <div className="flex gap-8">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('reports.income') || 'Income'}</p>
                    <p className="font-medium">{formatCurrency?.(month.income)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('reports.tax') || 'Tax'}</p>
                    <p className="font-medium text-blue-600">{formatCurrency?.(month.tax)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
