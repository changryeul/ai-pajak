'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface PaymentProofUploaderProps {
  queueItemId: string;
  amount: number;
  onSuccess: () => void;
}

export function PaymentProofUploader({ queueItemId, amount, onSuccess }: PaymentProofUploaderProps) {
  const t = useTranslations('payment');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(amount.toString());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      setError(t('invalidFileType'));
      return;
    }
    // Validate size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload file to Supabase Storage via documents/upload API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'tax-documents');
      formData.append('documentType', 'RECEIPT');

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadJson = await uploadRes.json();

      if (!uploadRes.ok || !uploadJson.success) {
        setError(uploadJson.error || t('uploadFailed'));
        return;
      }

      const fileUrl = uploadJson.data?.url || uploadJson.data?.signedUrl;

      // 2. Submit payment proof
      const proofRes = await fetch('/api/customer/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId,
          paymentProofUrl: fileUrl,
          paymentAmount: parseFloat(paymentAmount) || null,
          paymentDate: paymentDate || null,
        }),
      });
      const proofJson = await proofRes.json();

      if (proofJson.success) {
        onSuccess();
      } else {
        setError(proofJson.error || t('uploadFailed'));
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          file ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            {preview ? (
              <img src={preview} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
            ) : (
              <FileText className="h-10 w-10 text-emerald-500" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                className="text-xs text-red-500 hover:underline mt-1"
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
              >
                <X className="h-3 w-3 inline mr-1" />{t('removeFile')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('dropOrClick')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('allowedFormats')}</p>
          </div>
        )}
      </div>

      {/* Payment details */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('paymentAmount')} (Rp)</Label>
          <Input
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs">{t('paymentDate')}</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {isUploading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('uploading')}</>
        ) : (
          <><CheckCircle className="h-4 w-4 mr-2" /> {t('submitProof')}</>
        )}
      </Button>
    </div>
  );
}
