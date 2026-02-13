/**
 * SPT 1770 PDF Generator
 *
 * Generates PDF document for Indonesian annual tax return (SPT 1770)
 * For individuals with business/professional income
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { SPT1770Data } from './types';
import { formatRupiah, formatNumber } from '../shared/tax-utils';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
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
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '50%',
    paddingRight: 8,
  },
  value: {
    width: '50%',
    textAlign: 'right',
  },
  labelWide: {
    width: '65%',
    paddingRight: 8,
  },
  valueNarrow: {
    width: '35%',
    textAlign: 'right',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginVertical: 8,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    padding: 4,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  tableCellSmall: {
    width: 30,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellWide: {
    flex: 2,
    fontSize: 9,
  },
  tableCellNumber: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },
  highlight: {
    backgroundColor: '#fffde7',
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    textAlign: 'center',
    paddingTop: 40,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 40,
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
    padding: '4 12',
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
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
    fontSize: 8,
    color: '#666',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 8,
    color: '#666',
  },
});

interface SPT1770PDFProps {
  data: SPT1770Data;
  showWatermark?: boolean;
}

/**
 * Format date to Indonesian format
 */
function formatDate(date: Date): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Get PTKP description
 */
function getPTKPDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'TK/0': 'Tidak Kawin, 0 Tanggungan',
    'TK/1': 'Tidak Kawin, 1 Tanggungan',
    'TK/2': 'Tidak Kawin, 2 Tanggungan',
    'TK/3': 'Tidak Kawin, 3 Tanggungan',
    'K/0': 'Kawin, 0 Tanggungan',
    'K/1': 'Kawin, 1 Tanggungan',
    'K/2': 'Kawin, 2 Tanggungan',
    'K/3': 'Kawin, 3 Tanggungan',
    'K/I/0': 'Kawin + Istri Gabung, 0 Tanggungan',
    'K/I/1': 'Kawin + Istri Gabung, 1 Tanggungan',
    'K/I/2': 'Kawin + Istri Gabung, 2 Tanggungan',
    'K/I/3': 'Kawin + Istri Gabung, 3 Tanggungan',
  };
  return descriptions[status] || status;
}

/**
 * SPT 1770 PDF Document Component
 */
export function SPT1770PDF({ data, showWatermark = false }: SPT1770PDFProps) {
  const { taxpayer, ptkpStatus, taxYear, businessIncome, summary, correctionNumber } = data;

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
        {showWatermark && (
          <Text style={styles.watermark}>DRAFT</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            SURAT PEMBERITAHUAN (SPT) TAHUNAN
          </Text>
          <Text style={styles.subtitle}>
            PAJAK PENGHASILAN WAJIB PAJAK ORANG PRIBADI
          </Text>
          <Text style={styles.subtitle}>
            FORMULIR 1770
          </Text>
          <Text style={styles.formNumber}>
            (Bagi Wajib Pajak yang mempunyai penghasilan dari usaha/pekerjaan bebas)
          </Text>
          <Text style={[styles.formNumber, { marginTop: 8 }]}>
            TAHUN PAJAK {taxYear}
            {correctionNumber > 0 ? ` - PEMBETULAN KE-${correctionNumber}` : ''}
          </Text>
        </View>

        {/* Section A: Identitas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A. IDENTITAS WAJIB PAJAK</Text>

          <View style={styles.row}>
            <Text style={styles.label}>1. NPWP</Text>
            <Text style={styles.value}>{taxpayer.npwp}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>2. NIK</Text>
            <Text style={styles.value}>{taxpayer.nik || '-'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>3. Nama Wajib Pajak</Text>
            <Text style={styles.value}>{taxpayer.name}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>4. Alamat</Text>
            <Text style={styles.value}>{taxpayer.address || '-'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>5. Status PTKP</Text>
            <Text style={styles.value}>
              {ptkpStatus} ({getPTKPDescription(ptkpStatus)})
            </Text>
          </View>
        </View>

        {/* Section B: Business Income */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. PENGHASILAN NETO DARI USAHA/PEKERJAAN BEBAS</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>1. Peredaran Bruto dari Usaha</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalBusinessRevenue)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>2. Harga Pokok Penjualan</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalBusinessCOGS)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>3. Biaya Usaha</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalBusinessExpenses)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>4. Penyusutan</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalBusinessDepreciation)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>5. Penghasilan Neto dari Usaha</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalNetBusinessIncome)}</Text>
          </View>
        </View>

        {/* Section C: Employment Income */}
        {summary.totalEmploymentIncome > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>C. PENGHASILAN NETO DARI PEKERJAAN</Text>

            <View style={styles.row}>
              <Text style={styles.labelWide}>6. Penghasilan Neto dari Pekerjaan</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(summary.totalEmploymentIncome)}</Text>
            </View>
          </View>
        )}

        {/* Section D: Other Income */}
        {summary.totalOtherIncome > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>D. PENGHASILAN NETO LAINNYA</Text>

            <View style={styles.row}>
              <Text style={styles.labelWide}>7. Penghasilan Neto Lainnya</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(summary.totalOtherIncome)}</Text>
            </View>
          </View>
        )}

        {/* Section E: Total Income */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>E. JUMLAH PENGHASILAN NETO</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>8. Jumlah Penghasilan Neto (5+6+7)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.grossTotalIncome)}</Text>
          </View>

          {summary.lossCarryforwardUsed > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>9. Kompensasi Kerugian</Text>
              <Text style={styles.valueNarrow}>({formatRupiah(summary.lossCarryforwardUsed)})</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>10. Penghasilan Neto Setelah Kompensasi</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalNetIncome)}</Text>
          </View>
        </View>

        {/* Section F: PTKP and PKP */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>F. PTKP DAN PKP</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>11. PTKP ({ptkpStatus})</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.ptkpAmount)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>12. Penghasilan Kena Pajak (10-11)</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxableIncome)}</Text>
          </View>
        </View>

        <Text style={styles.pageNumber}>Halaman 1 dari 3</Text>
      </Page>

      {/* Page 2: Tax Calculation */}
      <Page size="A4" style={styles.page}>
        {showWatermark && (
          <Text style={styles.watermark}>DRAFT</Text>
        )}

        {/* Section G: Tax Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>G. PPh TERUTANG</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>13. PPh Terutang (tarif progresif x PKP)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.taxDue)}</Text>
          </View>
        </View>

        {/* Section H: Tax Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>H. KREDIT PAJAK</Text>

          {data.taxCredits.pph21Withheld > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>14. PPh 21 yang telah dipotong</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph21Withheld)}</Text>
            </View>
          )}

          {data.taxCredits.pph22Withheld > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>15. PPh 22 yang telah dipungut</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph22Withheld)}</Text>
            </View>
          )}

          {data.taxCredits.pph23Withheld > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>16. PPh 23 yang telah dipotong</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph23Withheld)}</Text>
            </View>
          )}

          {data.taxCredits.pph24ForeignTaxCredit > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>17. PPh 24 Kredit Pajak Luar Negeri</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph24ForeignTaxCredit)}</Text>
            </View>
          )}

          {data.taxCredits.pph25Installments > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>18. PPh 25 yang telah dibayar</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph25Installments)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>19. Jumlah Kredit Pajak</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalTaxCredits)}</Text>
          </View>
        </View>

        {/* Section I: Final Result */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. PPh KURANG/LEBIH BAYAR</Text>

          {summary.status === 'KURANG_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>20. PPh KURANG BAYAR (13 - 19)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxPayable)}</Text>
            </View>
          )}

          {summary.status === 'LEBIH_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>20. PPh LEBIH BAYAR (19 - 13)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxRefund)}</Text>
            </View>
          )}

          {summary.status === 'NIHIL' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>20. PPh NIHIL</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>Rp 0</Text>
            </View>
          )}

          <View style={[styles.statusBadge, statusStyles[summary.status]]}>
            <Text style={styles.bold}>{statusLabels[summary.status]}</Text>
          </View>
        </View>

        {/* Section J: PPh 25 Installments */}
        {summary.pph25NextYear > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>J. ANGSURAN PPh 25 TAHUN BERIKUTNYA</Text>

            <View style={styles.row}>
              <Text style={styles.labelWide}>21. PPh 25 Tahun {taxYear + 1}</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(summary.pph25NextYear)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.labelWide}>22. Angsuran Bulanan (21 / 12)</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(summary.pph25MonthlyInstallment)}</Text>
            </View>
          </View>
        )}

        {/* Tax Bracket Breakdown */}
        {summary.taxBreakdown && summary.taxBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RINCIAN PERHITUNGAN PAJAK PROGRESIF</Text>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellSmall}>Lap</Text>
                <Text style={styles.tableCell}>Batas Bawah</Text>
                <Text style={styles.tableCell}>Batas Atas</Text>
                <Text style={styles.tableCellSmall}>Tarif</Text>
                <Text style={styles.tableCellNumber}>PKP</Text>
                <Text style={styles.tableCellNumber}>PPh</Text>
              </View>

              {summary.taxBreakdown.map((bracket, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall}>{bracket.bracketNumber}</Text>
                  <Text style={styles.tableCell}>{formatNumber(bracket.lowerLimit)}</Text>
                  <Text style={styles.tableCell}>
                    {bracket.upperLimit === Infinity ? '...' : formatNumber(bracket.upperLimit)}
                  </Text>
                  <Text style={styles.tableCellSmall}>{(bracket.rate * 100).toFixed(0)}%</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(bracket.taxableAmount)}</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(bracket.taxAmount)}</Text>
                </View>
              ))}

              <View style={[styles.tableRow, { backgroundColor: '#f5f5f5' }]}>
                <Text style={styles.tableCellSmall}></Text>
                <Text style={[styles.tableCell, styles.bold]}>TOTAL</Text>
                <Text style={styles.tableCell}></Text>
                <Text style={styles.tableCellSmall}></Text>
                <Text style={[styles.tableCellNumber, styles.bold]}>
                  {formatNumber(summary.taxableIncome)}
                </Text>
                <Text style={[styles.tableCellNumber, styles.bold]}>
                  {formatNumber(summary.taxDue)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.pageNumber}>Halaman 2 dari 3</Text>
      </Page>

      {/* Page 3: Business Income Details */}
      <Page size="A4" style={styles.page}>
        {showWatermark && (
          <Text style={styles.watermark}>DRAFT</Text>
        )}

        {/* Business Income Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LAMPIRAN I: DAFTAR PENGHASILAN DARI USAHA</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellSmall}>No</Text>
              <Text style={styles.tableCellWide}>Nama Usaha</Text>
              <Text style={styles.tableCell}>KLU</Text>
              <Text style={styles.tableCell}>Metode</Text>
              <Text style={styles.tableCellNumber}>Peredaran</Text>
              <Text style={styles.tableCellNumber}>Neto</Text>
            </View>

            {businessIncome.map((business, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{index + 1}</Text>
                <Text style={styles.tableCellWide}>{business.businessName}</Text>
                <Text style={styles.tableCell}>{business.kluCode}</Text>
                <Text style={styles.tableCell}>{business.bookkeepingMethod}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(business.grossRevenue)}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(business.netBusinessIncome)}</Text>
              </View>
            ))}

            <View style={[styles.tableRow, { backgroundColor: '#f5f5f5' }]}>
              <Text style={styles.tableCellSmall}></Text>
              <Text style={[styles.tableCellWide, styles.bold]}>TOTAL</Text>
              <Text style={styles.tableCell}></Text>
              <Text style={styles.tableCell}></Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(summary.totalBusinessRevenue)}
              </Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(summary.totalNetBusinessIncome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Loss Carryforward */}
        {data.lossCarryforward && data.lossCarryforward.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KOMPENSASI KERUGIAN</Text>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellSmall}>Tahun</Text>
                <Text style={styles.tableCellNumber}>Kerugian Awal</Text>
                <Text style={styles.tableCellNumber}>Telah Dikompensasi</Text>
                <Text style={styles.tableCellNumber}>Dikompensasi Tahun Ini</Text>
                <Text style={styles.tableCellNumber}>Sisa</Text>
              </View>

              {data.lossCarryforward.map((loss, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall}>{loss.taxYear}</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(loss.originalLoss)}</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(loss.previouslyUsed)}</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(loss.usedThisYear)}</Text>
                  <Text style={styles.tableCellNumber}>{formatNumber(loss.remaining)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Signature */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={{ width: '45%' }}>
              <Text style={styles.small}>
                Batas waktu penyampaian: 31 Maret {taxYear + 1}
              </Text>
            </View>

            <View style={styles.signatureBox}>
              <Text>Dinyatakan dengan sebenarnya,</Text>
              <Text style={{ marginTop: 4 }}>
                {formatDate(data.submissionDate)}
              </Text>
              <View style={styles.signatureLine}>
                <Text style={styles.bold}>{taxpayer.name}</Text>
                <Text style={styles.small}>NPWP: {taxpayer.npwp}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.pageNumber}>Halaman 3 dari 3</Text>
      </Page>
    </Document>
  );
}

/**
 * Generate PDF buffer for SPT 1770
 */
export async function generateSPT1770PDFBuffer(
  data: SPT1770Data,
  showWatermark: boolean = false
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const element = <SPT1770PDF data={data} showWatermark={showWatermark} />;
  return renderToBuffer(element);
}

export default SPT1770PDF;
