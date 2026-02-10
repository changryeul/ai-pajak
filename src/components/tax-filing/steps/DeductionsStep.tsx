'use client';

import { useTranslations } from 'next-intl';
import { useTaxFilingStore } from '@/stores/tax-filing-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function formatCurrency(value: number | undefined): string {
  if (value === undefined) return '';
  return new Intl.NumberFormat('id-ID').format(value);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return parseInt(cleaned) || 0;
}

interface CurrencyInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

function CurrencyInput({ label, value, onChange, placeholder, disabled }: CurrencyInputProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          Rp
        </span>
        <Input
          className="pl-10"
          placeholder={placeholder || '0'}
          value={value ? formatCurrency(value) : ''}
          onChange={(e) => onChange(parseCurrency(e.target.value))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// PTKP values for 2024
const PTKP_VALUES: Record<string, number> = {
  'TK/0': 54000000,
  'TK/1': 58500000,
  'TK/2': 63000000,
  'TK/3': 67500000,
  'K/0': 58500000,
  'K/1': 63000000,
  'K/2': 67500000,
  'K/3': 72000000,
};

const PTKP_OPTIONS = [
  { value: 'TK/0', label: 'TK/0 - Tidak Kawin, Tanpa Tanggungan' },
  { value: 'TK/1', label: 'TK/1 - Tidak Kawin, 1 Tanggungan' },
  { value: 'TK/2', label: 'TK/2 - Tidak Kawin, 2 Tanggungan' },
  { value: 'TK/3', label: 'TK/3 - Tidak Kawin, 3 Tanggungan' },
  { value: 'K/0', label: 'K/0 - Kawin, Tanpa Tanggungan' },
  { value: 'K/1', label: 'K/1 - Kawin, 1 Tanggungan' },
  { value: 'K/2', label: 'K/2 - Kawin, 2 Tanggungan' },
  { value: 'K/3', label: 'K/3 - Kawin, 3 Tanggungan' },
];

export function DeductionsStep() {
  const t = useTranslations();
  const { taxType, incomeData, deductionData, updateDeductionData } = useTaxFilingStore();

  // Auto-calculate biaya jabatan (5% of gross, max 6 million/year or 500k/month)
  const calculateBiayaJabatan = () => {
    const grossIncome = (incomeData.grossSalary || 0) + (incomeData.allowances || 0) + (incomeData.bonuses || 0);
    const biayaJabatan = grossIncome * 0.05;
    return Math.min(biayaJabatan, 500000); // Monthly max
  };

  const renderPPh21Deductions = () => {
    const calculatedBiayaJabatan = calculateBiayaJabatan();
    const ptkpValue = deductionData.ptkpStatus ? PTKP_VALUES[deductionData.ptkpStatus] : 0;

    return (
      <div className="space-y-6">
        {/* PTKP Status */}
        <div className="space-y-2">
          <Label>{t('tax.deductions.ptkpStatus')}</Label>
          <Select
            value={deductionData.ptkpStatus}
            onValueChange={(v) => updateDeductionData({
              ptkpStatus: v as 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3',
              ptkp: PTKP_VALUES[v] / 12, // Monthly PTKP
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('tax.deductions.selectPtkpStatus')} />
            </SelectTrigger>
            <SelectContent>
              {PTKP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ptkpValue > 0 && (
            <p className="text-sm text-gray-500">
              PTKP Tahunan: Rp {formatCurrency(ptkpValue)} (Bulanan: Rp {formatCurrency(ptkpValue / 12)})
            </p>
          )}
        </div>

        {/* Biaya Jabatan */}
        <CurrencyInput
          label={t('tax.deductions.biayaJabatan')}
          value={deductionData.biayaJabatan || calculatedBiayaJabatan}
          onChange={(v) => updateDeductionData({ biayaJabatan: v })}
        />
        <p className="text-sm text-gray-500 -mt-2">
          {t('tax.deductions.biayaJabatanNote')}
        </p>

        {/* Iuran Pensiun */}
        <CurrencyInput
          label={t('tax.deductions.iuranPensiun')}
          value={deductionData.iuranPensiun}
          onChange={(v) => updateDeductionData({ iuranPensiun: v })}
        />

        {/* Other Deductions */}
        <CurrencyInput
          label={t('tax.deductions.otherDeductions')}
          value={deductionData.otherDeductions}
          onChange={(v) => updateDeductionData({ otherDeductions: v })}
        />
      </div>
    );
  };

  const renderPPNDeductions = () => (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900">{t('tax.deductions.inputTaxTitle')}</h4>
        <p className="text-sm text-blue-700 mt-1">
          {t('tax.deductions.inputTaxDescription')}
        </p>
      </div>

      <CurrencyInput
        label={t('tax.deductions.inputTax')}
        value={deductionData.inputTax}
        onChange={(v) => updateDeductionData({ inputTax: v })}
      />

      {/* Calculate output tax vs input tax */}
      {incomeData.salesAmount || incomeData.serviceAmount ? (
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('tax.deductions.outputTax')}</span>
            <span className="font-medium">
              Rp {formatCurrency(((incomeData.salesAmount || 0) + (incomeData.serviceAmount || 0)) * 0.11)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('tax.deductions.inputTax')}</span>
            <span className="font-medium">
              Rp {formatCurrency(deductionData.inputTax || 0)}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium text-gray-900">{t('tax.deductions.netVat')}</span>
            <span className="font-bold text-gray-900">
              Rp {formatCurrency(
                ((incomeData.salesAmount || 0) + (incomeData.serviceAmount || 0)) * 0.11 - (deductionData.inputTax || 0)
              )}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderDefaultDeductions = () => (
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 rounded-lg">
        <p className="text-amber-800">
          {t('tax.deductions.noDeductionsAvailable')}
        </p>
      </div>

      <CurrencyInput
        label={t('tax.deductions.otherDeductions')}
        value={deductionData.otherDeductions}
        onChange={(v) => updateDeductionData({ otherDeductions: v })}
      />
    </div>
  );

  const renderFields = () => {
    switch (taxType) {
      case 'PPh21':
      case 'SPT_TAHUNAN':
        return renderPPh21Deductions();
      case 'PPN':
        return renderPPNDeductions();
      case 'PPh23':
      case 'PPh_FINAL':
        return renderDefaultDeductions();
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {t('tax.selectTaxTypeFirst')}
          </div>
        );
    }
  };

  // Calculate total deductions
  const totalDeductions = Object.entries(deductionData).reduce((sum, [key, val]) => {
    if (key === 'ptkpStatus' || key === 'deductionNotes') return sum;
    if (typeof val === 'number') return sum + val;
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      {renderFields()}

      {/* Total Summary */}
      {totalDeductions > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">
              {t('tax.totalDeductions')}
            </span>
            <span className="text-xl font-bold text-gray-900">
              Rp {formatCurrency(totalDeductions)}
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label>{t('tax.deductionNotes')}</Label>
        <textarea
          className="w-full min-h-[100px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('tax.deductionNotesPlaceholder')}
          value={deductionData.deductionNotes || ''}
          onChange={(e) => updateDeductionData({ deductionNotes: e.target.value })}
        />
      </div>
    </div>
  );
}
