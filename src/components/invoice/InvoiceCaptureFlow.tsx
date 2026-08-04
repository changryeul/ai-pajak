'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClassificationReview } from './ClassificationReview';
import {
  Camera, Upload, Loader2, CheckCircle, RotateCcw, Plus, ArrowRight, ImageIcon,
} from 'lucide-react';

type Step = 'capture' | 'review' | 'saved';

interface ClassificationData {
  serviceCategory: string;
  serviceCode?: string;
  counterpartyName: string;
  counterpartyNpwp?: string;
  grossAmount: number;
  ppnAmount?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  description: string;
  confidence: number;
}

interface ResolutionData {
  taxType: string;
  rate: number;
  taxAmount: number;
  netAmount: number;
  isFinal: boolean;
  reason: string;
  legalBasis: string;
}

interface SavedResult {
  calculationId: string;
  period: string;
}

export function InvoiceCaptureFlow() {
  const t = useTranslations('killer');
  const [step, setStep] = useState<Step>('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [_selectedFile, setSelectedFile] = useState<File | null>(null);
  const [classification, setClassification] = useState<ClassificationData | null>(null);
  const [resolution, setResolution] = useState<ResolutionData | null>(null);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/customer/invoice-classify', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setClassification(data.data.classification);
        setResolution(data.data.resolution);
        setSavedResult({ calculationId: data.data.calculationId, period: data.data.period });
        setStep('review');
      } else {
        throw new Error(data.error || 'Classification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to classify invoice');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleConfirm = () => {
    setStep('saved');
  };

  const handleReset = () => {
    setStep('capture');
    setPreviewUrl(null);
    setSelectedFile(null);
    setClassification(null);
    setResolution(null);
    setSavedResult(null);
    setError(null);
  };

  // Step 1: Capture
  if (step === 'capture') {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Camera className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold">{t('invoice.captureTitle')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('invoice.captureDesc')}</p>
          </div>

          {isProcessing ? (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-500 mb-3" />
              <p className="text-sm font-medium text-gray-700">{t('invoice.analyzing')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('invoice.analyzingDetail')}</p>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">{t('invoice.dropzone')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('invoice.dropzoneHint')}</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />{t('invoice.camera')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />{t('invoice.fileSelect')}
                </Button>
              </div>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label="Capture invoice with camera"
                onChange={handleInputChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                aria-label="Select invoice file"
                onChange={handleInputChange}
              />

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 2: Review
  if (step === 'review' && classification && resolution) {
    return (
      <div className="space-y-4">
        {/* Preview */}
        {previewUrl && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob 미리보기 URL, next/image 부적합 */}
              <img src={previewUrl} alt="Invoice preview" className="w-full max-h-48 object-contain bg-gray-50" />
            </CardContent>
          </Card>
        )}

        {/* Classification review */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <ClassificationReview
              classification={classification}
              resolution={resolution}
              onClassificationChange={setClassification}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />{t('invoice.retake')}
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />{t('invoice.saveComplete')}
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Saved
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{t('invoice.saveComplete')}!</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('invoice.savedMessage', { period: savedResult?.period || '' })}
        </p>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />{t('invoice.addAnother')}
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={() => window.location.href = window.location.pathname.replace('/invoice-capture', '/tax/calculations')}
          >
            <ArrowRight className="h-4 w-4 mr-2" />{t('invoice.viewDrafts')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
