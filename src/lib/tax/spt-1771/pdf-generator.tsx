/**
 * SPT 1771 PDF Generator
 *
 * Generates PDF document for Indonesian corporate annual tax return (SPT Tahunan 1771)
 * Uses @react-pdf/renderer for PDF generation
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { SPT1771Data, TaxStatus } from './types';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 2,
  },
  formNumber: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#e8e8e8',
    padding: 6,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  label: {
    width: '55%',
    paddingRight: 8,
  },
  value: {
    width: '45%',
    textAlign: 'right',
  },
  labelWide: {
    width: '70%',
    paddingRight: 8,
  },
  valueNarrow: {
    width: '30%',
    textAlign: 'right',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginVertical: 6,
  },
  dividerThick: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    marginVertical: 8,
  },
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    padding: 4,
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
  },
  tableCellSmall: {
    width: 50,
    fontSize: 8,
    textAlign: 'center',
  },
  tableCellNumber: {
    flex: 1,
    fontSize: 8,
    textAlign: 'right',
  },
  summary: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  summaryLabel: {
    width: '60%',
  },
  summaryValue: {
    width: '40%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  highlight: {
    backgroundColor: '#fffde7',
    padding: 4,
  },
  highlightGreen: {
    backgroundColor: '#e8f5e9',
    padding: 4,
  },
  highlightOrange: {
    backgroundColor: '#fff3e0',
    padding: 4,
  },
  highlightBlue: {
    backgroundColor: '#e3f2fd',
    padding: 4,
  },
  footer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    textAlign: 'center',
    paddingTop: 8,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 50,
    paddingTop: 4,
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    transform: 'rotate(-30deg)',
    fontSize: 60,
    color: '#f0f0f0',
    opacity: 0.3,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center',
  },
  statusNihil: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  statusKurangBayar: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
  },
  statusLebihBayar: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  bold: {
    fontWeight: 'bold',
  },
  small: {
    fontSize: 7,
    color: '#666',
  },
  companyInfo: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  companyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  twoColumn: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    paddingRight: 8,
  },
  subSection: {
    marginLeft: 12,
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingTop: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    fontWeight: 'bold',
  },
});

/**
 * Format number as Indonesian Rupiah
 */
function formatRupiah(amount: number): string {
  if (amount === 0) return 'Rp 0';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('id-ID');
  return isNegative ? `(Rp ${formatted})` : `Rp ${formatted}`;
}

/**
 * Format percentage
 */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Format date
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface SPT1771PDFProps {
  data: SPT1771Data;
  showWatermark?: boolean;
}

/**
 * SPT 1771 PDF Document Component
 */
export function SPT1771PDF({ data, showWatermark = false }: SPT1771PDFProps) {
  const {
    company,
    taxYear,
    fiscalYear,
    correctionNumber,
    submissionDate,
    incomeStatement,
    balanceSheet,
    fiscalAdjustments,
    taxCalculation,
    taxCredits,
    lossCarryforward,
    summary,
  } = data;

  const statusStyles = {
    NIHIL: styles.statusNihil,
    KURANG_BAYAR: styles.statusKurangBayar,
    LEBIH_BAYAR: styles.statusLebihBayar,
  };

  const statusLabels = {
    NIHIL: 'NIHIL',
    KURANG_BAYAR: 'KURANG BAYAR',
    LEBIH_BAYAR: 'LEBIH BAYAR',
  };

  return (
    <Document>
      {/* Page 1: Main Form */}
      <Page size="A4" style={styles.page}>
        {showWatermark && <Text style={styles.watermark}>DRAFT</Text>}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            SURAT PEMBERITAHUAN (SPT) TAHUNAN
          </Text>
          <Text style={styles.subtitle}>
            PAJAK PENGHASILAN WAJIB PAJAK BADAN
          </Text>
          <Text style={styles.formNumber}>
            Formulir 1771 - Tahun Pajak {taxYear}
            {correctionNumber > 0 && ` (Pembetulan ke-${correctionNumber})`}
          </Text>
        </View>

        {/* Company Information */}
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{company.companyName}</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>NPWP</Text>
                <Text style={styles.value}>{company.npwp}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Jenis Badan</Text>
                <Text style={styles.value}>{company.entityType}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>KLU</Text>
                <Text style={styles.value}>{company.kluCode || '-'}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>Tahun Buku</Text>
                <Text style={styles.value}>
                  {fiscalYear.startDate} s.d. {fiscalYear.endDate}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Alamat</Text>
                <Text style={styles.value}>{company.address || '-'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Income Statement Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. LAPORAN LABA RUGI (KOMERSIAL)</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>1. Peredaran Usaha/Penjualan Bruto</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.grossRevenue)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>2. Retur dan Diskon Penjualan</Text>
            <Text style={styles.valueNarrow}>
              {formatRupiah(incomeStatement.salesReturns + incomeStatement.salesDiscounts)}
            </Text>
          </View>
          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>3. Penjualan Bersih (1-2)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.netRevenue)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.labelWide}>4. Harga Pokok Penjualan</Text>
            <Text style={styles.valueNarrow}>
              {formatRupiah(incomeStatement.costOfRevenue.totalCostOfRevenue)}
            </Text>
          </View>
          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>5. Laba Bruto (3-4)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.grossProfit)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.labelWide}>6. Biaya Operasional</Text>
            <Text style={styles.valueNarrow}>
              {formatRupiah(incomeStatement.operatingExpenses.totalOperatingExpenses)}
            </Text>
          </View>
          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>7. Laba Usaha (5-6)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.operatingIncome)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.labelWide}>8. Pendapatan Lain-lain</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.otherIncome.total)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>9. Beban Lain-lain</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.otherExpenses.total)}</Text>
          </View>
          <View style={[styles.row, styles.bold, styles.highlight]}>
            <Text style={styles.labelWide}>10. Laba Sebelum Pajak (7+8-9)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(incomeStatement.incomeBeforeTax)}</Text>
          </View>
        </View>

        {/* Fiscal Adjustments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. KOREKSI FISKAL</Text>

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>A. Koreksi Positif</Text>
            <Text style={styles.valueNarrow}></Text>
          </View>
          <View style={styles.subSection}>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Entertainment tanpa Daftar Nominatif</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.entertainmentWithoutDaftarNominatif)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Biaya Pribadi/Natura</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.personalExpenses)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Sumbangan Melebihi Batas</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.donationsExceedingLimit)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Denda/Sanksi Pajak</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.finesAndPenalties)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Beban Pajak Penghasilan</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.incomeTaxExpense)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Selisih Penyusutan Komersial &gt; Fiskal</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.excessAccountingDepreciation)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Koreksi Positif Lainnya</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.otherPositiveAdjustments)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.labelWide}>Jumlah Koreksi Positif</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.positiveAdjustments.total)}
              </Text>
            </View>
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.labelWide, styles.bold]}>B. Koreksi Negatif</Text>
            <Text style={styles.valueNarrow}></Text>
          </View>
          <View style={styles.subSection}>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Dividen dari Dalam Negeri</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.negativeAdjustments.dividendFromDomestic)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Penghasilan yang Dikenakan PPh Final</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.negativeAdjustments.finalTaxedIncome)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Selisih Penyusutan Fiskal &gt; Komersial</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.negativeAdjustments.excessFiscalDepreciation)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelWide}>- Koreksi Negatif Lainnya</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.negativeAdjustments.otherNegativeAdjustments)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.labelWide}>Jumlah Koreksi Negatif</Text>
              <Text style={styles.valueNarrow}>
                {formatRupiah(fiscalAdjustments.negativeAdjustments.total)}
              </Text>
            </View>
          </View>

          <View style={[styles.row, styles.bold, styles.highlight, { marginTop: 8 }]}>
            <Text style={styles.labelWide}>Koreksi Fiskal Neto (A - B)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(fiscalAdjustments.netAdjustment)}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Tax Calculation */}
      <Page size="A4" style={styles.page}>
        {showWatermark && <Text style={styles.watermark}>DRAFT</Text>}

        {/* Tax Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. PERHITUNGAN PAJAK PENGHASILAN</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>11. Penghasilan Neto Komersial</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.commercialIncome)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>12. Koreksi Fiskal Positif</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.totalPositiveAdjustments)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>13. Koreksi Fiskal Negatif</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.totalNegativeAdjustments)}</Text>
          </View>
          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>14. Penghasilan Neto Fiskal (11+12-13)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.fiscalIncome)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Loss Carryforward */}
          {lossCarryforward && lossCarryforward.length > 0 && taxCalculation.lossCarryforwardUsed > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.labelWide}>15. Kompensasi Kerugian Tahun Sebelumnya</Text>
                <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.lossCarryforwardUsed)}</Text>
              </View>
              <View style={styles.subSection}>
                {lossCarryforward.filter(l => l.compensatedThisYear > 0).map((loss, idx) => (
                  <View key={idx} style={styles.row}>
                    <Text style={styles.labelWide}>- Tahun {loss.taxYear}</Text>
                    <Text style={styles.valueNarrow}>{formatRupiah(loss.compensatedThisYear)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={[styles.row, styles.bold, styles.highlight]}>
            <Text style={styles.labelWide}>16. Penghasilan Kena Pajak</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.taxableIncome)}</Text>
          </View>

          <View style={styles.dividerThick} />

          {/* Tax Calculation Detail */}
          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>17. Perhitungan PPh Terutang</Text>
            <Text style={styles.valueNarrow}></Text>
          </View>

          {incomeStatement.grossRevenue < 50_000_000_000 && taxCalculation.taxableIncome > 0 && (
            <View style={styles.subSection}>
              <View style={styles.row}>
                <Text style={styles.labelWide}>
                  a. {formatPercent(taxCalculation.smeRate)} x{' '}
                  {formatRupiah(Math.min(taxCalculation.taxableIncome, taxCalculation.smePortionLimit))}
                  {' '}(Porsi UMKM)
                </Text>
                <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.taxOnSMEPortion)}</Text>
              </View>
              {taxCalculation.taxableIncome > taxCalculation.smePortionLimit && (
                <View style={styles.row}>
                  <Text style={styles.labelWide}>
                    b. {formatPercent(taxCalculation.corporateTaxRate)} x{' '}
                    {formatRupiah(taxCalculation.taxableIncome - taxCalculation.smePortionLimit)}
                    {' '}(Porsi Reguler)
                  </Text>
                  <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.taxOnRegularPortion)}</Text>
                </View>
              )}
            </View>
          )}

          {incomeStatement.grossRevenue >= 50_000_000_000 && taxCalculation.taxableIncome > 0 && (
            <View style={styles.subSection}>
              <View style={styles.row}>
                <Text style={styles.labelWide}>
                  {formatPercent(taxCalculation.corporateTaxRate)} x {formatRupiah(taxCalculation.taxableIncome)}
                </Text>
                <Text style={styles.valueNarrow}>{formatRupiah(taxCalculation.grossTaxDue)}</Text>
              </View>
            </View>
          )}

          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>18. PPh Terutang</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(Math.max(0, taxCalculation.grossTaxDue))}</Text>
          </View>
        </View>

        {/* Tax Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IV. KREDIT PAJAK</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>19. PPh Pasal 22</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.pph22Withheld)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>20. PPh Pasal 23</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.pph23Withheld)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>21. PPh Pasal 24 (Kredit Pajak Luar Negeri)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.pph24ForeignTaxCredit)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelWide}>22. PPh Pasal 25 (Angsuran)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.pph25Installments)}</Text>
          </View>
          {taxCredits.priorYearOverpayment > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>23. Kelebihan Bayar Tahun Sebelumnya</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.priorYearOverpayment)}</Text>
            </View>
          )}
          <View style={[styles.row, styles.bold]}>
            <Text style={styles.labelWide}>24. Jumlah Kredit Pajak (19+20+21+22+23)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(taxCredits.totalTaxCredits)}</Text>
          </View>
        </View>

        {/* Final Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>RINGKASAN PERHITUNGAN</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>PPh Terutang</Text>
            <Text style={styles.summaryValue}>{formatRupiah(Math.max(0, summary.grossTaxDue))}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kredit Pajak</Text>
            <Text style={styles.summaryValue}>{formatRupiah(summary.totalTaxCredits)}</Text>
          </View>
          <View style={styles.divider} />

          {summary.status === 'KURANG_BAYAR' && (
            <View style={[styles.summaryRow, styles.highlightOrange]}>
              <Text style={styles.summaryLabel}>PPh Kurang Bayar (PPh Pasal 29)</Text>
              <Text style={styles.summaryValue}>{formatRupiah(summary.taxPayable)}</Text>
            </View>
          )}

          {summary.status === 'LEBIH_BAYAR' && (
            <View style={[styles.summaryRow, styles.highlightBlue]}>
              <Text style={styles.summaryLabel}>PPh Lebih Bayar</Text>
              <Text style={styles.summaryValue}>{formatRupiah(summary.taxRefund)}</Text>
            </View>
          )}

          {summary.status === 'NIHIL' && (
            <View style={[styles.summaryRow, styles.highlightGreen]}>
              <Text style={styles.summaryLabel}>PPh Nihil</Text>
              <Text style={styles.summaryValue}>Rp 0</Text>
            </View>
          )}

          <View style={[styles.statusBadge, statusStyles[summary.status]]}>
            <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>
              STATUS: {statusLabels[summary.status]}
            </Text>
          </View>

          {/* PPh 25 for Next Year */}
          {summary.pph25MonthlyInstallment > 0 && (
            <>
              <View style={[styles.divider, { marginTop: 12 }]} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Angsuran PPh Pasal 25 Tahun {taxYear + 1}</Text>
                <Text style={styles.summaryValue}>{formatRupiah(summary.pph25NextYear)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Angsuran Per Bulan</Text>
                <Text style={styles.summaryValue}>{formatRupiah(summary.pph25MonthlyInstallment)}</Text>
              </View>
            </>
          )}

          {/* Effective Tax Rate */}
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.summaryLabel, styles.small]}>Tarif Pajak Efektif</Text>
            <Text style={[styles.summaryValue, styles.small]}>
              {formatPercent(Math.max(0, summary.effectiveTaxRate))}
            </Text>
          </View>
        </View>

        {/* Signature Section */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.signatureBox}>
              <Text>Dibuat oleh,</Text>
              <View style={styles.signatureLine}>
                <Text>(__________________)</Text>
                <Text style={styles.small}>Direktur/Pengurus</Text>
              </View>
            </View>
            <View style={styles.signatureBox}>
              <Text>{company.city || '..........................'},</Text>
              <Text>{formatDate(submissionDate)}</Text>
              <Text style={{ marginTop: 4 }}>Wajib Pajak,</Text>
              <View style={styles.signatureLine}>
                <Text>(__________________)</Text>
                <Text style={styles.small}>Materai Rp 10.000</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.small, { marginTop: 12, textAlign: 'center' }]}>
            Dokumen ini dibuat secara elektronik oleh AI PAJAK - {formatDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Generate PDF buffer for SPT 1771
 */
export async function generateSPT1771PDFBuffer(
  data: SPT1771Data,
  showWatermark: boolean = false
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const element = <SPT1771PDF data={data} showWatermark={showWatermark} />;
  return renderToBuffer(element);
}

export default SPT1771PDF;
