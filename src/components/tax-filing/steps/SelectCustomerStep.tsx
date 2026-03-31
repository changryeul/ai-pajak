'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTaxFilingStore, TaxType, CustomerData } from '@/stores/tax-filing-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TAX_TYPE_VALUES: TaxType[] = ['PPh21', 'PPh23', 'PPh_FINAL', 'PPN', 'SPT_TAHUNAN'];

export function SelectCustomerStep() {
  const t = useTranslations();
  const {
    customer,
    taxType,
    taxPeriod,
    taxYear,
    setCustomer,
    setTaxType,
    setTaxPeriod,
    setTaxYear,
  } = useTaxFilingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (searchQuery.length < 2) {
        setCustomers([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/customers?search=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await response.json();
        if (data.success) {
          interface CustomerApiResponse {
            id: string;
            full_name: string;
            company_name: string | null;
            npwp: string | null;
            customer_type: string;
            email: string | null;
          }
          setCustomers(data.data.map((c: CustomerApiResponse) => ({
            id: c.id,
            fullName: c.full_name,
            companyName: c.company_name,
            npwp: c.npwp,
            customerType: c.customer_type,
            email: c.email,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const tt = useTranslations('taxTypes');
  const tm = useTranslations('months');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
  const months = monthKeys.map((key, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: tm(key),
  }));

  return (
    <div className="space-y-6">
      {/* Tax Type Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">{t('tax.selectTaxType')}</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TAX_TYPE_VALUES.map((type) => (
            <div
              key={type}
              onClick={() => setTaxType(type)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                taxType === type
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">{tt(type)}</div>
              <div className="text-sm text-gray-500">{tt(`${type}Desc`)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Period Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('tax.taxYear')}</Label>
          <Select
            value={taxYear.toString()}
            onValueChange={(v) => setTaxYear(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('tax.selectYear')} />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {taxType !== 'SPT_TAHUNAN' && (
          <div className="space-y-2">
            <Label>{t('tax.taxPeriod')}</Label>
            <Select
              value={taxPeriod}
              onValueChange={setTaxPeriod}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('tax.selectMonth')} />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Customer Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">{t('tax.selectCustomer')}</Label>

        {customer ? (
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-green-900">
                  {customer.customerType === 'COMPANY'
                    ? customer.companyName
                    : customer.fullName}
                </div>
                <div className="text-sm text-green-700">
                  {customer.npwp && `NPWP: ${customer.npwp}`}
                </div>
                <div className="text-sm text-green-600">{customer.email}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomer(null)}
              >
                {t('common.change')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder={t('tax.searchCustomer')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {isLoading && (
              <div className="text-center py-4 text-gray-500">
                {t('common.loading')}...
              </div>
            )}

            {customers.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCustomer(c);
                      setSearchQuery('');
                      setCustomers([]);
                    }}
                    className="p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="font-medium">
                      {c.customerType === 'COMPANY' ? c.companyName : c.fullName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {c.npwp && `NPWP: ${c.npwp} • `}
                      {c.email}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && customers.length === 0 && !isLoading && (
              <div className="text-center py-4 text-gray-500">
                {t('tax.noCustomersFound')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
