'use client';

import { useTranslations } from 'next-intl';
import { useTaxFilingStore } from '@/stores/tax-filing-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}

function CurrencyInput({ label, value, onChange, placeholder }: CurrencyInputProps) {
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
        />
      </div>
    </div>
  );
}

export function IncomeDataStep() {
  const t = useTranslations();
  const { taxType, incomeData, updateIncomeData } = useTaxFilingStore();

  const renderPPh21Fields = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">{t('tax.income.salary')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyInput
          label={t('tax.income.grossSalary')}
          value={incomeData.grossSalary}
          onChange={(v) => updateIncomeData({ grossSalary: v })}
        />
        <CurrencyInput
          label={t('tax.income.allowances')}
          value={incomeData.allowances}
          onChange={(v) => updateIncomeData({ allowances: v })}
        />
        <CurrencyInput
          label={t('tax.income.bonuses')}
          value={incomeData.bonuses}
          onChange={(v) => updateIncomeData({ bonuses: v })}
        />
        <CurrencyInput
          label={t('tax.income.otherIncome')}
          value={incomeData.otherIncome}
          onChange={(v) => updateIncomeData({ otherIncome: v })}
        />
      </div>
    </div>
  );

  const renderPPh23Fields = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">{t('tax.income.services')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyInput
          label={t('tax.income.serviceIncome')}
          value={incomeData.serviceIncome}
          onChange={(v) => updateIncomeData({ serviceIncome: v })}
        />
        <CurrencyInput
          label={t('tax.income.royaltyIncome')}
          value={incomeData.royaltyIncome}
          onChange={(v) => updateIncomeData({ royaltyIncome: v })}
        />
        <CurrencyInput
          label={t('tax.income.dividendIncome')}
          value={incomeData.dividendIncome}
          onChange={(v) => updateIncomeData({ dividendIncome: v })}
        />
        <CurrencyInput
          label={t('tax.income.interestIncome')}
          value={incomeData.interestIncome}
          onChange={(v) => updateIncomeData({ interestIncome: v })}
        />
      </div>
    </div>
  );

  const renderPPhFinalFields = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">{t('tax.income.final')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyInput
          label={t('tax.income.rentalIncome')}
          value={incomeData.rentalIncome}
          onChange={(v) => updateIncomeData({ rentalIncome: v })}
        />
        <CurrencyInput
          label={t('tax.income.constructionIncome')}
          value={incomeData.constructionIncome}
          onChange={(v) => updateIncomeData({ constructionIncome: v })}
        />
        <CurrencyInput
          label={t('tax.income.otherIncome')}
          value={incomeData.otherIncome}
          onChange={(v) => updateIncomeData({ otherIncome: v })}
        />
      </div>
    </div>
  );

  const renderPPNFields = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">{t('tax.income.vat')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyInput
          label={t('tax.income.salesAmount')}
          value={incomeData.salesAmount}
          onChange={(v) => updateIncomeData({ salesAmount: v })}
        />
        <CurrencyInput
          label={t('tax.income.serviceAmount')}
          value={incomeData.serviceAmount}
          onChange={(v) => updateIncomeData({ serviceAmount: v })}
        />
      </div>
    </div>
  );

  const renderSPTTahunanFields = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">{t('tax.income.employment')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label={t('tax.income.grossSalary')}
            value={incomeData.grossSalary}
            onChange={(v) => updateIncomeData({ grossSalary: v })}
          />
          <CurrencyInput
            label={t('tax.income.allowances')}
            value={incomeData.allowances}
            onChange={(v) => updateIncomeData({ allowances: v })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">{t('tax.income.business')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label={t('tax.income.serviceIncome')}
            value={incomeData.serviceIncome}
            onChange={(v) => updateIncomeData({ serviceIncome: v })}
          />
          <CurrencyInput
            label={t('tax.income.rentalIncome')}
            value={incomeData.rentalIncome}
            onChange={(v) => updateIncomeData({ rentalIncome: v })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">{t('tax.income.investment')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label={t('tax.income.dividendIncome')}
            value={incomeData.dividendIncome}
            onChange={(v) => updateIncomeData({ dividendIncome: v })}
          />
          <CurrencyInput
            label={t('tax.income.interestIncome')}
            value={incomeData.interestIncome}
            onChange={(v) => updateIncomeData({ interestIncome: v })}
          />
        </div>
      </div>
    </div>
  );

  const renderFields = () => {
    switch (taxType) {
      case 'PPh21':
        return renderPPh21Fields();
      case 'PPh23':
        return renderPPh23Fields();
      case 'PPh_FINAL':
        return renderPPhFinalFields();
      case 'PPN':
        return renderPPNFields();
      case 'SPT_TAHUNAN':
        return renderSPTTahunanFields();
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {t('tax.selectTaxTypeFirst')}
          </div>
        );
    }
  };

  // Calculate total income
  const totalIncome = Object.values(incomeData).reduce((sum, val) => {
    if (typeof val === 'number') return sum + val;
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      {renderFields()}

      {/* Total Summary */}
      {totalIncome > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">
              {t('tax.totalGrossIncome')}
            </span>
            <span className="text-xl font-bold text-gray-900">
              Rp {formatCurrency(totalIncome)}
            </span>
          </div>
        </div>
      )}

      {/* Description/Notes */}
      <div className="space-y-2">
        <Label>{t('tax.incomeDescription')}</Label>
        <textarea
          className="w-full min-h-[100px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('tax.incomeDescriptionPlaceholder')}
          value={incomeData.description || ''}
          onChange={(e) => updateIncomeData({ description: e.target.value })}
        />
      </div>
    </div>
  );
}
