'use client';

import { useState } from 'react';
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
import { Briefcase } from 'lucide-react';
import type {
  SPT1770Data,
  PTKPStatus,
  TaxBracketBreakdown,
} from '@/lib/tax/spt-1770/types';

interface SPT1770PreviewProps {
  data: SPT1770Data;
  onDownloadPDF?: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

function formatNPWP(npwp: string): string {
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

const BOOKKEEPING_LABELS: Record<string, string> = {
  PEMBUKUAN: 'Pembukuan (Lengkap)',
  NORMA: 'Norma (Sederhana)',
};

export function SPT1770Preview({
  data,
  onDownloadPDF,
  onEdit,
  isLoading = false,
}: SPT1770PreviewProps) {
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

  const formatBracketRange = (bracket: TaxBracketBreakdown): string => {
    if (bracket.upperLimit === Infinity) {
      return `> Rp ${formatCurrency(bracket.lowerLimit)}`;
    }
    return `Rp ${formatCurrency(bracket.lowerLimit)} - Rp ${formatCurrency(bracket.upperLimit)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>SPT 1770 - Tahun Pajak {data.taxYear}</CardTitle>
                <CardDescription>
                  SPT Tahunan PPh Wajib Pajak Orang Pribadi
                </CardDescription>
              </div>
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
              {data.taxpayer.nik && (
                <div>
                  <span className="text-sm text-gray-500">NIK</span>
                  <p className="font-medium font-mono">{data.taxpayer.nik}</p>
                </div>
              )}
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
                <p className="font-medium">{data.taxpayer.occupation || 'Wiraswasta'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Income */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Penghasilan dari Usaha ({data.businessIncome.length} usaha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.businessIncome.map((business, index) => (
              <div
                key={business.businessId || index}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{business.businessName}</h4>
                  <Badge variant="outline">
                    {BOOKKEEPING_LABELS[business.bookkeepingMethod] || business.bookkeepingMethod}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Kode KLU</span>
                    <p className="font-mono">{business.kluCode}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Peredaran Bruto</span>
                    <p className="font-mono">
                      Rp {formatCurrency(business.grossRevenue)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Penghasilan Neto</span>
                    <p className="font-mono">
                      Rp {formatCurrency(business.netBusinessIncome)}
                    </p>
                  </div>
                  {business.bookkeepingMethod === 'NORMA' && business.normaPercentage && (
                    <div>
                      <span className="text-gray-500">Norma %</span>
                      <p>{(business.normaPercentage * 100).toFixed(0)}%</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span className="font-medium">Total Peredaran Bruto</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.summary.totalBusinessRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Penghasilan Neto Usaha</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.summary.totalNetBusinessIncome)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Income (if any) */}
      {data.employmentIncome && data.employmentIncome.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Penghasilan dari Pekerjaan ({data.employmentIncome.length} sumber)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Pemberi Kerja</th>
                    <th className="text-right py-2 px-3">Penghasilan Bruto</th>
                    <th className="text-right py-2 px-3">PPh 21 Dipotong</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employmentIncome.map((source, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 px-3">
                        <div>{source.employerName}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {formatNPWP(source.employerNpwp)}
                        </div>
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
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between font-medium">
                <span>Total Penghasilan dari Pekerjaan</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.summary.totalEmploymentIncome)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Income (if any) */}
      {data.otherIncome && data.otherIncome.totalOtherIncome > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Penghasilan Lainnya</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.otherIncome.interestIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Bunga</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.interestIncome)}
                  </span>
                </div>
              )}
              {data.otherIncome.dividendIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Dividen</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.dividendIncome)}
                  </span>
                </div>
              )}
              {data.otherIncome.royaltyIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Royalti</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.royaltyIncome)}
                  </span>
                </div>
              )}
              {data.otherIncome.rentalIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sewa</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.rentalIncome)}
                  </span>
                </div>
              )}
              {data.otherIncome.capitalGains > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Keuntungan Penjualan Harta</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.capitalGains)}
                  </span>
                </div>
              )}
              {data.otherIncome.prizeIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Hadiah</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.prizeIncome)}
                  </span>
                </div>
              )}
              {data.otherIncome.otherIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Penghasilan Lainnya</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.otherIncome.otherIncome)}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t mt-4 pt-4">
              <div className="flex justify-between font-medium">
                <span>Total Penghasilan Lainnya</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.otherIncome.totalOtherIncome)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss Carryforward (if any) */}
      {data.lossCarryforward && data.lossCarryforward.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kompensasi Kerugian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Tahun Pajak</th>
                    <th className="text-right py-2 px-3">Kerugian Awal</th>
                    <th className="text-right py-2 px-3">Telah Dikompensasi</th>
                    <th className="text-right py-2 px-3">Dikompensasi Tahun Ini</th>
                    <th className="text-right py-2 px-3">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lossCarryforward.map((loss, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 px-3">{loss.taxYear}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        Rp {formatCurrency(loss.originalLoss)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        Rp {formatCurrency(loss.previouslyUsed)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-red-600">
                        Rp {formatCurrency(loss.usedThisYear)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        Rp {formatCurrency(loss.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between font-medium">
                <span>Total Kompensasi Digunakan</span>
                <span className="font-mono text-red-600">
                  Rp {formatCurrency(data.summary.lossCarryforwardUsed)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kredit Pajak</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.taxCredits.pph21Withheld > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">PPh 21 (dari pekerjaan)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.pph21Withheld)}
                </span>
              </div>
            )}
            {data.taxCredits.pph22Withheld > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">PPh 22 (impor, dll)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.pph22Withheld)}
                </span>
              </div>
            )}
            {data.taxCredits.pph23Withheld > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">PPh 23 (jasa, dll)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.pph23Withheld)}
                </span>
              </div>
            )}
            {data.taxCredits.pph24ForeignTaxCredit > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">PPh 24 (kredit pajak luar negeri)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.pph24ForeignTaxCredit)}
                </span>
              </div>
            )}
            {data.taxCredits.pph25Installments > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">PPh 25 (angsuran)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.pph25Installments)}
                </span>
              </div>
            )}
            {data.taxCredits.stpPayments > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">STP (Surat Tagihan Pajak)</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.stpPayments)}
                </span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total Kredit Pajak</span>
                <span className="font-mono">
                  Rp {formatCurrency(data.taxCredits.totalTaxCredits)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Summary */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="text-lg">Ringkasan Perhitungan</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Part A: Business Income */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">A. Penghasilan dari Usaha</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Peredaran Bruto</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.summary.totalBusinessRevenue)}
                  </span>
                </div>
                {data.summary.totalBusinessCOGS > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Harga Pokok Penjualan</span>
                    <span className="font-mono text-red-600">
                      - Rp {formatCurrency(data.summary.totalBusinessCOGS)}
                    </span>
                  </div>
                )}
                {data.summary.totalBusinessExpenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Biaya Operasional</span>
                    <span className="font-mono text-red-600">
                      - Rp {formatCurrency(data.summary.totalBusinessExpenses)}
                    </span>
                  </div>
                )}
                {data.summary.totalBusinessDepreciation > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Penyusutan</span>
                    <span className="font-mono text-red-600">
                      - Rp {formatCurrency(data.summary.totalBusinessDepreciation)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Penghasilan Neto Usaha</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.summary.totalNetBusinessIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Part B: Employment Income (if any) */}
            {data.summary.totalEmploymentIncome > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">B. Penghasilan dari Pekerjaan</h4>
                <div className="pl-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Penghasilan Neto</span>
                    <span className="font-mono">
                      Rp {formatCurrency(data.summary.totalEmploymentIncome)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Part C: Other Income (if any) */}
            {data.summary.totalOtherIncome > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">C. Penghasilan Lainnya</h4>
                <div className="pl-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Penghasilan Lainnya</span>
                    <span className="font-mono">
                      Rp {formatCurrency(data.summary.totalOtherIncome)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Part D: Gross Total Income */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">D. Total Penghasilan Bruto</h4>
              <div className="pl-4">
                <div className="flex justify-between font-medium">
                  <span>Jumlah Penghasilan</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.summary.grossTotalIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Part E: Loss Carryforward (if any) */}
            {data.summary.lossCarryforwardUsed > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">E. Kompensasi Kerugian</h4>
                <div className="pl-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kompensasi dari Tahun Sebelumnya</span>
                    <span className="font-mono text-red-600">
                      - Rp {formatCurrency(data.summary.lossCarryforwardUsed)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Part F: Net Income */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">F. Penghasilan Neto</h4>
              <div className="pl-4">
                <div className="flex justify-between font-medium">
                  <span>Total Penghasilan Neto</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.summary.totalNetIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Part G: PTKP and PKP */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">G. PTKP dan PKP</h4>
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

            {/* Part H: Tax Calculation with Bracket Breakdown */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">H. Perhitungan PPh Terutang</h4>
              <div className="pl-4 space-y-1">
                {data.summary.taxBreakdown && data.summary.taxBreakdown.length > 0 ? (
                  <>
                    {data.summary.taxBreakdown
                      .filter((b) => b.taxableAmount > 0)
                      .map((bracket) => (
                        <div key={bracket.bracketNumber} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {formatBracketRange(bracket)} x {bracket.rate * 100}%
                          </span>
                          <span className="font-mono">
                            Rp {formatCurrency(bracket.taxAmount)}
                          </span>
                        </div>
                      ))}
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-medium">PPh Terutang</span>
                      <span className="font-mono font-medium">
                        Rp {formatCurrency(data.summary.taxDue)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPh Terutang</span>
                    <span className="font-mono">
                      Rp {formatCurrency(data.summary.taxDue)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Part I: Tax Credits */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">I. Kredit Pajak</h4>
              <div className="pl-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Kredit Pajak</span>
                  <span className="font-mono text-green-600">
                    - Rp {formatCurrency(data.summary.totalTaxCredits)}
                  </span>
                </div>
              </div>
            </div>

            {/* Final Result */}
            <div className="border-t-2 border-purple-300 pt-4">
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

            {/* PPh 25 Installments for Next Year */}
            {data.summary.pph25MonthlyInstallment > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">
                  Angsuran PPh 25 Tahun Depan
                </h4>
                <div className="flex justify-between">
                  <span className="text-blue-700">Per Bulan</span>
                  <span className="font-mono font-medium text-blue-800">
                    Rp {formatCurrency(data.summary.pph25MonthlyInstallment)}
                  </span>
                </div>
              </div>
            )}
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

export default SPT1770Preview;
