'use client';

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
import type { SPT1771Data } from '@/lib/tax/spt-1771/types';

interface SPT1771PreviewProps {
  data: SPT1771Data;
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

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  PT: 'Perseroan Terbatas',
  CV: 'Commanditaire Vennootschap',
  FIRMA: 'Firma',
  KOPERASI: 'Koperasi',
  YAYASAN: 'Yayasan',
  OTHER: 'Lainnya',
};

export function SPT1771Preview({
  data,
  onDownloadPDF,
  onEdit,
  isLoading = false,
}: SPT1771PreviewProps) {
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
              <CardTitle>SPT 1771 - Tahun Pajak {data.taxYear}</CardTitle>
              <CardDescription>
                SPT Tahunan PPh Wajib Pajak Badan
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

      {/* Company Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identitas Wajib Pajak Badan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Nama Perusahaan</span>
                <p className="font-medium">{data.company.companyName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">NPWP</span>
                <p className="font-medium font-mono">
                  {formatNPWP(data.company.npwp)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Bentuk Badan</span>
                <p className="font-medium">
                  {ENTITY_TYPE_LABELS[data.company.entityType] || data.company.entityType}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Alamat</span>
                <p className="font-medium">{data.company.address}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Kode KLU</span>
                <p className="font-medium font-mono">
                  {data.company.kluCode || '-'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Periode Fiskal</span>
                <p className="font-medium">
                  {data.fiscalYear.startDate} s.d. {data.fiscalYear.endDate}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Statement Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ringkasan Laporan Laba Rugi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Pendapatan Neto</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.netRevenue)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Laba Kotor</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.grossProfit)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Laba Usaha</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.operatingIncome)}
              </span>
            </div>
            <div className="flex justify-between py-2 bg-blue-50 px-3 rounded">
              <span className="text-blue-800 font-medium">
                Laba Sebelum Pajak (Komersial)
              </span>
              <span className="font-mono font-bold text-blue-900">
                Rp {formatCurrency(data.summary.commercialIncome)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fiscal Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Koreksi Fiskal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Positive Adjustments */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                Koreksi Positif (Menambah Penghasilan Kena Pajak)
              </h4>
              <div className="bg-red-50 p-3 rounded space-y-2">
                {data.fiscalAdjustments.positiveAdjustments.incomeTaxExpense > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Beban Pajak Penghasilan</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.positiveAdjustments.incomeTaxExpense
                      )}
                    </span>
                  </div>
                )}
                {data.fiscalAdjustments.positiveAdjustments
                  .entertainmentWithoutDaftarNominatif > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Entertainment Tanpa Nominatif</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.positiveAdjustments
                          .entertainmentWithoutDaftarNominatif
                      )}
                    </span>
                  </div>
                )}
                {data.fiscalAdjustments.positiveAdjustments.finesAndPenalties > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Denda dan Sanksi</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.positiveAdjustments.finesAndPenalties
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total Koreksi Positif</span>
                  <span className="font-mono text-red-700">
                    + Rp{' '}
                    {formatCurrency(data.fiscalAdjustments.positiveAdjustments.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Negative Adjustments */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                Koreksi Negatif (Mengurangi Penghasilan Kena Pajak)
              </h4>
              <div className="bg-green-50 p-3 rounded space-y-2">
                {data.fiscalAdjustments.negativeAdjustments.dividendFromDomestic > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Dividen dari Dalam Negeri</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.negativeAdjustments.dividendFromDomestic
                      )}
                    </span>
                  </div>
                )}
                {data.fiscalAdjustments.negativeAdjustments.bankInterestFinalTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Bunga Bank (PPh Final)</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.negativeAdjustments.bankInterestFinalTax
                      )}
                    </span>
                  </div>
                )}
                {data.fiscalAdjustments.negativeAdjustments.propertyRentalFinalTax >
                  0 && (
                  <div className="flex justify-between text-sm">
                    <span>Sewa Tanah/Bangunan (PPh Final)</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.negativeAdjustments.propertyRentalFinalTax
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total Koreksi Negatif</span>
                  <span className="font-mono text-green-700">
                    - Rp{' '}
                    {formatCurrency(data.fiscalAdjustments.negativeAdjustments.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Adjustment */}
            <div className="flex justify-between p-3 bg-gray-100 rounded font-medium">
              <span>Koreksi Fiskal Neto</span>
              <span
                className={`font-mono ${
                  data.fiscalAdjustments.netAdjustment >= 0
                    ? 'text-red-700'
                    : 'text-green-700'
                }`}
              >
                {data.fiscalAdjustments.netAdjustment >= 0 ? '+' : ''} Rp{' '}
                {formatCurrency(data.fiscalAdjustments.netAdjustment)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Calculation */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle className="text-lg">Perhitungan Pajak</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Fiscal Income Calculation */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">A. Penghasilan Kena Pajak</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Laba Komersial</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.taxCalculation.commercialIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Koreksi Fiskal Neto</span>
                  <span
                    className={`font-mono ${
                      data.taxCalculation.netFiscalAdjustment >= 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {data.taxCalculation.netFiscalAdjustment >= 0 ? '+' : ''} Rp{' '}
                    {formatCurrency(data.taxCalculation.netFiscalAdjustment)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Penghasilan Fiskal</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.taxCalculation.fiscalIncome)}
                  </span>
                </div>
                {data.taxCalculation.lossCarryforwardUsed > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Kompensasi Kerugian</span>
                    <span className="font-mono">
                      - Rp {formatCurrency(data.taxCalculation.lossCarryforwardUsed)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between bg-blue-50 p-2 rounded">
                  <span className="font-bold text-blue-800">
                    Penghasilan Kena Pajak
                  </span>
                  <span className="font-mono font-bold text-blue-900">
                    Rp {formatCurrency(data.taxCalculation.taxableIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tax Rates */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">B. Perhitungan PPh Badan</h4>
              <div className="pl-4 space-y-1">
                {data.taxCalculation.smePortionLimit > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Bagian UMKM (Tarif {formatPercent(data.taxCalculation.smeRate)})
                      </span>
                      <span className="font-mono">
                        Rp {formatCurrency(data.taxCalculation.smePortionLimit)} x{' '}
                        {formatPercent(data.taxCalculation.smeRate)} = Rp{' '}
                        {formatCurrency(data.taxCalculation.taxOnSMEPortion)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Bagian Reguler (Tarif{' '}
                        {formatPercent(data.taxCalculation.corporateTaxRate)})
                      </span>
                      <span className="font-mono">
                        Rp{' '}
                        {formatCurrency(
                          data.taxCalculation.taxableIncome -
                            data.taxCalculation.smePortionLimit
                        )}{' '}
                        x {formatPercent(data.taxCalculation.corporateTaxRate)} = Rp{' '}
                        {formatCurrency(data.taxCalculation.taxOnRegularPortion)}
                      </span>
                    </div>
                  </>
                )}
                {data.taxCalculation.smePortionLimit === 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Tarif {formatPercent(data.taxCalculation.corporateTaxRate)}
                    </span>
                    <span className="font-mono">
                      Rp {formatCurrency(data.taxCalculation.taxableIncome)} x{' '}
                      {formatPercent(data.taxCalculation.corporateTaxRate)} = Rp{' '}
                      {formatCurrency(data.taxCalculation.grossTaxDue)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">PPh Terutang</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.taxCalculation.grossTaxDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tax Credits */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">C. Kredit Pajak</h4>
              <div className="pl-4 space-y-1">
                {data.taxCredits.pph22Withheld > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPh 22 Dipungut</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph22Withheld)}
                    </span>
                  </div>
                )}
                {data.taxCredits.pph23Withheld > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPh 23 Dipotong</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph23Withheld)}
                    </span>
                  </div>
                )}
                {data.taxCredits.pph25Installments > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPh 25 Angsuran</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph25Installments)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Total Kredit Pajak</span>
                  <span className="font-mono font-medium text-green-700">
                    - Rp {formatCurrency(data.taxCredits.totalTaxCredits)}
                  </span>
                </div>
              </div>
            </div>

            {/* Final Result */}
            <div className="border-t-2 border-blue-300 pt-4">
              {data.summary.status === 'NIHIL' && (
                <div className="flex justify-between items-center p-4 bg-green-100 rounded-lg">
                  <span className="text-lg font-bold text-green-700">
                    Status: NIHIL
                  </span>
                  <span className="text-lg font-mono font-bold text-green-700">
                    Rp 0
                  </span>
                </div>
              )}
              {data.summary.status === 'KURANG_BAYAR' && (
                <div className="flex justify-between items-center p-4 bg-red-100 rounded-lg">
                  <span className="text-lg font-bold text-red-700">PPh Kurang Bayar</span>
                  <span className="text-lg font-mono font-bold text-red-700">
                    Rp {formatCurrency(data.summary.taxPayable)}
                  </span>
                </div>
              )}
              {data.summary.status === 'LEBIH_BAYAR' && (
                <div className="flex justify-between items-center p-4 bg-blue-100 rounded-lg">
                  <span className="text-lg font-bold text-blue-700">
                    PPh Lebih Bayar (Restitusi)
                  </span>
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
            <Button onClick={onDownloadPDF} disabled={isLoading}>
              Download PDF
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* PPh 25 Next Year */}
      {data.summary.pph25MonthlyInstallment > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg text-amber-800">
              Angsuran PPh 25 Tahun Depan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-amber-700">Angsuran Bulanan</span>
              <span className="text-xl font-mono font-bold text-amber-800">
                Rp {formatCurrency(data.summary.pph25MonthlyInstallment)} / bulan
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statistik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">Pendapatan Bruto</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.incomeStatement.grossRevenue)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">Laba Fiskal</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.taxCalculation.fiscalIncome)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">PPh Terutang</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.taxCalculation.grossTaxDue)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">Tarif Efektif</p>
              <p className="font-mono font-semibold">
                {formatPercent(data.summary.effectiveTaxRate)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">
            <strong>Perhatian:</strong> SPT ini dibuat berdasarkan data yang diinput.
            Pastikan semua informasi sudah benar dan sesuai dengan laporan keuangan
            yang telah diaudit (jika diperlukan) sebelum melakukan pelaporan ke DJP.
            Wajib Pajak bertanggung jawab atas kebenaran data yang dilaporkan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SPT1771Preview;
