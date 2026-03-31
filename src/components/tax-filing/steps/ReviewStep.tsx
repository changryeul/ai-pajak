'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useTaxFilingStore, TaxCalculation } from '@/stores/tax-filing-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function ReviewStep() {
  const t = useTranslations();
  const tt = useTranslations('taxTypes');
  const {
    taxType,
    taxPeriod,
    taxYear,
    customer,
    incomeData,
    deductionData,
    documents,
    notes,
    calculation,
    setCalculation,
    setNotes,
    setCurrentStep,
  } = useTaxFilingStore();

  const [isCalculating, setIsCalculating] = useState(false);

  const calculateTaxLocally = useCallback((): TaxCalculation => {
    let grossIncome = 0;
    let totalDeductions = 0;
    let taxableIncome = 0;
    let taxDue = 0;
    let taxRate = 0;
    const breakdown: Record<string, number> = {};

    // Calculate gross income
    Object.entries(incomeData).forEach(([key, value]) => {
      if (typeof value === 'number') {
        grossIncome += value;
        breakdown[`income_${key}`] = value;
      }
    });

    // Calculate deductions
    Object.entries(deductionData).forEach(([key, value]) => {
      if (typeof value === 'number' && key !== 'ptkpStatus') {
        totalDeductions += value;
        breakdown[`deduction_${key}`] = value;
      }
    });

    taxableIncome = Math.max(0, grossIncome - totalDeductions);

    // Calculate tax based on type
    switch (taxType) {
      case 'PPh21':
      case 'SPT_TAHUNAN':
        // Progressive tax rates for Indonesia
        if (taxableIncome <= 60000000) {
          taxDue = taxableIncome * 0.05;
          taxRate = 5;
        } else if (taxableIncome <= 250000000) {
          taxDue = 60000000 * 0.05 + (taxableIncome - 60000000) * 0.15;
          taxRate = 15;
        } else if (taxableIncome <= 500000000) {
          taxDue = 60000000 * 0.05 + 190000000 * 0.15 + (taxableIncome - 250000000) * 0.25;
          taxRate = 25;
        } else if (taxableIncome <= 5000000000) {
          taxDue = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + (taxableIncome - 500000000) * 0.30;
          taxRate = 30;
        } else {
          taxDue = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + 4500000000 * 0.30 + (taxableIncome - 5000000000) * 0.35;
          taxRate = 35;
        }
        break;

      case 'PPh23':
        taxRate = 2; // Standard rate for services
        taxDue = grossIncome * 0.02;
        break;

      case 'PPh_FINAL':
        taxRate = 10; // Varies, using 10% as default
        taxDue = grossIncome * 0.10;
        break;

      case 'PPN':
        taxRate = 11;
        const outputTax = grossIncome * 0.11;
        const inputTax = deductionData.inputTax || 0;
        taxDue = outputTax - inputTax;
        breakdown['output_tax'] = outputTax;
        breakdown['input_tax'] = inputTax;
        break;
    }

    return {
      grossIncome,
      totalDeductions,
      taxableIncome,
      taxDue: Math.round(taxDue),
      taxRate,
      breakdown,
    };
  }, [incomeData, deductionData, taxType]);

  const calculateTax = useCallback(async () => {
    if (!taxType) return;

    setIsCalculating(true);
    try {
      // Call tax calculation API
      const response = await fetch('/api/tax/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType,
          incomeData,
          deductionData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCalculation(data.data);
      } else {
        // Fallback to client-side calculation
        const calc = calculateTaxLocally();
        setCalculation(calc);
      }
    } catch (error) {
      console.error('Tax calculation error:', error);
      // Fallback to client-side calculation
      const calc = calculateTaxLocally();
      setCalculation(calc);
    } finally {
      setIsCalculating(false);
    }
  }, [taxType, incomeData, deductionData, setCalculation, calculateTaxLocally]);

  useEffect(() => {
    calculateTax();
  }, [calculateTax]);

  const periodLabel = taxPeriod
    ? new Date(taxYear, parseInt(taxPeriod) - 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      })
    : taxYear.toString();

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <h3 className="font-bold text-lg text-gray-900">
          {t('tax.review.summary')}
        </h3>
        <p className="text-gray-600">
          {taxType ? `${tt(taxType)} - ${tt(`${taxType}Desc`)}` : ''} - {periodLabel}
        </p>
      </div>

      {/* Customer Info */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-gray-900">{t('tax.review.customerInfo')}</h4>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep('select-customer')}>
            {t('common.edit')}
          </Button>
        </div>
        {customer && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('tax.review.name')}</span>
              <span className="font-medium">
                {customer.customerType === 'COMPANY' ? customer.companyName : customer.fullName}
              </span>
            </div>
            {customer.npwp && (
              <div className="flex justify-between">
                <span className="text-gray-500">NPWP</span>
                <span className="font-medium">{customer.npwp}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{customer.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Income Summary */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-gray-900">{t('tax.review.incomeData')}</h4>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep('income-data')}>
            {t('common.edit')}
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {Object.entries(incomeData).map(([key, value]) => {
            if (typeof value !== 'number' || value === 0) return null;
            return (
              <div key={key} className="flex justify-between">
                <span className="text-gray-500">{t(`tax.income.${key}`)}</span>
                <span className="font-medium">Rp {formatCurrency(value)}</span>
              </div>
            );
          })}
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium text-gray-900">{t('tax.review.totalIncome')}</span>
            <span className="font-bold text-gray-900">
              Rp {formatCurrency(calculation?.grossIncome || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Deductions Summary */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-gray-900">{t('tax.review.deductions')}</h4>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep('deductions')}>
            {t('common.edit')}
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {Object.entries(deductionData).map(([key, value]) => {
            if (key === 'ptkpStatus' || key === 'deductionNotes') return null;
            if (typeof value !== 'number' || value === 0) return null;
            return (
              <div key={key} className="flex justify-between">
                <span className="text-gray-500">{t(`tax.deductions.${key}`)}</span>
                <span className="font-medium">Rp {formatCurrency(value)}</span>
              </div>
            );
          })}
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium text-gray-900">{t('tax.review.totalDeductions')}</span>
            <span className="font-bold text-gray-900">
              Rp {formatCurrency(calculation?.totalDeductions || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Tax Calculation */}
      <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
        <h4 className="font-bold text-gray-900 mb-4">{t('tax.review.taxCalculation')}</h4>
        {isCalculating ? (
          <div className="text-center py-4 text-gray-500">
            {t('common.calculating')}...
          </div>
        ) : calculation ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('tax.review.grossIncome')}</span>
              <span>Rp {formatCurrency(calculation.grossIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('tax.review.totalDeductions')}</span>
              <span>- Rp {formatCurrency(calculation.totalDeductions)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-gray-600">{t('tax.review.taxableIncome')}</span>
              <span>Rp {formatCurrency(calculation.taxableIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('tax.review.taxRate')}</span>
              <span>{calculation.taxRate}%</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-blue-300">
              <span className="font-bold text-lg text-blue-900">
                {t('tax.review.taxDue')}
              </span>
              <span className="font-bold text-xl text-blue-900">
                Rp {formatCurrency(calculation.taxDue)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {t('tax.review.noCalculation')}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-gray-900">
            {t('tax.review.documents')} ({documents.length})
          </h4>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep('documents')}>
            {t('common.edit')}
          </Button>
        </div>
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{doc.fileName}</span>
                <Badge variant="outline">{doc.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('tax.review.noDocuments')}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>{t('tax.review.additionalNotes')}</Label>
        <textarea
          className="w-full min-h-[100px] p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('tax.review.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-900 mb-2">
          {t('tax.review.disclaimer')}
        </h4>
        <p className="text-sm text-amber-800">
          {t('tax.review.disclaimerText')}
        </p>
      </div>
    </div>
  );
}
