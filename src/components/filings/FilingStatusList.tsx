'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TaxFiling {
  id: string;
  taxType: string;
  taxYear: number;
  taxPeriod: string;
  status: FilingStatus;
  totalIncome: number;
  taxDue: number;
  dueDate: string | null;
  submittedAt: string | null;
  createdAt: string;
  customer?: {
    id: string;
    fullName: string;
    companyName: string | null;
    npwp: string | null;
  };
}

// Must match the tax_filing_status enum in 20251223000001_initial_schema.sql.
type FilingStatus = 'DRAFT' | 'UNDER_REVIEW' | 'FILED' | 'REJECTED';

const TAX_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'PPh21', label: 'PPh 21' },
  { value: 'PPh23', label: 'PPh 23' },
  { value: 'PPh_FINAL', label: 'PPh Final' },
  { value: 'PPN', label: 'PPN' },
  { value: 'SPT_TAHUNAN', label: 'SPT Tahunan' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'FILED', label: 'Filed' },
  { value: 'REJECTED', label: 'Rejected' },
];

interface FilingStatusListProps {
  customerId?: string;
}

export function FilingStatusList({ customerId }: FilingStatusListProps) {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [taxType, setTaxType] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 20;

  const fetchFilings = useCallback(async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (taxType !== 'all') {
        urlParams.append('taxType', taxType);
      }
      if (status !== 'all') {
        urlParams.append('status', status);
      }
      if (customerId) {
        urlParams.append('customerId', customerId);
      }
      if (searchQuery) {
        urlParams.append('search', searchQuery);
      }

      const response = await fetch(`/api/tax/filings?${urlParams}`);
      const data = await response.json();

      if (data.success) {
        setFilings(data.data);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch filings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, taxType, status, customerId, searchQuery]);

  useEffect(() => {
    fetchFilings();
  }, [fetchFilings]);

  const handleSearch = () => {
    setPage(1);
  };

  const getStatusBadge = (status: FilingStatus) => {
    const statusConfig: Record<FilingStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
      DRAFT: { variant: 'outline', className: 'bg-gray-100 text-gray-700' },
      UNDER_REVIEW: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
      FILED: { variant: 'default', className: 'bg-emerald-100 text-emerald-800' },
      REJECTED: { variant: 'destructive', className: '' },
    };

    const config = statusConfig[status] || { variant: 'outline', className: '' };

    return (
      <Badge variant={config.variant} className={config.className}>
        {t(`filings.status.${status.toLowerCase()}`)}
      </Badge>
    );
  };

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

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t('filings.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Select value={taxType} onValueChange={(v) => { setTaxType(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>
          {t('common.search')}
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {total} {t('filings.filingsFound')}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          {t('common.loading')}...
        </div>
      ) : filings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {t('filings.noFilings')}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('filings.taxType')}</TableHead>
                <TableHead>{t('filings.period')}</TableHead>
                {!customerId && <TableHead>{t('filings.customer')}</TableHead>}
                <TableHead>{t('filings.statusLabel')}</TableHead>
                <TableHead className="text-right">{t('filings.taxDue')}</TableHead>
                <TableHead>{t('filings.dueDate')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((filing) => (
                <TableRow
                  key={filing.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/${locale}/filings/${filing.id}`)}
                >
                  <TableCell>
                    <div className="font-medium">{getTaxTypeLabel(filing.taxType)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{filing.taxPeriod}</div>
                      <div className="text-gray-500">{filing.taxYear}</div>
                    </div>
                  </TableCell>
                  {!customerId && (
                    <TableCell>
                      {filing.customer && (
                        <div className="text-sm">
                          <div className="font-medium">
                            {filing.customer.companyName || filing.customer.fullName}
                          </div>
                          {filing.customer.npwp && (
                            <div className="text-gray-500 text-xs">
                              {filing.customer.npwp}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{getStatusBadge(filing.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(filing.taxDue)}
                  </TableCell>
                  <TableCell>
                    {filing.dueDate && (
                      <div className={`text-sm ${isOverdue(filing.dueDate) && filing.status !== 'FILED' ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(filing.dueDate).toLocaleDateString()}
                        {isOverdue(filing.dueDate) && filing.status !== 'FILED' && (
                          <span className="ml-1 text-xs">(Overdue)</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/${locale}/filings/${filing.id}`)}
                      >
                        {t('common.view')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {t('common.previous')}
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
