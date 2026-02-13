/**
 * SPT 1770 S PDF Generator
 *
 * Generates PDF document for Indonesian annual tax return (SPT 1770 S)
 * For individuals with gross income >= Rp 60 million or multiple employers
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { SPT1770SData } from './types';
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
  summary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ccc',
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

interface SPT1770SPDFProps {
  data: SPT1770SData;
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
 * SPT 1770 S PDF Document Component
 */
export function SPT1770SPDF({ data, showWatermark = false }: SPT1770SPDFProps) {
  const { taxpayer, ptkpStatus, taxYear, employmentIncome, summary, correctionNumber } = data;

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
            FORMULIR 1770 S
          </Text>
          <Text style={styles.formNumber}>
            (Bagi Wajib Pajak yang mempunyai penghasilan dari pekerjaan dengan
            jumlah bruto lebih dari Rp 60.000.000 atau dari lebih dari satu pemberi kerja)
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

        {/* Section B: Employment Income */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. PENGHASILAN NETO DARI PEKERJAAN</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>1. Penghasilan Bruto dari Pekerjaan</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalEmploymentGrossIncome)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>2. Pengurang (Biaya Jabatan + Iuran Pensiun)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalEmploymentDeductions)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>3. Penghasilan Neto dari Pekerjaan</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalEmploymentNetIncome)}</Text>
          </View>
        </View>

        {/* Section C: Other Income */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. PENGHASILAN NETO LAINNYA</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>4. Penghasilan Neto Lainnya (Bunga, Dividen, dll)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalOtherIncome)}</Text>
          </View>

          {summary.spouseNetIncome > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>5. Penghasilan Neto Istri (Gabung)</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(summary.spouseNetIncome)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>6. Jumlah Penghasilan Neto (3+4+5)</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalNetIncome)}</Text>
          </View>
        </View>

        {/* Section D: PTKP and PKP */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>D. PTKP DAN PKP</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>7. PTKP ({ptkpStatus})</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.ptkpAmount)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>8. Penghasilan Kena Pajak (6-7)</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxableIncome)}</Text>
          </View>
        </View>

        {/* Section E: Tax Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>E. PPh TERUTANG</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>9. PPh Terutang (tarif progresif x PKP)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.taxDue)}</Text>
          </View>
        </View>

        {/* Section F: Tax Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>F. KREDIT PAJAK</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>10. PPh 21 yang telah dipotong</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph21Withheld)}</Text>
          </View>

          {data.taxCredits.pph22Withheld > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>11. PPh 22 yang telah dipungut</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph22Withheld)}</Text>
            </View>
          )}

          {data.taxCredits.pph23Withheld > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>12. PPh 23 yang telah dipotong</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph23Withheld)}</Text>
            </View>
          )}

          {data.taxCredits.pph25Installments > 0 && (
            <View style={styles.row}>
              <Text style={styles.labelWide}>13. PPh 25 yang telah dibayar</Text>
              <Text style={styles.valueNarrow}>{formatRupiah(data.taxCredits.pph25Installments)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>14. Jumlah Kredit Pajak</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalTaxCredits)}</Text>
          </View>
        </View>

        {/* Section G: Final Result */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>G. PPh KURANG/LEBIH BAYAR</Text>

          {summary.status === 'KURANG_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>15. PPh KURANG BAYAR (9 - 14)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxPayable)}</Text>
            </View>
          )}

          {summary.status === 'LEBIH_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>15. PPh LEBIH BAYAR (14 - 9)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxRefund)}</Text>
            </View>
          )}

          {summary.status === 'NIHIL' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>15. PPh NIHIL</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>Rp 0</Text>
            </View>
          )}

          <View style={[styles.statusBadge, statusStyles[summary.status]]}>
            <Text style={styles.bold}>{statusLabels[summary.status]}</Text>
          </View>
        </View>

        <Text style={styles.pageNumber}>Halaman 1 dari 2</Text>
      </Page>

      {/* Page 2: Attachments */}
      <Page size="A4" style={styles.page}>
        {showWatermark && (
          <Text style={styles.watermark}>DRAFT</Text>
        )}

        {/* Employment Income Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LAMPIRAN: DAFTAR BUKTI POTONG PPh 21</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellSmall}>No</Text>
              <Text style={styles.tableCellWide}>Pemberi Kerja</Text>
              <Text style={styles.tableCell}>NPWP</Text>
              <Text style={styles.tableCellNumber}>Bruto</Text>
              <Text style={styles.tableCellNumber}>PPh 21</Text>
            </View>

            {employmentIncome.map((source, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{index + 1}</Text>
                <Text style={styles.tableCellWide}>{source.employerName}</Text>
                <Text style={styles.tableCell}>{source.employerNpwp || '-'}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(source.grossIncome)}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(source.taxWithheld)}</Text>
              </View>
            ))}

            <View style={[styles.tableRow, { backgroundColor: '#f5f5f5' }]}>
              <Text style={styles.tableCellSmall}></Text>
              <Text style={[styles.tableCellWide, styles.bold]}>TOTAL</Text>
              <Text style={styles.tableCell}></Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(summary.totalEmploymentGrossIncome)}
              </Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(data.taxCredits.pph21Withheld)}
              </Text>
            </View>
          </View>
        </View>

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

        <Text style={styles.pageNumber}>Halaman 2 dari 2</Text>
      </Page>
    </Document>
  );
}

/**
 * Generate PDF buffer for SPT 1770 S
 */
export async function generateSPT1770SPDFBuffer(
  data: SPT1770SData,
  showWatermark: boolean = false
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const element = <SPT1770SPDF data={data} showWatermark={showWatermark} />;
  return renderToBuffer(element);
}

export default SPT1770SPDF;
