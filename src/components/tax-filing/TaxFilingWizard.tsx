'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTaxFilingStore, FilingStep, TaxType, CustomerData } from '@/stores/tax-filing-store';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SelectCustomerStep } from './steps/SelectCustomerStep';
import { CustomerTaxTypeStep } from './steps/CustomerTaxTypeStep';
import { IncomeDataStep } from './steps/IncomeDataStep';
import { DeductionsStep } from './steps/DeductionsStep';
import { DocumentsStep } from './steps/DocumentsStep';
import { ReviewStep } from './steps/ReviewStep';
import { Loader2 } from 'lucide-react';

// Steps for tax advisors/consultants (full flow)
const ADVISOR_STEPS: { id: FilingStep; labelKey: string }[] = [
  { id: 'select-customer', labelKey: 'tax.steps.selectCustomer' },
  { id: 'income-data', labelKey: 'tax.steps.incomeData' },
  { id: 'deductions', labelKey: 'tax.steps.deductions' },
  { id: 'documents', labelKey: 'tax.steps.documents' },
  { id: 'review', labelKey: 'tax.steps.review' },
];

// Steps for customers (skip customer selection)
const CUSTOMER_STEPS: { id: FilingStep; labelKey: string }[] = [
  { id: 'select-customer', labelKey: 'tax.steps.selectTaxType' }, // Repurposed as tax type selection
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
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [isLoadingFiling, setIsLoadingFiling] = useState(!!filingId);
  const [filingLoadError, setFilingLoadError] = useState<string | null>(null);

  const {
    taxType,
    taxPeriod,
    taxYear,
    currentStep,
    isDirty,
    isSaving,
    lastSavedAt,
    customer,
    incomeData,
    deductionData,
    documents,
    calculation,
    notes,
    setTaxType,
    setTaxYear,
    setTaxPeriod,
    setCustomer,
    updateIncomeData,
    updateDeductionData,
    setNotes,
    setCurrentStep,
    nextStep,
    prevStep,
    canProceed,
    resetFiling,
    markAsSaving,
    markAsSaved,
  } = useTaxFilingStore();

  // Determine if user is a customer (not tax advisor/consultant)
  const isCustomerRole = session?.role === UserRole.CUSTOMER;

  // Use appropriate steps based on user role
  const STEPS = useMemo(() => {
    return isCustomerRole ? CUSTOMER_STEPS : ADVISOR_STEPS;
  }, [isCustomerRole]);

  // Fetch customer data for CUSTOMER role users
  const fetchCustomerData = useCallback(async (customerId: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer data');
      }
      const data = await response.json();
      if (data.success && data.data) {
        const customerData: CustomerData = {
          id: data.data.id,
          fullName: data.data.full_name,
          companyName: data.data.company_name,
          npwp: data.data.npwp,
          customerType: data.data.customer_type,
          email: data.data.email,
        };
        setCustomer(customerData);
      } else {
        throw new Error(data.error || 'Failed to load customer data');
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setCustomerError(error instanceof Error ? error.message : 'Failed to load customer data');
    } finally {
      setIsLoadingCustomer(false);
    }
  }, [setCustomer]);

  // Auto-set customer for CUSTOMER role
  useEffect(() => {
    if (isCustomerRole && session?.customerId && !customer) {
      fetchCustomerData(session.customerId);
    }
  }, [isCustomerRole, session?.customerId, customer, fetchCustomerData]);

  useEffect(() => {
    if (initialTaxType && !taxType) {
      setTaxType(initialTaxType);
    }
  }, [initialTaxType, taxType, setTaxType]);

  // Load existing filing data for editing
  useEffect(() => {
    if (!filingId) return;

    const loadFiling = async () => {
      setIsLoadingFiling(true);
      setFilingLoadError(null);

      try {
        const response = await fetch(`/api/tax/filings/${filingId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load filing');
        }

        const filing = result.data;

        // Set tax type and period
        if (filing.taxType) setTaxType(filing.taxType as TaxType);
        if (filing.taxYear) setTaxYear(filing.taxYear);
        if (filing.taxPeriod) setTaxPeriod(filing.taxPeriod);

        // Set customer data
        if (filing.customer) {
          setCustomer({
            id: filing.customer.id,
            fullName: filing.customer.fullName,
            companyName: filing.customer.companyName,
            npwp: filing.customer.npwp,
            customerType: 'INDIVIDUAL',
            email: '',
          });
        }

        // Set income and deduction data from tax_data
        if (filing.incomeData) {
          updateIncomeData(filing.incomeData);
        }
        if (filing.deductionData) {
          updateDeductionData(filing.deductionData);
        }
        if (filing.notes) {
          setNotes(filing.notes);
        }

        // Skip to income-data step when editing (customer/tax type already set)
        setCurrentStep('income-data');

      } catch (error) {
        console.error('Error loading filing:', error);
        setFilingLoadError(error instanceof Error ? error.message : 'Failed to load filing');
      } finally {
        setIsLoadingFiling(false);
      }
    };

    loadFiling();
  }, [filingId, setTaxType, setTaxYear, setTaxPeriod, setCustomer, updateIncomeData, updateDeductionData, setNotes, setCurrentStep]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (canProceed()) {
      nextStep();
    }
  };

  const handleSubmit = async () => {
    if (!customer || !taxType || !calculation) {
      setSubmitError(t('tax.errors.missingData'));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    markAsSaving(true);

    try {
      // Prepare tax data
      const taxData = {
        calculatedTax: calculation.taxDue,
        taxableIncome: calculation.taxableIncome,
        grossIncome: calculation.grossIncome,
        deductions: calculation.totalDeductions,
        netTaxDue: calculation.taxDue,
        breakdown: calculation.breakdown,
        incomeData,
        deductionData,
        notes,
      };

      // Submit to API
      const response = await fetch('/api/tax/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          taxType,
          taxPeriod: taxPeriod || `${taxYear}-01`,
          taxYear,
          taxData,
          documentIds: documents.map((d) => d.id),
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific errors
        if (response.status === 403) {
          throw new Error(t('tax.errors.noPermission'));
        }
        if (response.status === 400 && result.error === 'POA_REQUIRED') {
          throw new Error(t('tax.errors.poaRequired'));
        }
        throw new Error(result.message || result.error || t('tax.errors.submitFailed'));
      }

      // Success
      setSubmitSuccess(true);
      markAsSaved();

      // Show success message briefly, then redirect
      setTimeout(() => {
        resetFiling();
        router.push(`/filings/${result.taxFilingId}`);
      }, 2000);
    } catch (error) {
      console.error('Tax filing submission error:', error);
      setSubmitError(error instanceof Error ? error.message : t('tax.errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
      markAsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!customer || !taxType) {
      setSubmitError(t('tax.errors.selectCustomerFirst'));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    markAsSaving(true);

    try {
      // Save as draft
      const response = await fetch('/api/tax/filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          taxType,
          taxPeriod: taxPeriod || `${taxYear}-01`,
          taxYear,
          status: 'DRAFT',
          taxData: {
            calculatedTax: calculation?.taxDue || 0,
            taxableIncome: calculation?.taxableIncome || 0,
            grossIncome: calculation?.grossIncome || 0,
            deductions: calculation?.totalDeductions || 0,
            netTaxDue: calculation?.taxDue || 0,
            incomeData,
            deductionData,
            notes,
          },
          documentIds: documents.map((d) => d.id),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || result.error || t('tax.errors.saveFailed'));
      }

      markAsSaved();
      setSubmitError(null);
    } catch (error) {
      console.error('Draft save error:', error);
      setSubmitError(error instanceof Error ? error.message : t('tax.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
      markAsSaving(false);
    }
  };

  // Request review from tax advisor (for CUSTOMER role)
  const handleRequestReview = async () => {
    if (!customer || !taxType || !calculation) {
      setSubmitError(t('tax.errors.missingData'));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    markAsSaving(true);

    try {
      // Save with UNDER_REVIEW status (pending tax advisor review)
      const response = await fetch('/api/tax/filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          taxType,
          taxPeriod: taxPeriod || `${taxYear}-01`,
          taxYear,
          status: 'UNDER_REVIEW',
          taxData: {
            calculatedTax: calculation.taxDue,
            taxableIncome: calculation.taxableIncome,
            grossIncome: calculation.grossIncome,
            deductions: calculation.totalDeductions,
            netTaxDue: calculation.taxDue,
            breakdown: calculation.breakdown,
            incomeData,
            deductionData,
            notes,
          },
          documentIds: documents.map((d) => d.id),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || t('tax.errors.saveFailed'));
      }

      // Success
      setSubmitSuccess(true);
      markAsSaved();

      // Show success message briefly, then redirect
      setTimeout(() => {
        resetFiling();
        router.push(`/filings/${result.filingId}`);
      }, 2000);
    } catch (error) {
      console.error('Request review error:', error);
      setSubmitError(error instanceof Error ? error.message : t('tax.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
      markAsSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select-customer':
        // For customers: show tax type selection only (customer is auto-set)
        // For advisors: show full customer + tax type selection
        return isCustomerRole ? <CustomerTaxTypeStep /> : <SelectCustomerStep />;
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

  // Show loading while session or filing is being fetched
  if (isSessionLoading || isLoadingCustomer || isLoadingFiling) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">{t('common.loading')}...</p>
      </div>
    );
  }

  // Show error if filing failed to load
  if (filingLoadError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">{filingLoadError}</p>
          <Button onClick={() => router.back()}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  // Show error if customer data failed to load
  if (customerError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">{customerError}</p>
          <Button onClick={() => session?.customerId && fetchCustomerData(session.customerId)}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Error/Success Messages */}
      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{submitError}</p>
        </div>
      )}
      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            {isCustomerRole ? t('tax.reviewRequestSuccess') : t('tax.submitSuccess')}
          </p>
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
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
              {t('common.back')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFiling} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          {isDirty && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting || !customer}
            >
              {isSaving ? t('common.saving') : t('tax.saveDraft')}
            </Button>
          )}
          {isLastStep ? (
            isCustomerRole ? (
              // Customer: Request Review button (cannot submit directly)
              <Button
                onClick={handleRequestReview}
                disabled={!canProceed() || isSubmitting || submitSuccess}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? t('common.submitting') : t('tax.requestReview')}
              </Button>
            ) : (
              // Tax Advisor: Submit Filing button
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting || submitSuccess}
              >
                {isSubmitting ? t('common.submitting') : t('tax.submitFiling')}
              </Button>
            )
          ) : (
            <Button onClick={handleNext} disabled={!canProceed() || isSubmitting}>
              {t('common.next')}
            </Button>
          )}
        </div>
      </div>

      {/* Info for customers about the review process */}
      {isCustomerRole && isLastStep && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {t('tax.customerReviewInfo')}
          </p>
        </div>
      )}
    </div>
  );
}
