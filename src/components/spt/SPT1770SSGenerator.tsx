'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { SPT1770SSPreview } from './SPT1770SSPreview';
import { DocumentOCRUploader } from '@/components/ocr/DocumentOCRUploader';
import {
  SPT1770SSData,
  PTKPStatus,
  PTKP_RATES,
  IncomeSource1721A1,
} from '@/lib/tax/spt-1770ss/types';
import { Upload, FileCheck, Settings, ChevronRight, Trash2, Edit2, Check, X } from 'lucide-react';

interface SPT1770SSGeneratorProps {
  customerId: string;
  customerName: string;
  customerNpwp?: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
  onComplete?: (data: SPT1770SSData) => void;
}

interface OCRExtractedIncome {
  employerNpwp: string;
  employerName: string;
  periodStart: string;
  periodEnd: string;
  grossIncome: number;
  positionCosts: number;
  pensionContribution: number;
  netIncome: number;
  taxWithheld: number;
  ptkpStatus?: string;
  taxYear?: number;
  buktiPotongNumber?: string;
  buktiPotongDate?: string;
  confidence: number;
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

type Step = 'upload' | 'form' | 'preview';

export function SPT1770SSGenerator({
  customerId,
  customerName,
  customerNpwp,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
  onComplete,
}: SPT1770SSGeneratorProps) {
  const ts = useTranslations('spt');
  const tf = useTranslations('sptForm');
  const tg = useTranslations('spt1770ss');
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const storageKey = `spt1770ss_${customerId}`;

  // Restore state from sessionStorage
  const getStoredState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  const storedState = getStoredState();

  const [step, setStep] = useState<Step>(storedState?.step || 'upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxYear, setTaxYear] = useState(storedState?.taxYear || defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(storedState?.ptkpStatus || defaultPtkpStatus);
  const [correctionNumber, setCorrectionNumber] = useState(storedState?.correctionNumber || 0);

  const [sptData, setSptData] = useState<SPT1770SSData | null>(storedState?.sptData || null);
  const [extractedIncomes, setExtractedIncomes] = useState<OCRExtractedIncome[]>(storedState?.extractedIncomes || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OCRExtractedIncome | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualForm, setManualForm] = useState({
    employerName: '', employerNpwp: '', grossIncome: '',
    positionCosts: '', pensionContribution: '', netIncome: '',
    taxWithheld: '', periodStart: '01', periodEnd: '12',
  });

  // Save state to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        step,
        taxYear,
        ptkpStatus,
        correctionNumber,
        sptData,
        extractedIncomes,
      }));
    } catch { /* ignore */ }
  }, [step, taxYear, ptkpStatus, correctionNumber, sptData, extractedIncomes, storageKey]);

  // Handle OCR completion
  const handleOCRComplete = useCallback(
    (_documentId: string, result: { confidence: number; extractedData: Record<string, unknown> }) => {
      const data = result.extractedData;

      const income: OCRExtractedIncome = {
        employerNpwp: (data.employerNpwp as string) || '',
        employerName: (data.employerName as string) || '',
        periodStart: (data.masaPajakAwal as string) || '01',
        periodEnd: (data.masaPajakAkhir as string) || '12',
        grossIncome: (data.penghasilanBruto as number) || 0,
        positionCosts: (data.biayaJabatan as number) || 0,
        pensionContribution: (data.iuranPensiun as number) || 0,
        netIncome: (data.penghasilanNeto as number) || 0,
        taxWithheld: (data.pphDipotong as number) || 0,
        ptkpStatus: (data.employeeStatus as string) || undefined,
        taxYear: (data.tahunPajak as number) || undefined,
        buktiPotongNumber: (data.nomorBuktiPotong as string) || undefined,
        buktiPotongDate: (data.tanggalBuktiPotong as string) || undefined,
        confidence: result.confidence,
      };

      setExtractedIncomes((prev) => [...prev, income]);

      // Auto-fill form fields from first OCR result
      if (income.ptkpStatus) {
        const validStatuses = Object.keys(PTKP_RATES);
        if (validStatuses.includes(income.ptkpStatus)) {
          setPtkpStatus(income.ptkpStatus as PTKPStatus);
        }
      }
      if (income.taxYear && income.taxYear >= 2020 && income.taxYear <= currentYear) {
        setTaxYear(income.taxYear);
      }
    },
    [currentYear]
  );

  const removeIncome = (index: number) => {
    setExtractedIncomes((prev) => prev.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...extractedIncomes[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editForm) return;
    setExtractedIncomes((prev) =>
      prev.map((item, i) => (i === editingIndex ? editForm : item))
    );
    setEditingIndex(null);
    setEditForm(null);
  };

  const addManualIncome = () => {
    const gross = Number(manualForm.grossIncome) || 0;
    const posCost = Number(manualForm.positionCosts) || Math.min(gross * 0.05, 6000000);
    const pension = Number(manualForm.pensionContribution) || 0;
    const net = Number(manualForm.netIncome) || (gross - posCost - pension);

    const income: OCRExtractedIncome = {
      employerName: manualForm.employerName || 'Pemberi Kerja',
      employerNpwp: manualForm.employerNpwp,
      periodStart: manualForm.periodStart,
      periodEnd: manualForm.periodEnd,
      grossIncome: gross,
      positionCosts: posCost,
      pensionContribution: pension,
      netIncome: net,
      taxWithheld: Number(manualForm.taxWithheld) || 0,
      confidence: 1.0, // Manual = 100% confidence
    };

    setExtractedIncomes((prev) => [...prev, income]);
    setManualForm({ employerName: '', employerNpwp: '', grossIncome: '', positionCosts: '', pensionContribution: '', netIncome: '', taxWithheld: '', periodStart: '01', periodEnd: '12' });
    setShowManualInput(false);
  };

  const proceedToForm = () => {
    setStep('form');
  };

  const generateSPT = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert extracted incomes to IncomeSource format if available
      let incomeSources: IncomeSource1721A1[] | undefined;
      if (extractedIncomes.length > 0) {
        incomeSources = extractedIncomes.map((income) => ({
          employerNpwp: income.employerNpwp,
          employerName: income.employerName,
          periodStart: income.periodStart,
          periodEnd: income.periodEnd,
          taxYear: income.taxYear || taxYear,
          grossIncome: income.grossIncome,
          positionCosts: income.positionCosts,
          pensionContribution: income.pensionContribution,
          netIncome: income.netIncome,
          ptkpAmount: PTKP_RATES[ptkpStatus],
          taxableIncome: Math.max(0, income.netIncome - PTKP_RATES[ptkpStatus]),
          taxDue: 0,
          taxWithheld: income.taxWithheld,
          buktiPotongNumber: income.buktiPotongNumber,
          buktiPotongDate: income.buktiPotongDate,
        }));
      }

      const response = await fetch('/api/tax/spt/1770ss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          correctionNumber,
          incomeSources,
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
  }, [customerId, taxYear, ptkpStatus, correctionNumber, extractedIncomes, onComplete]);

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

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[
        { key: 'upload', label: ts('uploadStep'), icon: Upload },
        { key: 'form', label: ts('settingsStep'), icon: Settings },
        { key: 'preview', label: ts('previewStep'), icon: FileCheck },
      ].map(({ key, label, icon: Icon }, index) => {
        const stepOrder: Step[] = ['upload', 'form', 'preview'];
        const currentIndex = stepOrder.indexOf(step);
        const itemIndex = stepOrder.indexOf(key as Step);
        const isActive = key === step;
        const isCompleted = itemIndex < currentIndex;

        return (
          <div key={key} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                isActive
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : isCompleted
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Preview step
  if (step === 'preview' && sptData) {
    return (
      <div>
        <StepIndicator />
        <SPT1770SSPreview
          data={sptData}
          onDownloadPDF={downloadPDF}
          onEdit={() => setStep('form')}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Upload step
  if (step === 'upload') {
    return (
      <div>
        <StepIndicator />
        <Card>
          <CardHeader>
            <CardTitle>{ts('uploadBuktiPotong')}</CardTitle>
            <CardDescription>
              {ts('uploadDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-2">{ts('taxpayer')}</h4>
              <p className="font-semibold">{customerName}</p>
              {customerNpwp && (
                <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
              )}
            </div>

            {/* OCR Uploader */}
            <DocumentOCRUploader
              customerId={customerId}
              expectedCategory="BUKTI_POTONG"
              onUploadComplete={handleOCRComplete}
              onError={(err) => setError(err)}
            />

            {/* Extracted Incomes List */}
            {extractedIncomes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">
                    {tf('extractedData')} ({extractedIncomes.length})
                  </h4>
                </div>

                {extractedIncomes.map((income, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 bg-white space-y-3"
                  >
                    {editingIndex === index && editForm ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Edit Data #{index + 1}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={saveEdit}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <Label className="text-xs">{tf('employer')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={editForm.employerName}
                              onChange={(e) =>
                                setEditForm({ ...editForm, employerName: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{tf('employerNpwp')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm font-mono"
                              value={editForm.employerNpwp}
                              onChange={(e) =>
                                setEditForm({ ...editForm, employerNpwp: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{tf('grossIncome')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm font-mono"
                              type="number"
                              value={editForm.grossIncome}
                              onChange={(e) =>
                                setEditForm({ ...editForm, grossIncome: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{tf('netIncome')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm font-mono"
                              type="number"
                              value={editForm.netIncome}
                              onChange={(e) =>
                                setEditForm({ ...editForm, netIncome: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{tf('positionCost')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm font-mono"
                              type="number"
                              value={editForm.positionCosts}
                              onChange={(e) =>
                                setEditForm({ ...editForm, positionCosts: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{tf('taxWithheld')}</Label>
                            <input
                              className="w-full border rounded px-2 py-1 text-sm font-mono"
                              type="number"
                              value={editForm.taxWithheld}
                              onChange={(e) =>
                                setEditForm({ ...editForm, taxWithheld: Number(e.target.value) })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {income.employerName || `${tf('employer')} #${index + 1}`}
                            </span>
                            <Badge
                              variant={income.confidence >= 0.8 ? 'default' : 'secondary'}
                              className={
                                income.confidence >= 0.8
                                  ? 'bg-green-100 text-green-700'
                                  : income.confidence >= 0.5
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              }
                            >
                              {(income.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(index)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeIncome(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">{tf('employerNpwp')}</span>
                            <p className="font-mono">{income.employerNpwp || '-'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Periode</span>
                            <p>
                              {income.periodStart}/{income.taxYear || taxYear} -{' '}
                              {income.periodEnd}/{income.taxYear || taxYear}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">No. Bukti Potong</span>
                            <p className="font-mono text-xs">{income.buktiPotongNumber || '-'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">{tf('grossIncome')}</span>
                            <p className="font-mono font-medium">
                              Rp {formatCurrency(income.grossIncome)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">{tf('netIncome')}</span>
                            <p className="font-mono">
                              Rp {formatCurrency(income.netIncome)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">{tf('taxWithheld')}</span>
                            <p className="font-mono text-red-600">
                              Rp {formatCurrency(income.taxWithheld)}
                            </p>
                          </div>
                        </div>

                        {income.ptkpStatus && (
                          <div className="text-xs text-gray-500">
                            Status PTKP terdeteksi: <strong>{income.ptkpStatus}</strong>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Summary */}
                <div className="border-t pt-3">
                  <div className="grid grid-cols-3 gap-3 text-sm font-medium">
                    <div>
                      <span className="text-gray-500 text-xs">{tf('totalGross')}</span>
                      <p className="font-mono">
                        Rp{' '}
                        {formatCurrency(
                          extractedIncomes.reduce((sum, i) => sum + i.grossIncome, 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">{tf('totalNet')}</span>
                      <p className="font-mono">
                        Rp{' '}
                        {formatCurrency(
                          extractedIncomes.reduce((sum, i) => sum + i.netIncome, 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">{tf('totalTaxWithheld')}</span>
                      <p className="font-mono text-red-600">
                        Rp{' '}
                        {formatCurrency(
                          extractedIncomes.reduce((sum, i) => sum + i.taxWithheld, 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-detected info */}
            {extractedIncomes.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>{tg('aiAutoInput')}:</strong> {extractedIncomes.length}{tg('docsRecognized')}
                  {extractedIncomes[0]?.ptkpStatus && (
                    <> {tg('ptkpStatusLabel')}: <strong>{extractedIncomes[0].ptkpStatus}</strong>.</>
                  )}
                  {extractedIncomes[0]?.taxYear && (
                    <> {tf('detectedYear')}: <strong>{extractedIncomes[0].taxYear}</strong>.</>
                  )}
                  {' '}{tg('verifyAndContinue')}
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Manual Input Form */}
            {showManualInput && (
              <div className="border-2 border-blue-200 rounded-xl p-5 bg-blue-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-blue-900">{tf('manualTitle')}</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowManualInput(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-blue-700">{tf('manualHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700">{tf('companyName')} *</label>
                    <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="PT Example Indonesia"
                      value={manualForm.employerName} onChange={e => setManualForm({ ...manualForm, employerName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">NPWP Perusahaan</label>
                    <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="XX.XXX.XXX.X-XXX.XXX"
                      value={manualForm.employerNpwp} onChange={e => setManualForm({ ...manualForm, employerNpwp: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700">{tf('totalSalaryYear')} *</label>
                    <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="120000000"
                      value={manualForm.grossIncome} onChange={e => setManualForm({ ...manualForm, grossIncome: e.target.value })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">{tf('salaryHint')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">{tf('taxAlreadyDeducted')} *</label>
                    <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="5000000"
                      value={manualForm.taxWithheld} onChange={e => setManualForm({ ...manualForm, taxWithheld: e.target.value })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">{tf('taxDeductedHint')}</p>
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600 font-medium">{tf('additionalData')}</summary>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-gray-600">{tf('positionCost')}</label>
                      <input type="number" className="w-full mt-1 px-2 py-1.5 border rounded text-xs font-mono" placeholder="Auto (5%)"
                        value={manualForm.positionCosts} onChange={e => setManualForm({ ...manualForm, positionCosts: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">{tf('pension')}</label>
                      <input type="number" className="w-full mt-1 px-2 py-1.5 border rounded text-xs font-mono" placeholder="0"
                        value={manualForm.pensionContribution} onChange={e => setManualForm({ ...manualForm, pensionContribution: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Gaji Bersih (Neto)</label>
                      <input type="number" className="w-full mt-1 px-2 py-1.5 border rounded text-xs font-mono" placeholder="Auto"
                        value={manualForm.netIncome} onChange={e => setManualForm({ ...manualForm, netIncome: e.target.value })} />
                    </div>
                  </div>
                </details>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowManualInput(false)}>{tf('cancel')}</Button>
                  <Button size="sm" onClick={addManualIncome} disabled={!manualForm.employerName || !manualForm.grossIncome}>
                    <Check className="h-3.5 w-3.5 mr-1" />{tf('add')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={proceedToForm}>
                {ts('skipUpload')}
              </Button>
              {!showManualInput && (
                <Button variant="outline" onClick={() => setShowManualInput(true)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" />{tf('manualInput')}
                </Button>
              )}
            </div>
            <Button
              onClick={proceedToForm}
              disabled={extractedIncomes.length === 0}
            >
              {tg('continueWithDocs', { count: extractedIncomes.length })}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Form step
  return (
    <div>
      <StepIndicator />
      <Card>
        <CardHeader>
          <CardTitle>{ts('settingsStep')} 1770 SS</CardTitle>
          <CardDescription>
            {extractedIncomes.length > 0
              ? tg('docIncomeReady', { count: extractedIncomes.length })
              : tg('fallbackDataDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">{ts('taxpayer')}</h4>
            <p className="font-semibold">{customerName}</p>
            {customerNpwp && (
              <p className="text-sm text-gray-500 font-mono">{customerNpwp}</p>
            )}
          </div>

          {/* Extracted income summary */}
          {extractedIncomes.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900 text-sm">
                  Data dari Dokumen ({extractedIncomes.length} Bukti Potong)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-blue-600 text-xs">{tf('totalGross')}</span>
                  <p className="font-mono font-medium text-blue-900">
                    Rp {formatCurrency(extractedIncomes.reduce((s, i) => s + i.grossIncome, 0))}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">{tf('totalNet')}</span>
                  <p className="font-mono font-medium text-blue-900">
                    Rp {formatCurrency(extractedIncomes.reduce((s, i) => s + i.netIncome, 0))}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">{tf('totalTaxWithheld')}</span>
                  <p className="font-mono font-medium text-blue-900">
                    Rp {formatCurrency(extractedIncomes.reduce((s, i) => s + i.taxWithheld, 0))}
                  </p>
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0 h-auto text-blue-600"
                onClick={() => setStep('upload')}
              >
                {ts('changeDocData')}
              </Button>
            </div>
          )}

          {/* Tax Year Selection */}
          <div className="space-y-2">
            <Label htmlFor="taxYear">{tf('detectedYear')}</Label>
            <Select
              value={taxYear.toString()}
              onValueChange={(v) => setTaxYear(parseInt(v))}
            >
              <SelectTrigger id="taxYear">
                <SelectValue placeholder={tg('taxYearPlaceholder')} />
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
            <Label htmlFor="ptkpStatus">{tg('ptkpLabel')}</Label>
            <Select
              value={ptkpStatus}
              onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}
            >
              <SelectTrigger id="ptkpStatus">
                <SelectValue placeholder={tg('ptkpPlaceholder')} />
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
            <Label htmlFor="correctionNumber">{tf('correction')}</Label>
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
          {extractedIncomes.length === 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>{tg('noteLabel')}:</strong> {tg('noDocUploadedMsg')}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('upload')}>
            {tg('backBtn')}
          </Button>
          <Button onClick={generateSPT} disabled={isLoading}>
            {isLoading ? ts('generating') : ts('generateSpt')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SPT1770SSGenerator;
