'use client';

import { useTranslations } from 'next-intl';
import { useTaxFilingStore, TaxType } from '@/stores/tax-filing-store';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { User, CheckCircle } from 'lucide-react';

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

/**
 * Tax type selection step for CUSTOMER role users.
 * Customer data is auto-filled from their profile, so this step only shows:
 * - Customer info summary (read-only)
 * - Tax type selection
 * - Tax period selection
 */
export function CustomerTaxTypeStep() {
  const t = useTranslations();
  const {
    customer,
    taxType,
    taxPeriod,
    taxYear,
    setTaxType,
    setTaxPeriod,
    setTaxYear,
  } = useTaxFilingStore();

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
      {/* Customer Info Summary (Read-only) */}
      {customer && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-900">
                    {customer.customerType === 'COMPANY'
                      ? customer.companyName
                      : customer.fullName}
                  </span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  {customer.npwp && <span>NPWP: {customer.npwp}</span>}
                  {customer.email && (
                    <span className="ml-3">{customer.email}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
