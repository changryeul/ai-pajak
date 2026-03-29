'use client';

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

export function SPT1771Preview({
  data,
  onDownloadPDF,
  onEdit,
  isLoading = false,
}: SPT1771PreviewProps) {
  const t = useTranslations('sptCommon');

  const getEntityLabel = (type: string): string => {
    const map: Record<string, string> = {
      PT: t('entityPT'),
      CV: t('entityCV'),
      FIRMA: t('entityFirma'),
      KOPERASI: t('entityKoperasi'),
      YAYASAN: t('entityYayasan'),
      OTHER: t('entityOther'),
    };
    return map[type] || type;
  };

  const statusBadge = () => {
    switch (data.summary.status) {
      case 'NIHIL':
        return <Badge className="bg-green-100 text-green-800">NIHIL</Badge>;
      case 'KURANG_BAYAR':
        return <Badge className="bg-red-100 text-red-800">{t('kurangBayar')}</Badge>;
      case 'LEBIH_BAYAR':
        return <Badge className="bg-blue-100 text-blue-800">{t('lebihBayar')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>SPT 1771 - {t('taxYear')} {data.taxYear}</CardTitle>
              <CardDescription>
                {t('spt1771Desc')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge()}
              {data.correctionNumber > 0 && (
                <Badge variant="outline">{t('correctionPrefix')}{data.correctionNumber}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Company Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('corporateTaxpayer')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">{t('companyName')}</span>
                <p className="font-medium">{data.company.companyName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">NPWP</span>
                <p className="font-medium font-mono">
                  {formatNPWP(data.company.npwp)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('entityType')}</span>
                <p className="font-medium">
                  {getEntityLabel(data.company.entityType)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">{t('address')}</span>
                <p className="font-medium">{data.company.address}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('kluCode')}</span>
                <p className="font-medium font-mono">
                  {data.company.kluCode || '-'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">{t('fiscalPeriod')}</span>
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
          <CardTitle className="text-lg">{t('incomeStatementSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('netRevenue')}</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.netRevenue)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('grossProfit')}</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.grossProfit)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">{t('operatingIncome')}</span>
              <span className="font-mono font-medium">
                Rp {formatCurrency(data.summary.operatingIncome)}
              </span>
            </div>
            <div className="flex justify-between py-2 bg-blue-50 px-3 rounded">
              <span className="text-blue-800 font-medium">
                {t('incomeBeforeTax')}
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
          <CardTitle className="text-lg">{t('fiscalAdjustments')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Positive Adjustments */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                {t('positiveAdjustments')}
              </h4>
              <div className="bg-red-50 p-3 rounded space-y-2">
                {data.fiscalAdjustments.positiveAdjustments.incomeTaxExpense > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('incomeTaxExpense')}</span>
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
                    <span>{t('entertainmentNoNominatif')}</span>
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
                    <span>{t('finesAndPenalties')}</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.positiveAdjustments.finesAndPenalties
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>{t('totalPositiveAdj')}</span>
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
                {t('negativeAdjustments')}
              </h4>
              <div className="bg-green-50 p-3 rounded space-y-2">
                {data.fiscalAdjustments.negativeAdjustments.dividendFromDomestic > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('domesticDividend')}</span>
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
                    <span>{t('bankInterestFinal')}</span>
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
                    <span>{t('propertyRentalFinal')}</span>
                    <span className="font-mono">
                      Rp{' '}
                      {formatCurrency(
                        data.fiscalAdjustments.negativeAdjustments.propertyRentalFinalTax
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>{t('totalNegativeAdj')}</span>
                  <span className="font-mono text-green-700">
                    - Rp{' '}
                    {formatCurrency(data.fiscalAdjustments.negativeAdjustments.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Adjustment */}
            <div className="flex justify-between p-3 bg-gray-100 rounded font-medium">
              <span>{t('netFiscalAdj')}</span>
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
          <CardTitle className="text-lg">{t('taxCalculation')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Fiscal Income Calculation */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">A. {t('taxableIncomeCalc')}</h4>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('commercialProfit')}</span>
                  <span className="font-mono">
                    Rp {formatCurrency(data.taxCalculation.commercialIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('netFiscalAdjCalc')}</span>
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
                  <span className="font-medium">{t('fiscalIncome')}</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.taxCalculation.fiscalIncome)}
                  </span>
                </div>
                {data.taxCalculation.lossCarryforwardUsed > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>{t('lossCompensation')}</span>
                    <span className="font-mono">
                      - Rp {formatCurrency(data.taxCalculation.lossCarryforwardUsed)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between bg-blue-50 p-2 rounded">
                  <span className="font-bold text-blue-800">
                    {t('taxableIncomeLabel')}
                  </span>
                  <span className="font-mono font-bold text-blue-900">
                    Rp {formatCurrency(data.taxCalculation.taxableIncome)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tax Rates */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">B. {t('corpTaxCalc')}</h4>
              <div className="pl-4 space-y-1">
                {data.taxCalculation.smePortionLimit > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {t('smePortionRate', { rate: formatPercent(data.taxCalculation.smeRate) })}
                      </span>
                      <span className="font-mono">
                        Rp {formatCurrency(data.taxCalculation.smePortionLimit)} x{' '}
                        {formatPercent(data.taxCalculation.smeRate)} = Rp{' '}
                        {formatCurrency(data.taxCalculation.taxOnSMEPortion)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {t('regularPortionRate', { rate: formatPercent(data.taxCalculation.corporateTaxRate) })}
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
                      {t('taxRate')} {formatPercent(data.taxCalculation.corporateTaxRate)}
                    </span>
                    <span className="font-mono">
                      Rp {formatCurrency(data.taxCalculation.taxableIncome)} x{' '}
                      {formatPercent(data.taxCalculation.corporateTaxRate)} = Rp{' '}
                      {formatCurrency(data.taxCalculation.grossTaxDue)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">{t('pphDue')}</span>
                  <span className="font-mono font-medium">
                    Rp {formatCurrency(data.taxCalculation.grossTaxDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tax Credits */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">C. {t('corpTaxCredits')}</h4>
              <div className="pl-4 space-y-1">
                {data.taxCredits.pph22Withheld > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pph22Collected')}</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph22Withheld)}
                    </span>
                  </div>
                )}
                {data.taxCredits.pph23Withheld > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pph23Deducted')}</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph23Withheld)}
                    </span>
                  </div>
                )}
                {data.taxCredits.pph25Installments > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pph25Installments')}</span>
                    <span className="font-mono text-green-600">
                      - Rp {formatCurrency(data.taxCredits.pph25Installments)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">{t('totalTaxCredits')}</span>
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
                    {t('statusNihil')}
                  </span>
                  <span className="text-lg font-mono font-bold text-green-700">
                    Rp 0
                  </span>
                </div>
              )}
              {data.summary.status === 'KURANG_BAYAR' && (
                <div className="flex justify-between items-center p-4 bg-red-100 rounded-lg">
                  <span className="text-lg font-bold text-red-700">{t('pphUnderpaid')}</span>
                  <span className="text-lg font-mono font-bold text-red-700">
                    Rp {formatCurrency(data.summary.taxPayable)}
                  </span>
                </div>
              )}
              {data.summary.status === 'LEBIH_BAYAR' && (
                <div className="flex justify-between items-center p-4 bg-blue-100 rounded-lg">
                  <span className="text-lg font-bold text-blue-700">
                    {t('pphOverpaid')}
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
              {t('editData')}
            </Button>
          )}
          {onDownloadPDF && (
            <Button onClick={onDownloadPDF} disabled={isLoading}>
              {t('downloadPdf')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* PPh 25 Next Year */}
      {data.summary.pph25MonthlyInstallment > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg text-amber-800">
              {t('pph25NextYear')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-amber-700">{t('monthlyInstallment')}</span>
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
          <CardTitle className="text-lg">{t('statistics')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">{t('grossRevenueStats')}</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.incomeStatement.grossRevenue)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">{t('fiscalProfit')}</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.taxCalculation.fiscalIncome)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">{t('pphDue')}</p>
              <p className="font-mono font-semibold">
                Rp {formatCurrency(data.taxCalculation.grossTaxDue)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-500">{t('effectiveTaxRate')}</p>
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
            {t('disclaimerCorp')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SPT1771Preview;
