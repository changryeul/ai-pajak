'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { SPT1771Preview } from './SPT1771Preview';
import type { SPT1771Data } from '@/lib/tax/spt-1771/types';

interface SPT1771GeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  onComplete?: (data: SPT1771Data) => void;
}

type EntityType = 'PT' | 'CV' | 'FIRMA' | 'KOPERASI' | 'YAYASAN' | 'OTHER';

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'PT', label: 'PT (Perseroan Terbatas)' },
  { value: 'CV', label: 'CV (Commanditaire Vennootschap)' },
  { value: 'FIRMA', label: 'Firma' },
  { value: 'KOPERASI', label: 'Koperasi' },
  { value: 'YAYASAN', label: 'Yayasan' },
  { value: 'OTHER', label: 'Lainnya' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

function parseCurrency(value: string): number {
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

interface IncomeStatementForm {
  grossRevenue: number;
  salesReturns: number;
  salesDiscounts: number;
  costOfRevenue: number;
  salariesAndWages: number;
  rentExpense: number;
  utilitiesExpense: number;
  depreciation: number;
  entertainmentExpense: number;
  otherOperatingExpenses: number;
  interestIncome: number;
  dividendIncome: number;
  rentalIncome: number;
  incomeTaxExpense: number;
}

interface BalanceSheetForm {
  currentAssets: number;
  fixedAssets: number;
  accumulatedDepreciation: number;
  otherAssets: number;
  currentLiabilities: number;
  longTermLiabilities: number;
  paidInCapital: number;
  retainedEarnings: number;
}

interface TaxCreditsForm {
  pph22Withheld: number;
  pph23Withheld: number;
  pph25Installments: number;
}

export function SPT1771Generator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  onComplete,
}: SPT1771GeneratorProps) {
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [entityType, setEntityType] = useState<EntityType>('PT');
  const [kluCode, setKluCode] = useState('');
  const [correctionNumber, setCorrectionNumber] = useState(0);

  // Income statement
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementForm>({
    grossRevenue: 0,
    salesReturns: 0,
    salesDiscounts: 0,
    costOfRevenue: 0,
    salariesAndWages: 0,
    rentExpense: 0,
    utilitiesExpense: 0,
    depreciation: 0,
    entertainmentExpense: 0,
    otherOperatingExpenses: 0,
    interestIncome: 0,
    dividendIncome: 0,
    rentalIncome: 0,
    incomeTaxExpense: 0,
  });

  // Balance sheet
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetForm>({
    currentAssets: 0,
    fixedAssets: 0,
    accumulatedDepreciation: 0,
    otherAssets: 0,
    currentLiabilities: 0,
    longTermLiabilities: 0,
    paidInCapital: 0,
    retainedEarnings: 0,
  });

  // Tax credits
  const [taxCredits, setTaxCredits] = useState<TaxCreditsForm>({
    pph22Withheld: 0,
    pph23Withheld: 0,
    pph25Installments: 0,
  });

  const [sptData, setSptData] = useState<SPT1771Data | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const updateIncomeStatement = (field: keyof IncomeStatementForm, value: string) => {
    setIncomeStatement((prev) => ({ ...prev, [field]: parseCurrency(value) }));
  };

  const updateBalanceSheet = (field: keyof BalanceSheetForm, value: string) => {
    setBalanceSheet((prev) => ({ ...prev, [field]: parseCurrency(value) }));
  };

  const updateTaxCredits = (field: keyof TaxCreditsForm, value: string) => {
    setTaxCredits((prev) => ({ ...prev, [field]: parseCurrency(value) }));
  };

  // Calculated values
  const netRevenue =
    incomeStatement.grossRevenue -
    incomeStatement.salesReturns -
    incomeStatement.salesDiscounts;

  const totalOpex =
    incomeStatement.salariesAndWages +
    incomeStatement.rentExpense +
    incomeStatement.utilitiesExpense +
    incomeStatement.depreciation +
    incomeStatement.entertainmentExpense +
    incomeStatement.otherOperatingExpenses;

  const grossProfit = netRevenue - incomeStatement.costOfRevenue;
  const operatingIncome = grossProfit - totalOpex;

  const otherIncomeTotal =
    incomeStatement.interestIncome +
    incomeStatement.dividendIncome +
    incomeStatement.rentalIncome;

  const incomeBeforeTax = operatingIncome + otherIncomeTotal;

  const totalAssets =
    balanceSheet.currentAssets +
    balanceSheet.fixedAssets -
    balanceSheet.accumulatedDepreciation +
    balanceSheet.otherAssets;

  const totalLiabilities =
    balanceSheet.currentLiabilities + balanceSheet.longTermLiabilities;

  const totalEquity = balanceSheet.paidInCapital + balanceSheet.retainedEarnings;

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  const generateSPT = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1771', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          fiscalYear: {
            startDate: `${taxYear}-01-01`,
            endDate: `${taxYear}-12-31`,
            isCalendarYear: true,
          },
          correctionNumber,
          company: {
            entityType,
            kluCode,
          },
          incomeStatement: {
            grossRevenue: incomeStatement.grossRevenue,
            salesReturns: incomeStatement.salesReturns,
            salesDiscounts: incomeStatement.salesDiscounts,
            costOfRevenue: {
              totalCostOfRevenue: incomeStatement.costOfRevenue,
              rawMaterials: 0,
              directLabor: 0,
              manufacturingOverhead: 0,
              beginningInventory: 0,
              endingInventory: 0,
              purchasesOfGoods: incomeStatement.costOfRevenue,
              freightIn: 0,
              otherDirectCosts: 0,
            },
            operatingExpenses: {
              salariesAndWages: incomeStatement.salariesAndWages,
              employeeBenefits: 0,
              bonusesAndIncentives: 0,
              trainingAndDevelopment: 0,
              rentExpense: incomeStatement.rentExpense,
              utilitiesExpense: incomeStatement.utilitiesExpense,
              maintenanceAndRepairs: 0,
              insuranceExpense: 0,
              securityExpense: 0,
              officeSupplies: 0,
              communicationExpense: 0,
              travelExpense: 0,
              entertainmentExpense: incomeStatement.entertainmentExpense,
              advertisingExpense: 0,
              transportationExpense: 0,
              professionalFees: 0,
              auditFees: 0,
              legalFees: 0,
              consultingFees: 0,
              depreciation: incomeStatement.depreciation,
              amortization: 0,
              bankCharges: 0,
              badDebtExpense: 0,
              donationsAndCSR: 0,
              researchAndDevelopment: 0,
              otherOperatingExpenses: incomeStatement.otherOperatingExpenses,
              totalOperatingExpenses: totalOpex,
            },
            otherIncome: {
              interestIncome: incomeStatement.interestIncome,
              dividendIncome: incomeStatement.dividendIncome,
              rentalIncome: incomeStatement.rentalIncome,
              gainOnAssetSale: 0,
              foreignExchangeGain: 0,
              otherIncome: 0,
              total: otherIncomeTotal,
            },
            otherExpenses: {
              interestIncome: 0,
              dividendIncome: 0,
              rentalIncome: 0,
              gainOnAssetSale: 0,
              foreignExchangeGain: 0,
              otherIncome: 0,
              total: 0,
            },
            incomeTaxExpense: incomeStatement.incomeTaxExpense,
          },
          balanceSheet: {
            assets: {
              currentAssets: balanceSheet.currentAssets,
              fixedAssets: balanceSheet.fixedAssets,
              accumulatedDepreciation: balanceSheet.accumulatedDepreciation,
              netFixedAssets:
                balanceSheet.fixedAssets - balanceSheet.accumulatedDepreciation,
              otherAssets: balanceSheet.otherAssets,
              totalAssets,
            },
            liabilities: {
              currentLiabilities: balanceSheet.currentLiabilities,
              longTermLiabilities: balanceSheet.longTermLiabilities,
              totalLiabilities,
            },
            equity: {
              paidInCapital: balanceSheet.paidInCapital,
              retainedEarnings: balanceSheet.retainedEarnings,
              currentYearProfit: incomeBeforeTax - incomeStatement.incomeTaxExpense,
              otherEquity: 0,
              totalEquity:
                totalEquity +
                (incomeBeforeTax - incomeStatement.incomeTaxExpense),
            },
          },
          taxCredits: {
            pph22Withheld: taxCredits.pph22Withheld,
            pph23Withheld: taxCredits.pph23Withheld,
            pph25Installments: taxCredits.pph25Installments,
          },
          format: 'json',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'SPT generation failed');
      }

      if (result.success && result.data) {
        setSptData(result.data);
        setStep('preview');
        onComplete?.(result.data);
      } else {
        throw new Error(result.message || 'No SPT data returned');
      }
    } catch (err) {
      console.error('SPT generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate SPT');
    } finally {
      setIsLoading(false);
    }
  }, [
    customerId,
    taxYear,
    correctionNumber,
    entityType,
    kluCode,
    incomeStatement,
    balanceSheet,
    taxCredits,
    totalOpex,
    otherIncomeTotal,
    totalAssets,
    totalLiabilities,
    totalEquity,
    incomeBeforeTax,
    onComplete,
  ]);

  const handleDownloadPDF = useCallback(async () => {
    if (!sptData) return;

    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1771', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          fiscalYear: {
            startDate: `${taxYear}-01-01`,
            endDate: `${taxYear}-12-31`,
            isCalendarYear: true,
          },
          correctionNumber,
          company: {
            entityType,
            kluCode,
          },
          incomeStatement: {
            grossRevenue: incomeStatement.grossRevenue,
            salesReturns: incomeStatement.salesReturns,
            salesDiscounts: incomeStatement.salesDiscounts,
            costOfRevenue: {
              totalCostOfRevenue: incomeStatement.costOfRevenue,
              rawMaterials: 0,
              directLabor: 0,
              manufacturingOverhead: 0,
              beginningInventory: 0,
              endingInventory: 0,
              purchasesOfGoods: incomeStatement.costOfRevenue,
              freightIn: 0,
              otherDirectCosts: 0,
            },
            operatingExpenses: {
              salariesAndWages: incomeStatement.salariesAndWages,
              employeeBenefits: 0,
              bonusesAndIncentives: 0,
              trainingAndDevelopment: 0,
              rentExpense: incomeStatement.rentExpense,
              utilitiesExpense: incomeStatement.utilitiesExpense,
              maintenanceAndRepairs: 0,
              insuranceExpense: 0,
              securityExpense: 0,
              officeSupplies: 0,
              communicationExpense: 0,
              travelExpense: 0,
              entertainmentExpense: incomeStatement.entertainmentExpense,
              advertisingExpense: 0,
              transportationExpense: 0,
              professionalFees: 0,
              auditFees: 0,
              legalFees: 0,
              consultingFees: 0,
              depreciation: incomeStatement.depreciation,
              amortization: 0,
              bankCharges: 0,
              badDebtExpense: 0,
              donationsAndCSR: 0,
              researchAndDevelopment: 0,
              otherOperatingExpenses: incomeStatement.otherOperatingExpenses,
              totalOperatingExpenses: totalOpex,
            },
            otherIncome: {
              interestIncome: incomeStatement.interestIncome,
              dividendIncome: incomeStatement.dividendIncome,
              rentalIncome: incomeStatement.rentalIncome,
              gainOnAssetSale: 0,
              foreignExchangeGain: 0,
              otherIncome: 0,
              total: otherIncomeTotal,
            },
            otherExpenses: {
              interestIncome: 0,
              dividendIncome: 0,
              rentalIncome: 0,
              gainOnAssetSale: 0,
              foreignExchangeGain: 0,
              otherIncome: 0,
              total: 0,
            },
            incomeTaxExpense: incomeStatement.incomeTaxExpense,
          },
          balanceSheet: {
            assets: {
              currentAssets: balanceSheet.currentAssets,
              fixedAssets: balanceSheet.fixedAssets,
              accumulatedDepreciation: balanceSheet.accumulatedDepreciation,
              netFixedAssets:
                balanceSheet.fixedAssets - balanceSheet.accumulatedDepreciation,
              otherAssets: balanceSheet.otherAssets,
              totalAssets,
            },
            liabilities: {
              currentLiabilities: balanceSheet.currentLiabilities,
              longTermLiabilities: balanceSheet.longTermLiabilities,
              totalLiabilities,
            },
            equity: {
              paidInCapital: balanceSheet.paidInCapital,
              retainedEarnings: balanceSheet.retainedEarnings,
              currentYearProfit: incomeBeforeTax - incomeStatement.incomeTaxExpense,
              otherEquity: 0,
              totalEquity:
                totalEquity +
                (incomeBeforeTax - incomeStatement.incomeTaxExpense),
            },
          },
          taxCredits: {
            pph22Withheld: taxCredits.pph22Withheld,
            pph23Withheld: taxCredits.pph23Withheld,
            pph25Installments: taxCredits.pph25Installments,
          },
          format: 'pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'PDF download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SPT-1771-${customerNpwp || customerId}-${taxYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  }, [
    sptData,
    customerId,
    customerNpwp,
    taxYear,
    correctionNumber,
    entityType,
    kluCode,
    incomeStatement,
    balanceSheet,
    taxCredits,
    totalOpex,
    otherIncomeTotal,
    totalAssets,
    totalLiabilities,
    totalEquity,
    incomeBeforeTax,
  ]);

  if (step === 'preview' && sptData) {
    return (
      <SPT1771Preview
        data={sptData}
        onEdit={() => setStep('form')}
        onDownloadPDF={handleDownloadPDF}
        isLoading={isLoading || isDownloading}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate SPT 1771</CardTitle>
          <CardDescription>
            SPT Tahunan PPh Badan untuk Wajib Pajak Badan (PT, CV, dll)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Wajib Pajak Badan</h4>
            <p className="font-semibold">{customerName}</p>
            {customerNpwp && (
              <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxYear">Tahun Pajak</Label>
              <Select
                value={taxYear.toString()}
                onValueChange={(v) => setTaxYear(parseInt(v))}
              >
                <SelectTrigger id="taxYear">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taxYearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entityType">Bentuk Badan</Label>
              <Select
                value={entityType}
                onValueChange={(v) => setEntityType(v as EntityType)}
              >
                <SelectTrigger id="entityType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kluCode">Kode KLU</Label>
              <Input
                id="kluCode"
                value={kluCode}
                onChange={(e) => setKluCode(e.target.value)}
                placeholder="Contoh: 46510"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Statements */}
      <Card>
        <Tabs defaultValue="income" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="income">Laba Rugi</TabsTrigger>
              <TabsTrigger value="balance">Neraca</TabsTrigger>
              <TabsTrigger value="credits">Kredit Pajak</TabsTrigger>
            </TabsList>
          </CardHeader>

          {/* Income Statement */}
          <TabsContent value="income">
            <CardContent className="space-y-6">
                {/* Revenue */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Pendapatan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pendapatan Bruto</Label>
                      <Input
                        value={formatCurrency(incomeStatement.grossRevenue)}
                        onChange={(e) =>
                          updateIncomeStatement('grossRevenue', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Retur Penjualan</Label>
                      <Input
                        value={formatCurrency(incomeStatement.salesReturns)}
                        onChange={(e) =>
                          updateIncomeStatement('salesReturns', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Diskon Penjualan</Label>
                      <Input
                        value={formatCurrency(incomeStatement.salesDiscounts)}
                        onChange={(e) =>
                          updateIncomeStatement('salesDiscounts', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2 p-3 bg-blue-50 rounded">
                      <Label className="text-blue-800">Pendapatan Neto</Label>
                      <p className="font-mono font-semibold text-blue-900">
                        Rp {formatCurrency(netRevenue)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COGS */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Harga Pokok Penjualan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>HPP / Beban Pokok</Label>
                      <Input
                        value={formatCurrency(incomeStatement.costOfRevenue)}
                        onChange={(e) =>
                          updateIncomeStatement('costOfRevenue', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2 p-3 bg-blue-50 rounded">
                      <Label className="text-blue-800">Laba Kotor</Label>
                      <p className="font-mono font-semibold text-blue-900">
                        Rp {formatCurrency(grossProfit)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Operating Expenses */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Beban Operasional
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Gaji dan Upah</Label>
                      <Input
                        value={formatCurrency(incomeStatement.salariesAndWages)}
                        onChange={(e) =>
                          updateIncomeStatement('salariesAndWages', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sewa</Label>
                      <Input
                        value={formatCurrency(incomeStatement.rentExpense)}
                        onChange={(e) =>
                          updateIncomeStatement('rentExpense', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Utilitas</Label>
                      <Input
                        value={formatCurrency(incomeStatement.utilitiesExpense)}
                        onChange={(e) =>
                          updateIncomeStatement('utilitiesExpense', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Penyusutan</Label>
                      <Input
                        value={formatCurrency(incomeStatement.depreciation)}
                        onChange={(e) =>
                          updateIncomeStatement('depreciation', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entertainment</Label>
                      <Input
                        value={formatCurrency(incomeStatement.entertainmentExpense)}
                        onChange={(e) =>
                          updateIncomeStatement('entertainmentExpense', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Beban Lainnya</Label>
                      <Input
                        value={formatCurrency(incomeStatement.otherOperatingExpenses)}
                        onChange={(e) =>
                          updateIncomeStatement(
                            'otherOperatingExpenses',
                            e.target.value
                          )
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 p-3 bg-gray-50 rounded">
                      <Label className="text-gray-600">Total Beban Operasional</Label>
                      <p className="font-mono font-semibold">
                        Rp {formatCurrency(totalOpex)}
                      </p>
                    </div>
                    <div className="space-y-2 p-3 bg-blue-50 rounded">
                      <Label className="text-blue-800">Laba Operasi</Label>
                      <p className="font-mono font-semibold text-blue-900">
                        Rp {formatCurrency(operatingIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Other Income */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Pendapatan Lain-lain
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Bunga Bank</Label>
                      <Input
                        value={formatCurrency(incomeStatement.interestIncome)}
                        onChange={(e) =>
                          updateIncomeStatement('interestIncome', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dividen</Label>
                      <Input
                        value={formatCurrency(incomeStatement.dividendIncome)}
                        onChange={(e) =>
                          updateIncomeStatement('dividendIncome', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sewa</Label>
                      <Input
                        value={formatCurrency(incomeStatement.rentalIncome)}
                        onChange={(e) =>
                          updateIncomeStatement('rentalIncome', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Ringkasan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 p-3 bg-green-50 rounded">
                      <Label className="text-green-800">Laba Sebelum Pajak</Label>
                      <p className="font-mono font-semibold text-green-900 text-lg">
                        Rp {formatCurrency(incomeBeforeTax)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Beban Pajak (Komersial)</Label>
                      <Input
                        value={formatCurrency(incomeStatement.incomeTaxExpense)}
                        onChange={(e) =>
                          updateIncomeStatement('incomeTaxExpense', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="balance">
            <CardContent className="space-y-6">
                {/* Assets */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">Aset</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Aset Lancar</Label>
                      <Input
                        value={formatCurrency(balanceSheet.currentAssets)}
                        onChange={(e) =>
                          updateBalanceSheet('currentAssets', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aset Tetap (Bruto)</Label>
                      <Input
                        value={formatCurrency(balanceSheet.fixedAssets)}
                        onChange={(e) =>
                          updateBalanceSheet('fixedAssets', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Akumulasi Penyusutan</Label>
                      <Input
                        value={formatCurrency(balanceSheet.accumulatedDepreciation)}
                        onChange={(e) =>
                          updateBalanceSheet('accumulatedDepreciation', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aset Lain-lain</Label>
                      <Input
                        value={formatCurrency(balanceSheet.otherAssets)}
                        onChange={(e) =>
                          updateBalanceSheet('otherAssets', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <Label className="text-blue-800">Total Aset</Label>
                    <p className="font-mono font-semibold text-blue-900">
                      Rp {formatCurrency(totalAssets)}
                    </p>
                  </div>
                </div>

                {/* Liabilities */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">
                    Kewajiban
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Kewajiban Lancar</Label>
                      <Input
                        value={formatCurrency(balanceSheet.currentLiabilities)}
                        onChange={(e) =>
                          updateBalanceSheet('currentLiabilities', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kewajiban Jangka Panjang</Label>
                      <Input
                        value={formatCurrency(balanceSheet.longTermLiabilities)}
                        onChange={(e) =>
                          updateBalanceSheet('longTermLiabilities', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-red-50 rounded">
                    <Label className="text-red-800">Total Kewajiban</Label>
                    <p className="font-mono font-semibold text-red-900">
                      Rp {formatCurrency(totalLiabilities)}
                    </p>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 border-b pb-2">Ekuitas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Modal Disetor</Label>
                      <Input
                        value={formatCurrency(balanceSheet.paidInCapital)}
                        onChange={(e) =>
                          updateBalanceSheet('paidInCapital', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Laba Ditahan</Label>
                      <Input
                        value={formatCurrency(balanceSheet.retainedEarnings)}
                        onChange={(e) =>
                          updateBalanceSheet('retainedEarnings', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <Label className="text-green-800">Total Ekuitas</Label>
                    <p className="font-mono font-semibold text-green-900">
                      Rp {formatCurrency(totalEquity)}
                    </p>
                  </div>
                </div>

                {/* Balance Check */}
                <div
                  className={`p-4 rounded-lg ${
                    isBalanced ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                  } border`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Status Neraca:</span>
                    <span
                      className={`font-bold ${
                        isBalanced ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {isBalanced ? 'BALANCE' : 'TIDAK BALANCE'}
                    </span>
                  </div>
                  {!isBalanced && (
                    <p className="text-sm text-red-600 mt-2">
                      Selisih: Rp{' '}
                      {formatCurrency(
                        Math.abs(totalAssets - (totalLiabilities + totalEquity))
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
          </TabsContent>

          {/* Tax Credits */}
          <TabsContent value="credits">
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>PPh 22 Dipungut</Label>
                    <Input
                      value={formatCurrency(taxCredits.pph22Withheld)}
                      onChange={(e) =>
                        updateTaxCredits('pph22Withheld', e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PPh 23 Dipotong</Label>
                    <Input
                      value={formatCurrency(taxCredits.pph23Withheld)}
                      onChange={(e) =>
                        updateTaxCredits('pph23Withheld', e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PPh 25 (Angsuran)</Label>
                    <Input
                      value={formatCurrency(taxCredits.pph25Installments)}
                      onChange={(e) =>
                        updateTaxCredits('pph25Installments', e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-800">
            <strong>Catatan:</strong> Sistem akan melakukan perhitungan koreksi fiskal
            otomatis berdasarkan data yang diinput. Pajak akan dihitung dengan tarif
            22% (atau 11% untuk UMKM dengan omzet &lt; Rp 50 Miliar).
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <div className="space-y-2">
            <Label htmlFor="correctionNumber">Pembetulan ke-</Label>
            <Select
              value={correctionNumber.toString()}
              onValueChange={(v) => setCorrectionNumber(parseInt(v))}
            >
              <SelectTrigger id="correctionNumber" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 (Normal)</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateSPT} disabled={isLoading} size="lg">
            {isLoading ? 'Generating...' : 'Generate SPT 1771'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SPT1771Generator;
