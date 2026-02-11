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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SPT1770SSPreview } from './SPT1770SSPreview';
import {
  SPT1770SSData,
  PTKPStatus,
  PTKP_RATES,
} from '@/lib/tax/spt-1770ss/types';

interface SPT1770SSGeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
  onComplete?: (data: SPT1770SSData) => void;
}

const PTKP_OPTIONS: { value: PTKPStatus; label: string }[] = [
  { value: 'TK/0', label: 'TK/0 - Tidak Kawin, 0 Tanggungan' },
  { value: 'TK/1', label: 'TK/1 - Tidak Kawin, 1 Tanggungan' },
  { value: 'TK/2', label: 'TK/2 - Tidak Kawin, 2 Tanggungan' },
  { value: 'TK/3', label: 'TK/3 - Tidak Kawin, 3 Tanggungan' },
  { value: 'K/0', label: 'K/0 - Kawin, 0 Tanggungan' },
  { value: 'K/1', label: 'K/1 - Kawin, 1 Tanggungan' },
  { value: 'K/2', label: 'K/2 - Kawin, 2 Tanggungan' },
  { value: 'K/3', label: 'K/3 - Kawin, 3 Tanggungan' },
  { value: 'K/I/0', label: 'K/I/0 - Kawin + Istri Gabung, 0 Tanggungan' },
  { value: 'K/I/1', label: 'K/I/1 - Kawin + Istri Gabung, 1 Tanggungan' },
  { value: 'K/I/2', label: 'K/I/2 - Kawin + Istri Gabung, 2 Tanggungan' },
  { value: 'K/I/3', label: 'K/I/3 - Kawin + Istri Gabung, 3 Tanggungan' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function SPT1770SSGenerator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
  onComplete,
}: SPT1770SSGeneratorProps) {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(defaultPtkpStatus);
  const [correctionNumber, setCorrectionNumber] = useState(0);

  const [sptData, setSptData] = useState<SPT1770SSData | null>(null);

  const generateSPT = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/spt/1770ss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
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
  }, [customerId, taxYear, ptkpStatus, correctionNumber, onComplete]);

  const downloadPDF = useCallback(async () => {
    try {
      const response = await fetch('/api/tax/spt/1770ss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          format: 'pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF generation failed');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SPT-1770SS-${taxYear}-${customerNpwp?.replace(/\./g, '') || customerId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  }, [customerId, taxYear, ptkpStatus, correctionNumber, customerNpwp]);

  if (step === 'preview' && sptData) {
    return (
      <SPT1770SSPreview
        data={sptData}
        onDownloadPDF={downloadPDF}
        onEdit={() => setStep('form')}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate SPT 1770 SS</CardTitle>
        <CardDescription>
          SPT Tahunan PPh Wajib Pajak Orang Pribadi Sangat Sederhana
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Wajib Pajak</h4>
          <p className="font-semibold">{customerName}</p>
          {customerNpwp && (
            <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
          )}
        </div>

        {/* Tax Year Selection */}
        <div className="space-y-2">
          <Label htmlFor="taxYear">Tahun Pajak</Label>
          <Select
            value={taxYear.toString()}
            onValueChange={(v) => setTaxYear(parseInt(v))}
          >
            <SelectTrigger id="taxYear">
              <SelectValue placeholder="Pilih tahun pajak" />
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
          <Label htmlFor="ptkpStatus">Status PTKP</Label>
          <Select
            value={ptkpStatus}
            onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}
          >
            <SelectTrigger id="ptkpStatus">
              <SelectValue placeholder="Pilih status PTKP" />
            </SelectTrigger>
            <SelectContent>
              {PTKP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
          <Label htmlFor="correctionNumber">Pembetulan ke-</Label>
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

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Catatan:</strong> SPT akan digenerate berdasarkan data Bukti
            Potong (Form 1721-A1) yang telah di-OCR atau data perhitungan pajak
            yang tersimpan untuk customer ini.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button
          onClick={generateSPT}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Generate SPT'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SPT1770SSGenerator;
