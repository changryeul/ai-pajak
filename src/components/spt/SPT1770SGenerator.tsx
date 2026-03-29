'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SPT1770SPreview } from './SPT1770SPreview';
import type { SPT1770SData, PTKPStatus } from '@/lib/tax/spt-1770s/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';

interface SPT1770SGeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
  onComplete?: (data: SPT1770SData) => void;
}

const PTKP_VALUES: PTKPStatus[] = [
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
  'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
];

const PTKP_LABEL_KEYS: Record<PTKPStatus, string> = {
  'TK/0': 'ptkpTK0', 'TK/1': 'ptkpTK1', 'TK/2': 'ptkpTK2', 'TK/3': 'ptkpTK3',
  'K/0': 'ptkpK0', 'K/1': 'ptkpK1', 'K/2': 'ptkpK2', 'K/3': 'ptkpK3',
  'K/I/0': 'ptkpKI0', 'K/I/1': 'ptkpKI1', 'K/I/2': 'ptkpKI2', 'K/I/3': 'ptkpKI3',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

interface OtherIncomeForm {
  interestFromBank: number;
  dividends: number;
  rental: number;
  royalties: number;
  capitalGains: number;
  prizes: number;
  otherIncome: number;
}

interface TaxCreditsForm {
  pph21Withheld: number;
  pph22Withheld: number;
  pph23Withheld: number;
  pph25Installments: number;
}

export function SPT1770SGenerator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
  onComplete,
}: SPT1770SGeneratorProps) {
  const t = useTranslations('sptCommon');
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(defaultPtkpStatus);
  const [correctionNumber, setCorrectionNumber] = useState(0);

  const [otherIncome, setOtherIncome] = useState<OtherIncomeForm>({
    interestFromBank: 0,
    dividends: 0,
    rental: 0,
    royalties: 0,
    capitalGains: 0,
    prizes: 0,
    otherIncome: 0,
  });

  const [taxCredits, setTaxCredits] = useState<TaxCreditsForm>({
    pph21Withheld: 0,
    pph22Withheld: 0,
    pph23Withheld: 0,
    pph25Installments: 0,
  });

  const [sptData, setSptData] = useState<SPT1770SData | null>(null);

  const updateOtherIncome = (field: keyof OtherIncomeForm, value: string) => {
    const numValue = parseFloat(value) || 0;
    setOtherIncome((prev) => ({ ...prev, [field]: numValue }));
  };

  const updateTaxCredits = (field: keyof TaxCreditsForm, value: string) => {
    const numValue = parseFloat(value) || 0;
    setTaxCredits((prev) => ({ ...prev, [field]: numValue }));
  };

  const generateSPT = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          otherIncome: {
            ...otherIncome,
            totalOtherIncome: Object.values(otherIncome).reduce((a, b) => a + b, 0),
          },
          taxCredits: {
            ...taxCredits,
            totalTaxCredits: Object.values(taxCredits).reduce((a, b) => a + b, 0),
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
  }, [customerId, taxYear, ptkpStatus, correctionNumber, otherIncome, taxCredits, onComplete]);

  const handleDownloadPDF = useCallback(async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          otherIncome: {
            ...otherIncome,
            totalOtherIncome: Object.values(otherIncome).reduce((a, b) => a + b, 0),
          },
          taxCredits: {
            ...taxCredits,
            totalTaxCredits: Object.values(taxCredits).reduce((a, b) => a + b, 0),
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
      link.download = `SPT-1770S-${customerNpwp || customerId}-${taxYear}.pdf`;
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
  }, [customerId, customerNpwp, taxYear, ptkpStatus, correctionNumber, otherIncome, taxCredits]);

  if (step === 'preview' && sptData) {
    return (
      <SPT1770SPreview
        data={sptData}
        onEdit={() => setStep('form')}
        onDownloadPDF={handleDownloadPDF}
        isLoading={isLoading || isDownloading}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('generateSpt')} 1770 S</CardTitle>
        <CardDescription>
          {t('spt1770SGenDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">{t('taxpayer')}</h4>
          <p className="font-semibold">{customerName}</p>
          {customerNpwp && (
            <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
          )}
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">{t('basicData')}</TabsTrigger>
            <TabsTrigger value="otherIncome">{t('otherIncome')}</TabsTrigger>
            <TabsTrigger value="credits">{t('taxCredits')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Tax Year Selection */}
            <div className="space-y-2">
              <Label htmlFor="taxYear">{t('taxYear')}</Label>
              <Select
                value={taxYear.toString()}
                onValueChange={(v) => setTaxYear(parseInt(v))}
              >
                <SelectTrigger id="taxYear">
                  <SelectValue placeholder={t('selectTaxYear')} />
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

            {/* PTKP Status Selection */}
            <div className="space-y-2">
              <Label htmlFor="ptkpStatus">{t('ptkpStatus')}</Label>
              <Select
                value={ptkpStatus}
                onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}
              >
                <SelectTrigger id="ptkpStatus">
                  <SelectValue placeholder={t('selectPtkp')} />
                </SelectTrigger>
                <SelectContent>
                  {PTKP_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value} - {t(PTKP_LABEL_KEYS[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                PTKP: Rp {formatCurrency(PTKP_RATES[ptkpStatus])}
              </p>
            </div>

            {/* Correction Number */}
            <div className="space-y-2">
              <Label htmlFor="correctionNumber">{t('correctionPrefix')}</Label>
              <Select
                value={correctionNumber.toString()}
                onValueChange={(v) => setCorrectionNumber(parseInt(v))}
              >
                <SelectTrigger id="correctionNumber">
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

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                {t('spt1770SNote')}
              </p>
            </div>
          </TabsContent>

          {/* Other Income Tab */}
          <TabsContent value="otherIncome" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 mb-4">
              {t('fillOtherIncomeWork')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('interestFromBank')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.interestFromBank || ''}
                  onChange={(e) => updateOtherIncome('interestFromBank', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('dividend')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.dividends || ''}
                  onChange={(e) => updateOtherIncome('dividends', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('rental')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.rental || ''}
                  onChange={(e) => updateOtherIncome('rental', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('royalty')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.royalties || ''}
                  onChange={(e) => updateOtherIncome('royalties', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('capitalGains')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.capitalGains || ''}
                  onChange={(e) => updateOtherIncome('capitalGains', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('prizes')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.prizes || ''}
                  onChange={(e) => updateOtherIncome('prizes', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('otherIncomeLabel')} (Rp)</Label>
                <Input
                  type="number"
                  value={otherIncome.otherIncome || ''}
                  onChange={(e) => updateOtherIncome('otherIncome', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg mt-4">
              <div className="flex justify-between font-medium">
                <span>{t('totalOtherIncomeSum')}</span>
                <span className="font-mono">
                  Rp {formatCurrency(Object.values(otherIncome).reduce((a, b) => a + b, 0))}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Tax Credits Tab */}
          <TabsContent value="credits" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 mb-4">
              {t('fillTaxCredits')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pph21Additional')} (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph21Withheld || ''}
                  onChange={(e) => updateTaxCredits('pph21Withheld', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">
                  {t('pph21AutoNote')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('pph22Credit')} (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph22Withheld || ''}
                  onChange={(e) => updateTaxCredits('pph22Withheld', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('pph23CreditDiv')} (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph23Withheld || ''}
                  onChange={(e) => updateTaxCredits('pph23Withheld', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('pph25Credit')} (Rp)</Label>
                <Input
                  type="number"
                  value={taxCredits.pph25Installments || ''}
                  onChange={(e) => updateTaxCredits('pph25Installments', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg mt-4">
              <div className="flex justify-between font-medium">
                <span>{t('totalAdditionalCredits')}</span>
                <span className="font-mono">
                  Rp {formatCurrency(Object.values(taxCredits).reduce((a, b) => a + b, 0))}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button onClick={generateSPT} disabled={isLoading}>
          {isLoading ? t('generating') : t('generateSpt')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SPT1770SGenerator;
