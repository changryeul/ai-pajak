'use client';

/**
 * Invoices Page
 *
 * Shows all invoices with download and payment actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Eye, CreditCard, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, type Invoice } from '@/lib/billing/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  PAID: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Paid',
  },
  PENDING: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Pending',
  },
  OVERDUE: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Overdue',
  },
  DRAFT: {
    icon: Calendar,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Draft',
  },
  CANCELED: {
    icon: AlertCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    label: 'Canceled',
  },
};

export default function InvoicesPage() {
  const t = useTranslations('billing');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await fetch('/api/billing/invoices');
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDownload = async (invoiceId: string) => {
    window.open(`/api/billing/invoices/${invoiceId}/download`, '_blank');
  };

  const handlePay = async (invoiceId: string) => {
    // Redirect to payment page
    window.location.href = `/billing/pay/${invoiceId}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('invoices')}</h1>
        <p className="mt-1 text-gray-600">{t('invoicesSubtitle')}</p>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('invoice')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('date')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('dueDate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('amount')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('status')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  {t('noInvoices')}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const status = STATUS_CONFIG[invoice.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded-lg p-2', status.bgColor)}>
                          <StatusIcon className={cn('h-4 w-4', status.color)} />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500">
                            {invoice.items[0]?.description || 'Subscription'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(invoice.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(invoice.dueDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium">{formatCurrency(invoice.total)}</p>
                        <p className="text-xs text-gray-500">
                          {t('includingTax', { tax: formatCurrency(invoice.tax) })}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          status.bgColor,
                          status.color
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInvoice(invoice)}
                          title={t('view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(invoice.id)}
                          title={t('download')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                          <Button
                            size="sm"
                            onClick={() => handlePay(invoice.id)}
                            className="gap-1"
                          >
                            <CreditCard className="h-4 w-4" />
                            {t('payNow')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedInvoice.invoiceNumber}</h2>
                <p className="text-sm text-gray-500">
                  {t('issued')}: {new Date(selectedInvoice.createdAt).toLocaleDateString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Invoice Items */}
            <div className="mb-6 rounded-lg border">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      {t('description')}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      {t('qty')}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      {t('price')}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      {t('amount')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mb-6 space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('subtotal')}</span>
                <span>{formatCurrency(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('taxPPN')}</span>
                <span>{formatCurrency(selectedInvoice.tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>{t('total')}</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                {t('close')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload(selectedInvoice.id)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('downloadPDF')}
              </Button>
              {(selectedInvoice.status === 'PENDING' ||
                selectedInvoice.status === 'OVERDUE') && (
                <Button onClick={() => handlePay(selectedInvoice.id)} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t('payNow')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
