'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTaxFilingStore, FilingStep, TaxType } from '@/stores/tax-filing-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SelectCustomerStep } from './steps/SelectCustomerStep';
import { IncomeDataStep } from './steps/IncomeDataStep';
import { DeductionsStep } from './steps/DeductionsStep';
import { DocumentsStep } from './steps/DocumentsStep';
import { ReviewStep } from './steps/ReviewStep';

const STEPS: { id: FilingStep; labelKey: string }[] = [
  { id: 'select-customer', labelKey: 'tax.steps.selectCustomer' },
  { id: 'income-data', labelKey: 'tax.steps.incomeData' },
  { id: 'deductions', labelKey: 'tax.steps.deductions' },
  { id: 'documents', labelKey: 'tax.steps.documents' },
  { id: 'review', labelKey: 'tax.steps.review' },
];

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  PPh21: 'PPh 21 - Pajak Penghasilan Karyawan',
  PPh23: 'PPh 23 - Pajak Penghasilan Jasa',
  PPh_FINAL: 'PPh Final - Pajak Penghasilan Final',
  PPN: 'PPN - Pajak Pertambahan Nilai',
  SPT_TAHUNAN: 'SPT Tahunan - Laporan Tahunan',
};

interface TaxFilingWizardProps {
  initialTaxType?: TaxType;
  filingId?: string;
}

export function TaxFilingWizard({ initialTaxType, filingId }: TaxFilingWizardProps) {
  const t = useTranslations();

  const {
    taxType,
    currentStep,
    isDirty,
    isSaving,
    lastSavedAt,
    setTaxType,
    nextStep,
    prevStep,
    canProceed,
    resetFiling,
  } = useTaxFilingStore();

  useEffect(() => {
    if (initialTaxType && !taxType) {
      setTaxType(initialTaxType);
    }
  }, [initialTaxType, taxType, setTaxType]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (canProceed()) {
      nextStep();
    }
  };

  const handleSubmit = async () => {
    // TODO: Submit the filing
    console.log('Submitting filing...');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select-customer':
        return <SelectCustomerStep />;
      case 'income-data':
        return <IncomeDataStep />;
      case 'deductions':
        return <DeductionsStep />;
      case 'documents':
        return <DocumentsStep />;
      case 'review':
        return <ReviewStep />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {filingId ? t('tax.editFiling') : t('tax.newFiling')}
        </h1>
        {taxType && (
          <p className="text-gray-600 mt-1">{TAX_TYPE_LABELS[taxType]}</p>
        )}
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs ${
                      isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {t(step.labelKey)}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStepIndex ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-save indicator */}
      {isDirty && (
        <div className="mb-4 text-sm text-amber-600">
          {isSaving ? t('common.saving') : t('common.unsavedChanges')}
        </div>
      )}
      {lastSavedAt && !isDirty && (
        <div className="mb-4 text-sm text-gray-500">
          {t('common.lastSaved')}: {new Date(lastSavedAt).toLocaleTimeString()}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t(STEPS[currentStepIndex].labelKey)}</CardTitle>
          <CardDescription>
            {t(`tax.stepDescriptions.${currentStep}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-between">
        <div>
          {!isFirstStep && (
            <Button variant="outline" onClick={prevStep}>
              {t('common.back')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFiling}>
            {t('common.cancel')}
          </Button>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={!canProceed()}>
              {t('tax.submitFiling')}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t('common.next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
