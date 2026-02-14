'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTaxFilingStore } from '@/stores/tax-filing-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DocumentOCRUploader } from '@/components/ocr';
import { FileText, Upload, X, CheckCircle } from 'lucide-react';

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
  highlight?: boolean;
}

function CurrencyInput({ label, value, onChange, placeholder, highlight }: CurrencyInputProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {highlight && (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
            OCR
          </Badge>
        )}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          Rp
        </span>
        <Input
          className={`pl-10 ${highlight ? 'border-green-500 bg-green-50' : ''}`}
          placeholder={placeholder || '0'}
          value={value ? formatCurrency(value) : ''}
          onChange={(e) => onChange(parseCurrency(e.target.value))}
        />
      </div>
    </div>
  );
}

interface OCRResult {
  documentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  category: string;
  confidence: number;
  extractedData: Record<string, unknown>;
  rawText: string;
  processingTimeMs: number;
  errorMessage?: string;
}

export function IncomeDataStep() {
  const t = useTranslations();
  const { taxType, incomeData, updateIncomeData, customer } = useTaxFilingStore();

  const [showOCRUploader, setShowOCRUploader] = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<string[]>([]);
  const [lastOCRResult, setLastOCRResult] = useState<OCRResult | null>(null);

  // Handle OCR completion for PPh23
  const handleOCRComplete = (documentId: string, result: OCRResult) => {
    console.log('OCR Result:', result);
    setLastOCRResult(result);

    const filledFields: string[] = [];
    const data = result.extractedData;

    // Map OCR extracted data to PPh23 fields
    // Common field names from Bukti Potong PPh 23
    if (data.serviceIncome || data.jumlahPenghasilanBruto || data.grossAmount) {
      const amount = Number(data.serviceIncome || data.jumlahPenghasilanBruto || data.grossAmount);
      if (amount > 0) {
        updateIncomeData({ serviceIncome: amount });
        filledFields.push('serviceIncome');
      }
    }

    if (data.royaltyIncome || data.royalti) {
      const amount = Number(data.royaltyIncome || data.royalti);
      if (amount > 0) {
        updateIncomeData({ royaltyIncome: amount });
        filledFields.push('royaltyIncome');
      }
    }

    if (data.dividendIncome || data.dividen) {
      const amount = Number(data.dividendIncome || data.dividen);
      if (amount > 0) {
        updateIncomeData({ dividendIncome: amount });
        filledFields.push('dividendIncome');
      }
    }

    if (data.interestIncome || data.bunga) {
      const amount = Number(data.interestIncome || data.bunga);
      if (amount > 0) {
        updateIncomeData({ interestIncome: amount });
        filledFields.push('interestIncome');
      }
    }

    // Try to extract tax withheld for reference
    if (data.pphDipotong || data.taxWithheld || data.pph23) {
      const taxAmount = Number(data.pphDipotong || data.taxWithheld || data.pph23);
      if (taxAmount > 0) {
        // Store as description for reference
        const currentDesc = incomeData.description || '';
        const newDesc = `${currentDesc}\nPPh 23 dipotong (dari OCR): Rp ${formatCurrency(taxAmount)}`.trim();
        updateIncomeData({ description: newDesc });
      }
    }

    setOcrFilledFields(filledFields);
    setShowOCRUploader(false);
  };

  const handleOCRError = (error: string) => {
    console.error('OCR Error:', error);
  };

  const clearOCRData = () => {
    setOcrFilledFields([]);
    setLastOCRResult(null);
  };

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
    <div className="space-y-6">
      {/* OCR Upload Section */}
      <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Scan Bukti Potong PPh 23
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showOCRUploader ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload gambar atau PDF Bukti Potong untuk mengisi form secara otomatis menggunakan OCR.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowOCRUploader(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Bukti Potong
                </Button>
                {lastOCRResult && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      {ocrFilledFields.length} field terisi dari OCR
                      ({(lastOCRResult.confidence * 100).toFixed(0)}% confidence)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearOCRData}
                      className="h-6 px-2 text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Upload Bukti Potong</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOCRUploader(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {customer?.id ? (
                <DocumentOCRUploader
                  customerId={customer.id}
                  expectedCategory="BUKTI_POTONG"
                  onUploadComplete={handleOCRComplete}
                  onError={handleOCRError}
                  className="border-0 shadow-none p-0"
                />
              ) : (
                <p className="text-sm text-amber-600">
                  Pilih customer terlebih dahulu untuk menggunakan fitur OCR.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Input Fields */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">{t('tax.income.services')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label={t('tax.income.serviceIncome')}
            value={incomeData.serviceIncome}
            onChange={(v) => updateIncomeData({ serviceIncome: v })}
            highlight={ocrFilledFields.includes('serviceIncome')}
          />
          <CurrencyInput
            label={t('tax.income.royaltyIncome')}
            value={incomeData.royaltyIncome}
            onChange={(v) => updateIncomeData({ royaltyIncome: v })}
            highlight={ocrFilledFields.includes('royaltyIncome')}
          />
          <CurrencyInput
            label={t('tax.income.dividendIncome')}
            value={incomeData.dividendIncome}
            onChange={(v) => updateIncomeData({ dividendIncome: v })}
            highlight={ocrFilledFields.includes('dividendIncome')}
          />
          <CurrencyInput
            label={t('tax.income.interestIncome')}
            value={incomeData.interestIncome}
            onChange={(v) => updateIncomeData({ interestIncome: v })}
            highlight={ocrFilledFields.includes('interestIncome')}
          />
        </div>
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
