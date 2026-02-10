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

const TAX_TYPES: { value: TaxType; label: string; description: string }[] = [
  {
    value: 'PPh21',
    label: 'PPh 21',
    description: 'Pajak Penghasilan atas gaji karyawan',
  },
  {
    value: 'PPh23',
    label: 'PPh 23',
    description: 'Pajak Penghasilan atas jasa, royalti, bunga',
  },
  {
    value: 'PPh_FINAL',
    label: 'PPh Final',
    description: 'Pajak Penghasilan Final (sewa, konstruksi)',
  },
  {
    value: 'PPN',
    label: 'PPN',
    description: 'Pajak Pertambahan Nilai',
  },
  {
    value: 'SPT_TAHUNAN',
    label: 'SPT Tahunan',
    description: 'Laporan Pajak Tahunan',
  },
];

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  return (
    <div className="space-y-6">
      {/* Tax Type Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">{t('tax.selectTaxType')}</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TAX_TYPES.map((type) => (
            <div
              key={type.value}
              onClick={() => setTaxType(type.value)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                taxType === type.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-sm text-gray-500">{type.description}</div>
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
