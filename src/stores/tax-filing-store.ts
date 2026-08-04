import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TaxType = 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_TAHUNAN';

export type FilingStep =
  | 'select-customer'
  | 'income-data'
  | 'deductions'
  | 'documents'
  | 'review';

export interface CustomerData {
  id: string;
  fullName: string;
  companyName?: string;
  npwp?: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  email: string;
}

export interface IncomeData {
  // PPh21 specific
  grossSalary?: number;
  allowances?: number;
  bonuses?: number;

  // PPh23 specific
  serviceIncome?: number;
  royaltyIncome?: number;
  dividendIncome?: number;
  interestIncome?: number;

  // PPh Final specific
  rentalIncome?: number;
  constructionIncome?: number;

  // PPN specific
  salesAmount?: number;
  serviceAmount?: number;

  // Common
  otherIncome?: number;
  description?: string;
}

export interface DeductionData {
  // PPh21 specific
  biayaJabatan?: number;
  iuranPensiun?: number;
  ptkp?: number;
  ptkpStatus?: 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3';

  // PPN specific
  inputTax?: number;

  // Common
  otherDeductions?: number;
  deductionNotes?: string;
}

export interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
}

export interface TaxCalculation {
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxDue: number;
  taxRate: number;
  breakdown: Record<string, number>;
}

export interface TaxFilingState {
  // Current filing
  taxType: TaxType | null;
  taxPeriod: string; // e.g., '2024-01' for January 2024
  taxYear: number;
  currentStep: FilingStep;

  // Data
  customer: CustomerData | null;
  incomeData: IncomeData;
  deductionData: DeductionData;
  documents: DocumentData[];
  calculation: TaxCalculation | null;
  notes: string;

  // Status
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  errors: Record<string, string>;

  // Actions
  setTaxType: (taxType: TaxType) => void;
  setTaxPeriod: (period: string) => void;
  setTaxYear: (year: number) => void;
  setCurrentStep: (step: FilingStep) => void;
  setCustomer: (customer: CustomerData | null) => void;
  updateIncomeData: (data: Partial<IncomeData>) => void;
  updateDeductionData: (data: Partial<DeductionData>) => void;
  addDocument: (doc: DocumentData) => void;
  removeDocument: (docId: string) => void;
  setCalculation: (calc: TaxCalculation | null) => void;
  setNotes: (notes: string) => void;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  markAsSaving: (saving: boolean) => void;
  markAsSaved: () => void;
  resetFiling: () => void;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  canProceed: () => boolean;
}

const STEPS: FilingStep[] = [
  'select-customer',
  'income-data',
  'deductions',
  'documents',
  'review',
];

const initialState = {
  taxType: null,
  taxPeriod: '',
  taxYear: new Date().getFullYear(),
  currentStep: 'select-customer' as FilingStep,
  customer: null,
  incomeData: {},
  deductionData: {},
  documents: [],
  calculation: null,
  notes: '',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  errors: {},
};

export const useTaxFilingStore = create<TaxFilingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTaxType: (taxType) => set({ taxType, isDirty: true }),

      setTaxPeriod: (taxPeriod) => set({ taxPeriod, isDirty: true }),

      setTaxYear: (taxYear) => set({ taxYear, isDirty: true }),

      setCurrentStep: (currentStep) => set({ currentStep }),

      setCustomer: (customer) => set({ customer, isDirty: true }),

      updateIncomeData: (data) => set((state) => ({
        incomeData: { ...state.incomeData, ...data },
        isDirty: true,
      })),

      updateDeductionData: (data) => set((state) => ({
        deductionData: { ...state.deductionData, ...data },
        isDirty: true,
      })),

      addDocument: (doc) => set((state) => ({
        documents: [...state.documents, doc],
        isDirty: true,
      })),

      removeDocument: (docId) => set((state) => ({
        documents: state.documents.filter((d) => d.id !== docId),
        isDirty: true,
      })),

      setCalculation: (calculation) => set({ calculation }),

      setNotes: (notes) => set({ notes, isDirty: true }),

      setError: (field, message) => set((state) => ({
        errors: { ...state.errors, [field]: message },
      })),

      clearError: (field) => set((state) => {
         
        const { [field]: _removed, ...rest } = state.errors;
        return { errors: rest };
      }),

      clearAllErrors: () => set({ errors: {} }),

      markAsSaving: (isSaving) => set({ isSaving }),

      markAsSaved: () => set({
        isDirty: false,
        isSaving: false,
        lastSavedAt: new Date().toISOString(),
      }),

      resetFiling: () => set(initialState),

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = STEPS.indexOf(currentStep);
        if (currentIndex < STEPS.length - 1) {
          set({ currentStep: STEPS[currentIndex + 1] });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const currentIndex = STEPS.indexOf(currentStep);
        if (currentIndex > 0) {
          set({ currentStep: STEPS[currentIndex - 1] });
        }
      },

      canProceed: () => {
        const state = get();
        const { currentStep, customer, incomeData, taxType } = state;

        switch (currentStep) {
          case 'select-customer':
            return customer !== null && taxType !== null;
          case 'income-data':
            // At least one income field should be filled
            return Object.values(incomeData).some((v) => v !== undefined && v !== 0);
          case 'deductions':
            return true; // Deductions are optional
          case 'documents':
            return true; // Documents are optional for draft
          case 'review':
            return true;
          default:
            return false;
        }
      },
    }),
    {
      name: 'tax-filing-storage',
      partialize: (state) => ({
        taxType: state.taxType,
        taxPeriod: state.taxPeriod,
        taxYear: state.taxYear,
        customer: state.customer,
        incomeData: state.incomeData,
        deductionData: state.deductionData,
        documents: state.documents,
        notes: state.notes,
      }),
    }
  )
);
