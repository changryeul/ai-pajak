'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Camera, Upload, CheckCircle, Loader2, AlertCircle,
  Download, Send, HelpCircle, ChevronRight, FileText,
  Sparkles, X, Image,
} from 'lucide-react';

type SimpleStep = 'upload' | 'review' | 'done';

interface ExtractedInfo {
  employeeName?: string;
  employerName?: string;
  grossIncome?: number;
  taxWithheld?: number;
  netIncome?: number;
  ptkpStatus?: string;
  taxYear?: number;
  taxDue?: number;
  status?: string;
  refundAmount?: number;
}

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

// Simple Indonesian labels for tax terms
const SIMPLE_LABELS: Record<string, string> = {
  employeeName: 'Nama Anda',
  employerName: 'Nama Perusahaan',
  grossIncome: 'Total Gaji Setahun',
  taxWithheld: 'Pajak Sudah Dipotong',
  netIncome: 'Gaji Bersih',
  ptkpStatus: 'Status Pernikahan',
  taxYear: 'Tahun',
  taxDue: 'Pajak Harus Dibayar',
  NIHIL: 'Tidak ada yang harus dibayar',
  KURANG_BAYAR: 'Masih harus bayar',
  LEBIH_BAYAR: 'Anda dapat pengembalian uang!',
};

const PTKP_SIMPLE: Record<string, string> = {
  'TK/0': 'Belum menikah',
  'TK/1': 'Belum menikah, 1 tanggungan',
  'TK/2': 'Belum menikah, 2 tanggungan',
  'TK/3': 'Belum menikah, 3 tanggungan',
  'K/0': 'Sudah menikah',
  'K/1': 'Sudah menikah, 1 anak',
  'K/2': 'Sudah menikah, 2 anak',
  'K/3': 'Sudah menikah, 3 anak',
};

export function SimpleMode() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [step, setStep] = useState<SimpleStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [showExample, setShowExample] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: OCR Extract
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expectedCategory', 'BUKTI_POTONG');

      const ocrRes = await fetch('/api/documents/ocr-extract', {
        method: 'POST', body: formData,
      });

      if (!ocrRes.ok) {
        const err = await ocrRes.json();
        throw new Error(err.error || 'Gagal membaca dokumen');
      }

      const ocrData = await ocrRes.json();
      const ext = ocrData.data?.extractedData || {};

      const info: ExtractedInfo = {
        employeeName: ext.employeeName || ext.fullName || '',
        employerName: ext.employerName || ext.entityName || '',
        grossIncome: ext.penghasilanBruto || ext.grossAmount || 0,
        taxWithheld: ext.pphDipotong || ext.taxAmount || 0,
        netIncome: ext.penghasilanNeto || 0,
        ptkpStatus: ext.employeeStatus || 'TK/0',
        taxYear: ext.tahunPajak || new Date().getFullYear() - 1,
      };

      // Simple tax calculation
      const ptkpAmount = getPtkpAmount(info.ptkpStatus || 'TK/0');
      const pkp = Math.max(0, (info.netIncome || 0) - ptkpAmount);
      const taxDue = calculateSimpleTax(pkp);
      const diff = taxDue - (info.taxWithheld || 0);

      info.taxDue = taxDue;
      info.status = diff === 0 ? 'NIHIL' : diff > 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR';
      info.refundAmount = diff < 0 ? Math.abs(diff) : 0;

      setExtractedInfo(info);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleConfirm = () => {
    setStep('done');
  };

  // Upload step
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        {/* Main Upload Card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
              <Camera className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">Foto Slip Gaji Tahunan</h2>
            <p className="text-blue-200 text-sm mt-1">
              Dari bagian HRD kantor Anda (disebut "Bukti Potong 1721-A1")
            </p>
          </div>

          <CardContent className="p-6">
            {/* Drop Zone */}
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all">
                <Upload className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">Ambil Foto atau Upload File</p>
                <p className="text-sm text-gray-500 mt-1">
                  Foto dari kamera HP atau file PDF/gambar
                </p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
              </div>
            </label>

            {/* Processing */}
            {isProcessing && (
              <div className="mt-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="font-medium text-gray-900">AI sedang membaca dokumen Anda...</p>
                <p className="text-sm text-gray-500 mt-1">Tunggu sebentar ya, biasanya 10-30 detik</p>
                <Progress value={66} className="mt-3 h-2" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">{error}</p>
                  <p className="text-sm text-red-600 mt-1">Pastikan foto jelas dan tidak terpotong</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Example */}
        <Card className="border-0 shadow-sm">
          <button
            onClick={() => setShowExample(!showExample)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-sm text-gray-900">Tidak tahu slip gaji tahunan?</p>
                <p className="text-xs text-gray-500">Klik untuk lihat contoh</p>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showExample ? 'rotate-90' : ''}`} />
          </button>

          {showExample && (
            <CardContent className="pt-0 pb-4 px-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Image className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 space-y-2">
                    <p className="font-medium">Slip gaji tahunan terlihat seperti ini:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Judul: <strong>"BUKTI PEMOTONGAN PAJAK PENGHASILAN PASAL 21"</strong></li>
                      <li>• Ada tulisan <strong>"FORMULIR 1721-A1"</strong></li>
                      <li>• Ada nama perusahaan dan nama Anda</li>
                      <li>• Ada angka gaji dan pajak yang dipotong</li>
                    </ul>
                    <p className="font-medium mt-2">Cara mendapatkannya:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Minta ke <strong>bagian HRD/Personalia</strong> di kantor Anda</li>
                      <li>• Biasanya diberikan di <strong>awal tahun</strong> (Januari-Februari)</li>
                      <li>• Bisa dalam bentuk <strong>kertas atau PDF</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Manual Input Option */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/${locale}/tax/spt-tahunan/1770ss`)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Tidak punya slip gaji? → Isi data manual
          </button>
        </div>
      </div>
    );
  }

  // Review step
  if (step === 'review' && extractedInfo) {
    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2" />
            <h2 className="text-lg font-bold">AI Berhasil Membaca Data Anda!</h2>
            <p className="text-green-100 text-sm">Periksa apakah data di bawah sudah benar</p>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* Extracted Data */}
            <div className="space-y-3">
              {[
                { key: 'employeeName', value: extractedInfo.employeeName },
                { key: 'employerName', value: extractedInfo.employerName },
                { key: 'taxYear', value: extractedInfo.taxYear?.toString() },
                { key: 'grossIncome', value: extractedInfo.grossIncome ? fmt(extractedInfo.grossIncome) : null },
                { key: 'taxWithheld', value: extractedInfo.taxWithheld ? fmt(extractedInfo.taxWithheld) : null },
                { key: 'ptkpStatus', value: PTKP_SIMPLE[extractedInfo.ptkpStatus || ''] || extractedInfo.ptkpStatus },
              ].filter(item => item.value).map(item => (
                <div key={item.key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{SIMPLE_LABELS[item.key] || item.key}</span>
                  <span className="font-medium text-sm text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Result */}
            <div className={`rounded-2xl p-5 text-center ${
              extractedInfo.status === 'NIHIL' ? 'bg-green-50 border-2 border-green-200' :
              extractedInfo.status === 'LEBIH_BAYAR' ? 'bg-blue-50 border-2 border-blue-200' :
              'bg-red-50 border-2 border-red-200'
            }`}>
              <p className="text-lg font-bold">
                {extractedInfo.status === 'NIHIL' && '✅ ' + SIMPLE_LABELS.NIHIL}
                {extractedInfo.status === 'KURANG_BAYAR' && '⚠️ ' + SIMPLE_LABELS.KURANG_BAYAR}
                {extractedInfo.status === 'LEBIH_BAYAR' && '🎉 ' + SIMPLE_LABELS.LEBIH_BAYAR}
              </p>
              {extractedInfo.status === 'LEBIH_BAYAR' && extractedInfo.refundAmount && (
                <p className="text-2xl font-bold text-blue-700 mt-2">{fmt(extractedInfo.refundAmount)}</p>
              )}
              {extractedInfo.status === 'KURANG_BAYAR' && extractedInfo.taxDue && (
                <p className="text-2xl font-bold text-red-700 mt-2">{fmt(Math.abs((extractedInfo.taxDue || 0) - (extractedInfo.taxWithheld || 0)))}</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <Button onClick={handleConfirm} className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg">
                <CheckCircle className="h-5 w-5 mr-2" />
                Ya, Data Sudah Benar
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setStep('upload'); setExtractedInfo(null); }}>
                Foto Ulang
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Done step
  if (step === 'done') {
    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-white text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold">SPT Anda Sudah Selesai! 🎉</h2>
            <p className="text-green-100 mt-2">Laporan pajak tahunan Anda sudah dibuat</p>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-12 bg-gradient-to-r from-blue-600 to-indigo-600" onClick={() => router.push(`/${locale}/tax/spt-tahunan/1770ss`)}>
                <Download className="h-5 w-5 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" className="h-12" onClick={() => router.push(`/${locale}/filings`)}>
                <Send className="h-5 w-5 mr-2" />
                Lapor ke DJP
              </Button>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800">
                <strong>Langkah selanjutnya:</strong><br />
                1. Download PDF untuk arsip Anda<br />
                2. Klik "Lapor ke DJP" untuk mengirim ke kantor pajak<br />
                3. Simpan nomor BPE sebagai bukti pelaporan
              </p>
            </div>

            <Button variant="ghost" className="w-full text-gray-500" onClick={() => { setStep('upload'); setExtractedInfo(null); }}>
              Upload dokumen lain
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

// Helpers
function getPtkpAmount(status: string): number {
  const rates: Record<string, number> = {
    'TK/0': 54e6, 'TK/1': 58.5e6, 'TK/2': 63e6, 'TK/3': 67.5e6,
    'K/0': 58.5e6, 'K/1': 63e6, 'K/2': 67.5e6, 'K/3': 72e6,
  };
  return rates[status] || 54e6;
}

function calculateSimpleTax(pkp: number): number {
  if (pkp <= 0) return 0;
  const brackets = [
    { limit: 60e6, rate: 0.05 }, { limit: 250e6, rate: 0.15 },
    { limit: 500e6, rate: 0.25 }, { limit: 5e9, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];
  let tax = 0, remaining = pkp, prev = 0;
  for (const b of brackets) {
    const t = Math.min(remaining, b.limit - prev);
    if (t <= 0) break;
    tax += t * b.rate;
    remaining -= t;
    prev = b.limit;
  }
  return Math.round(tax);
}
