'use client';

import { useState } from 'react';
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
import {
  SPT1770SSData,
  PTKPStatus,
  PTKP_RATES,
} from '@/lib/tax/spt-1770ss/types';

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

export function SPT1770SSPreview({
  data,
  onDownloadPDF,
  onEdit,
  isLoading = false,
}: SPT1770SSPreviewProps) {
  const t = useTranslations();
  const [isDownloading, setIsDownloading] = useState(false);

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
              <CardTitle>SPT 1770 SS - Tahun Pajak {data.taxYear}</CardTitle>
              <CardDescription>
                SPT Tahunan PPh Wajib Pajak Orang Pribadi Sangat Sederhana
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge()}
              {data.correctionNumber > 0 && (
                <Badge variant="outline">Pembetulan ke-{data.correctionNumber}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Taxpayer Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identitas Wajib Pajak</CardTitle>
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
            Daftar Penghasilan ({data.incomeSources.length} sumber)
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
          <CardTitle className="text-lg">Ringkasan Perhitungan</CardTitle>
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
          {onEdit && (
            <Button variant="outline" onClick={onEdit} disabled={isLoading}>
              Edit Data
            </Button>
          )}
          {onDownloadPDF && (
            <Button
              onClick={handleDownload}
              disabled={isLoading || isDownloading}
            >
              {isDownloading ? 'Mengunduh...' : 'Download PDF'}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Bukti Potong List */}
      {data.incomeSources.some((s) => s.buktiPotongNumber) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daftar Bukti Potong</CardTitle>
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

      {/* Disclaimer */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">
            <strong>Perhatian:</strong> SPT ini dibuat berdasarkan data yang
            tersedia. Pastikan semua informasi sudah benar sebelum melakukan
            pelaporan ke DJP. Wajib Pajak bertanggung jawab atas kebenaran data
            yang dilaporkan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SPT1770SSPreview;
