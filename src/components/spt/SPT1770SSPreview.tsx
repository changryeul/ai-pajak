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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  SPT1770SSData,
  PTKPStatus,
} from '@/lib/tax/spt-1770ss/types';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SPT1770SSPreviewProps {
  data: SPT1770SSData;
  onDownloadPDF?: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

function formatNPWP(npwp: string): string {
  // Format: XX.XXX.XXX.X-XXX.XXX
  const digits = npwp.replace(/\D/g, '');
  if (digits.length !== 15) return npwp;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`;
}

const PTKP_LABELS: Record<PTKPStatus, string> = {
  'TK/0': 'Tidak Kawin / 0 Tanggungan',
  'TK/1': 'Tidak Kawin / 1 Tanggungan',
  'TK/2': 'Tidak Kawin / 2 Tanggungan',
  'TK/3': 'Tidak Kawin / 3 Tanggungan',
  'K/0': 'Kawin / 0 Tanggungan',
  'K/1': 'Kawin / 1 Tanggungan',
  'K/2': 'Kawin / 2 Tanggungan',
  'K/3': 'Kawin / 3 Tanggungan',
  'K/I/0': 'Kawin + Istri Gabung / 0 Tanggungan',
  'K/I/1': 'Kawin + Istri Gabung / 1 Tanggungan',
  'K/I/2': 'Kawin + Istri Gabung / 2 Tanggungan',
  'K/I/3': 'Kawin + Istri Gabung / 3 Tanggungan',
};

interface ValidationIssue {
  id: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
  expectedValue?: string;
  actualValue?: string;
}

interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  counts: { errors: number; warnings: number; infos: number };
  aiSummary?: string;
}

export function SPT1770SSPreview({
  data,
  onDownloadPDF,
  onEdit,
  isLoading = false,
}: SPT1770SSPreviewProps) {
  const ts = useTranslations('spt');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidation, setShowValidation] = useState(true);

  // Restore validation result from sessionStorage
  const validationKey = `spt_validation_${data.taxYear}`;
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(validationKey);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const runValidation = useCallback(async () => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/tax/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sptType: '1770SS',
          taxYear: data.taxYear,
          ptkpStatus: data.ptkpStatus,
          taxpayer: data.taxpayer,
          incomeSources: data.incomeSources,
          summary: data.summary,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setValidationResult(result.data);
        setShowValidation(true);
        try {
          sessionStorage.setItem(validationKey, JSON.stringify(result.data));
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  }, [data, validationKey]);

  const handleDownload = async () => {
    if (!onDownloadPDF) return;
    setIsDownloading(true);
    try {
      await onDownloadPDF();
    } finally {
      setIsDownloading(false);
    }
  };

  const statusBadge = () => {
    switch (data.summary.status) {
      case 'NIHIL':
        return <Badge className="bg-green-100 text-green-800">NIHIL</Badge>;
      case 'KURANG_BAYAR':
        return <Badge className="bg-red-100 text-red-800">Kurang Bayar</Badge>;
      case 'LEBIH_BAYAR':
        return <Badge className="bg-blue-100 text-blue-800">Lebih Bayar</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>SPT 1770 SS - {ts('taxYear')} {data.taxYear}</CardTitle>
              <CardDescription>
                SPT Tahunan PPh Wajib Pajak Orang Pribadi Sangat Sederhana
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge()}
              {data.correctionNumber > 0 && (
                <Badge variant="outline">{ts('correctionNumber')} {data.correctionNumber}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Taxpayer Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{ts('taxpayerInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Nama</span>
                <p className="font-medium">{data.taxpayer.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">NPWP</span>
                <p className="font-medium font-mono">
                  {formatNPWP(data.taxpayer.npwp)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">NIK</span>
                <p className="font-medium font-mono">{data.taxpayer.nik}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Alamat</span>
                <p className="font-medium">{data.taxpayer.address}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status PTKP</span>
                <p className="font-medium">
                  {data.ptkpStatus} - {PTKP_LABELS[data.ptkpStatus]}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Pekerjaan</span>
                <p className="font-medium">{data.taxpayer.occupation || 'Karyawan'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {ts('incomeList')} ({data.incomeSources.length} sumber)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Pemberi Kerja</th>
                  <th className="text-left py-2 px-3">Periode</th>
                  <th className="text-right py-2 px-3">Penghasilan Bruto</th>
                  <th className="text-right py-2 px-3">PPh Dipotong</th>
                </tr>
              </thead>
              <tbody>
                {data.incomeSources.map((source, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-3 px-3">
                      <div>{source.employerName}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {formatNPWP(source.employerNpwp)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {source.periodStart} - {source.periodEnd}/{source.taxYear}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      Rp {formatCurrency(source.grossIncome)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      Rp {formatCurrency(source.taxWithheld)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Summary */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle className="text-lg">{ts('calcSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Part A: Income */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">A. Penghasilan</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Penghasilan Bruto</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.summary.totalGrossIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pengurang (Biaya Jabatan + Iuran Pensiun)</span>
                  <span className="font-mono text-red-600">
                    - Rp {formatCurrency(data.summary.totalDeductions)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Penghasilan Neto</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.summary.totalNetIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Part B: PTKP and PKP */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">B. PTKP dan PKP</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    PTKP ({data.ptkpStatus})
                  </span>
                  <span className="font-mono text-red-600">
                    - Rp {formatCurrency(data.summary.ptkpAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Penghasilan Kena Pajak (PKP)</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.summary.taxableIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Part C: Tax */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">C. Perhitungan Pajak</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">PPh Terutang</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.summary.taxDue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PPh yang Sudah Dipotong</span>
                  <span className="font-mono text-green-600">
                    - Rp {formatCurrency(data.summary.totalTaxWithheld)}
                  </span>
                </div>
              </div>
            </div>

            {/* Final Result */}
            <div className="border-t-2 border-blue-300 pt-4">
              {data.summary.status === 'NIHIL' && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-700">Status: NIHIL</span>
                  <span className="text-lg font-mono font-bold text-green-700">Rp 0</span>
                </div>
              )}
              {data.summary.status === 'KURANG_BAYAR' && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-red-700">PPh Kurang Bayar</span>
                  <span className="text-lg font-mono font-bold text-red-700">
                    Rp {formatCurrency(data.summary.taxPayable)}
                  </span>
                </div>
              )}
              {data.summary.status === 'LEBIH_BAYAR' && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-blue-700">PPh Lebih Bayar (Restitusi)</span>
                  <span className="text-lg font-mono font-bold text-blue-700">
                    Rp {formatCurrency(data.summary.taxRefund)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 flex justify-between">
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" onClick={onEdit} disabled={isLoading}>
                {ts('editData')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={runValidation}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {ts('validating')}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {ts('validateSpt')}
                </>
              )}
            </Button>
          </div>
          {onDownloadPDF && (
            <Button
              onClick={handleDownload}
              disabled={isLoading || isDownloading}
            >
              {isDownloading ? (ts('downloading') || 'Downloading...') : ts('downloadPdf')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Bukti Potong List */}
      {data.incomeSources.some((s) => s.buktiPotongNumber) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ts('buktiPotongList')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">No. Bukti Potong</th>
                    <th className="text-left py-2 px-3">Tanggal</th>
                    <th className="text-left py-2 px-3">Pemotong</th>
                    <th className="text-right py-2 px-3">Jumlah PPh</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incomeSources
                    .filter((s) => s.buktiPotongNumber)
                    .map((source, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-3 px-3 font-mono">
                          {source.buktiPotongNumber}
                        </td>
                        <td className="py-3 px-3">{source.buktiPotongDate || '-'}</td>
                        <td className="py-3 px-3">{source.employerName}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          Rp {formatCurrency(source.taxWithheld)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Result */}
      {validationResult && (
        <Card className={`border-2 ${
          validationResult.isValid ? 'border-green-300' : 'border-red-300'
        }`}>
          <CardHeader
            className={`cursor-pointer ${
              validationResult.isValid ? 'bg-green-50' : 'bg-red-50'
            }`}
            onClick={() => setShowValidation(!showValidation)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 ${
                  validationResult.isValid ? 'text-green-600' : 'text-red-600'
                }`} />
                <div>
                  <CardTitle className="text-lg">
                    {ts('validationResult')} - Skor {validationResult.score}/100
                  </CardTitle>
                  <CardDescription className="flex gap-3 mt-1">
                    {validationResult.counts.errors > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {validationResult.counts.errors} Error
                      </span>
                    )}
                    {validationResult.counts.warnings > 0 && (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {validationResult.counts.warnings} Warning
                      </span>
                    )}
                    {validationResult.counts.infos > 0 && (
                      <span className="text-blue-600 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" />
                        {validationResult.counts.infos} Info
                      </span>
                    )}
                    {validationResult.issues.length === 0 && (
                      <span className="text-green-600">Tidak ada masalah ditemukan</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={validationResult.score} className="w-24" />
                {showValidation ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
          </CardHeader>

          {showValidation && (
            <CardContent className="pt-4 space-y-4">
              {/* AI Summary */}
              {validationResult.aiSummary && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  {validationResult.aiSummary}
                </div>
              )}

              {/* Issues list */}
              {validationResult.issues.length > 0 && (
                <div className="space-y-2">
                  {validationResult.issues.map((issue) => {
                    const severityConfig = {
                      ERROR: { icon: AlertCircle, color: 'border-red-200 bg-red-50', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
                      WARNING: { icon: AlertTriangle, color: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
                      INFO: { icon: Info, color: 'border-blue-200 bg-blue-50', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
                    };
                    const config = severityConfig[issue.severity];
                    const Icon = config.icon;

                    return (
                      <div key={issue.id} className={`border rounded-lg p-3 ${config.color}`}>
                        <div className="flex items-start gap-2">
                          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.text}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium text-sm ${config.text}`}>
                                {issue.title}
                              </span>
                              <Badge className={`text-xs ${config.badge}`}>
                                {issue.category}
                              </Badge>
                            </div>
                            <p className={`text-sm mt-1 ${config.text}`}>
                              {issue.description}
                            </p>
                            {issue.expectedValue && issue.actualValue && (
                              <p className="text-xs mt-1 opacity-75">
                                Seharusnya: {issue.expectedValue} | Aktual: {issue.actualValue}
                              </p>
                            )}
                            {issue.suggestion && (
                              <p className="text-xs mt-1 font-medium">
                                Saran: {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">
            {ts('disclaimer')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SPT1770SSPreview;
