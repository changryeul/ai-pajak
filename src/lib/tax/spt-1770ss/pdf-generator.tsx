/**
 * SPT 1770 SS PDF Generator
 *
 * Generates PDF document for Indonesian simplified annual tax return
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
import {
  SPT1770SSData,
  getSPTDeadline,
  isSPTLate,
} from './types';
import {
  formatRupiah,
  formatNumber,
  getPTKPDescription,
} from './calculator';

// Register fonts (optional - using default for now)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
// });

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
    width: 40,
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
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 4,
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
});

interface SPT1770SSPDFProps {
  data: SPT1770SSData;
  showWatermark?: boolean;
}

/**
 * SPT 1770 SS PDF Document Component
 */
export function SPT1770SSPDF({ data, showWatermark = false }: SPT1770SSPDFProps) {
  const { taxpayer, ptkpStatus, taxYear, incomeSources, summary, correctionNumber } = data;
  const deadline = getSPTDeadline(taxYear);
  const isLate = isSPTLate(taxYear, data.submissionDate);

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
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
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
            FORMULIR 1770 SS
          </Text>
          <Text style={styles.formNumber}>
            (Bagi Wajib Pajak yang mempunyai penghasilan dari satu pemberi kerja
            dengan jumlah bruto tidak lebih dari Rp 60.000.000 setahun)
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
            <Text style={styles.label}>5. Pekerjaan</Text>
            <Text style={styles.value}>{taxpayer.occupation || 'Karyawan'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>6. Status PTKP</Text>
            <Text style={styles.value}>
              {ptkpStatus} ({getPTKPDescription(ptkpStatus)})
            </Text>
          </View>
        </View>

        {/* Section B: Penghasilan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. PENGHASILAN</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>1. Penghasilan Bruto (dalam setahun)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalGrossIncome)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>2. Pengurang (Biaya Jabatan + Iuran Pensiun)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalDeductions)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>3. Penghasilan Neto (1 - 2)</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.totalNetIncome)}</Text>
          </View>
        </View>

        {/* Section C: PTKP dan PKP */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. PTKP DAN PKP</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>4. PTKP ({ptkpStatus})</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.ptkpAmount)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.labelWide, styles.bold]}>5. Penghasilan Kena Pajak / PKP (3 - 4)</Text>
            <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxableIncome)}</Text>
          </View>
        </View>

        {/* Section D: Pajak */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>D. PAJAK PENGHASILAN</Text>

          <View style={styles.row}>
            <Text style={styles.labelWide}>6. PPh Terutang (tarif progresif x PKP)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.taxDue)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.labelWide}>7. PPh yang telah dipotong (dari Bukti Potong)</Text>
            <Text style={styles.valueNarrow}>{formatRupiah(summary.totalTaxWithheld)}</Text>
          </View>

          <View style={styles.divider} />

          {summary.status === 'KURANG_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>8. PPh KURANG BAYAR (6 - 7)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxPayable)}</Text>
            </View>
          )}

          {summary.status === 'LEBIH_BAYAR' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>8. PPh LEBIH BAYAR (7 - 6)</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>{formatRupiah(summary.taxRefund)}</Text>
            </View>
          )}

          {summary.status === 'NIHIL' && (
            <View style={[styles.row, styles.highlight]}>
              <Text style={[styles.labelWide, styles.bold]}>8. PPh NIHIL</Text>
              <Text style={[styles.valueNarrow, styles.bold]}>Rp 0</Text>
            </View>
          )}

          <View style={[styles.statusBadge, statusStyles[summary.status]]}>
            <Text style={styles.bold}>{statusLabels[summary.status]}</Text>
          </View>
        </View>

        {/* Section E: Daftar Bukti Potong */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>E. DAFTAR BUKTI POTONG</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellSmall}>No</Text>
              <Text style={styles.tableCell}>No. Bukti Potong</Text>
              <Text style={styles.tableCellWide}>Pemberi Kerja</Text>
              <Text style={styles.tableCellNumber}>Penghasilan</Text>
              <Text style={styles.tableCellNumber}>PPh Dipotong</Text>
            </View>

            {incomeSources.map((source, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{index + 1}</Text>
                <Text style={styles.tableCell}>{source.buktiPotongNumber || '-'}</Text>
                <Text style={styles.tableCellWide}>{source.employerName}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(source.grossIncome)}</Text>
                <Text style={styles.tableCellNumber}>{formatNumber(source.taxWithheld)}</Text>
              </View>
            ))}

            <View style={[styles.tableRow, { backgroundColor: '#f5f5f5' }]}>
              <Text style={styles.tableCellSmall}></Text>
              <Text style={[styles.tableCell, styles.bold]}>TOTAL</Text>
              <Text style={styles.tableCellWide}></Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(summary.totalGrossIncome)}
              </Text>
              <Text style={[styles.tableCellNumber, styles.bold]}>
                {formatNumber(summary.totalTaxWithheld)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer / Signature */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={{ width: '45%' }}>
              <Text style={styles.small}>
                Batas waktu penyampaian: {formatDate(deadline)}
              </Text>
              {isLate && (
                <Text style={[styles.small, { color: 'red' }]}>
                  (TERLAMBAT)
                </Text>
              )}
            </View>

            <View style={styles.signatureBox}>
              <Text>
                Dinyatakan dengan sebenarnya,
              </Text>
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
      </Page>
    </Document>
  );
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

export default SPT1770SSPDF;
