/**
 * BPE (Bukti Penerimaan Elektronik) PDF Generator
 *
 * Generates PDF document for Electronic Receipt of Tax Filing
 * Uses @react-pdf/renderer for PDF generation
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import {
  BPEData,
  TaxType,
  TAX_TYPE_LABELS,
  FILING_TYPE_LABELS,
} from './types';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    backgroundColor: '#ffffff',
  },
  // Header with border
  headerContainer: {
    borderWidth: 2,
    borderColor: '#1a365d',
    padding: 16,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#1a365d',
  },
  headerSubtitle: {
    fontSize: 9,
    textAlign: 'center',
    color: '#475569',
  },
  // BPE Title
  bpeTitle: {
    textAlign: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#1a365d',
  },
  bpeTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  bpeNumber: {
    fontSize: 11,
    color: '#e2e8f0',
    marginTop: 4,
  },
  // Content sections
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sectionContent: {
    padding: 12,
  },
  // Rows
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  labelColumn: {
    width: '35%',
  },
  valueColumn: {
    width: '65%',
  },
  label: {
    fontSize: 9,
    color: '#64748b',
  },
  value: {
    fontSize: 9,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  // Amount highlight
  amountSection: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 10,
    color: '#166534',
  },
  amountValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  // QR Code
  qrCodeContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  qrCodeImage: {
    width: 80,
    height: 80,
  },
  qrCodePlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeText: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  // Validation
  validationContainer: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginTop: 12,
  },
  validationText: {
    fontSize: 8,
    color: '#92400e',
    textAlign: 'center',
  },
  // Signature
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  signatureBox: {
    width: '45%',
    textAlign: 'center',
  },
  signatureTitle: {
    fontSize: 9,
    marginBottom: 40,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 4,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  signatureRole: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 8,
  },
  // Bold text
  bold: {
    fontWeight: 'bold',
  },
  // Status badge
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 8,
    color: '#166534',
    fontWeight: 'bold',
  },
});

interface BPEPDFProps {
  data: BPEData;
}

/**
 * BPE PDF Document Component
 */
export function BPEPDF({ data }: BPEPDFProps) {
  const {
    bpeNumber,
    filedAt,
    taxpayer,
    taxType,
    taxPeriod,
    taxYear,
    taxSummary,
    submissionDetails,
    taxPartner,
    qrCodeDataUrl,
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>DJP</Text>
              <Text style={styles.logoText}>LOGO</Text>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                KEMENTERIAN KEUANGAN REPUBLIK INDONESIA
              </Text>
              <Text style={styles.headerSubtitle}>
                DIREKTORAT JENDERAL PAJAK
              </Text>
              <Text style={styles.headerSubtitle}>
                www.pajak.go.id
              </Text>
            </View>
          </View>
        </View>

        {/* BPE Title */}
        <View style={styles.bpeTitle}>
          <Text style={styles.bpeTitleText}>
            BUKTI PENERIMAAN ELEKTRONIK
          </Text>
          <Text style={styles.bpeNumber}>
            Nomor: {bpeNumber}
          </Text>
        </View>

        {/* Taxpayer Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>IDENTITAS WAJIB PAJAK</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>NPWP</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{taxpayer.npwp}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Nama Wajib Pajak</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{taxpayer.name}</Text>
              </View>
            </View>
            {taxpayer.companyName && (
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Nama Perusahaan</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{taxpayer.companyName}</Text>
                </View>
              </View>
            )}
            {taxpayer.address && (
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Alamat</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{taxpayer.address}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Tax Filing Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INFORMASI SPT</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Jenis Pajak</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{getTaxTypeLabel(taxType)}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Masa/Tahun Pajak</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>
                  {taxPeriod} / {taxYear}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Jenis SPT</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>
                  {FILING_TYPE_LABELS[submissionDetails.filingType]}
                  {submissionDetails.correctionNumber && submissionDetails.correctionNumber > 0
                    ? ` ke-${submissionDetails.correctionNumber}`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tax Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RINGKASAN PAJAK</Text>
          </View>
          <View style={styles.sectionContent}>
            {taxSummary.totalIncome !== undefined && (
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Penghasilan Bruto</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{formatRupiah(taxSummary.totalIncome)}</Text>
                </View>
              </View>
            )}
            {taxSummary.taxableIncome !== undefined && (
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Penghasilan Kena Pajak</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{formatRupiah(taxSummary.taxableIncome)}</Text>
                </View>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>PPh Terutang</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{formatRupiah(taxSummary.taxDue)}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>PPh yang Telah Dipotong/Dibayar</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{formatRupiah(taxSummary.taxPaid)}</Text>
              </View>
            </View>

            {/* Net amount */}
            <View style={styles.amountSection}>
              {taxSummary.taxPayable !== undefined && taxSummary.taxPayable > 0 ? (
                <View style={styles.amountRow}>
                  <Text style={[styles.amountLabel, { color: '#dc2626' }]}>PPh Kurang Bayar</Text>
                  <Text style={[styles.amountValue, { color: '#dc2626' }]}>
                    {formatRupiah(taxSummary.taxPayable)}
                  </Text>
                </View>
              ) : taxSummary.taxRefund !== undefined && taxSummary.taxRefund > 0 ? (
                <View style={styles.amountRow}>
                  <Text style={[styles.amountLabel, { color: '#2563eb' }]}>PPh Lebih Bayar</Text>
                  <Text style={[styles.amountValue, { color: '#2563eb' }]}>
                    {formatRupiah(taxSummary.taxRefund)}
                  </Text>
                </View>
              ) : (
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Status</Text>
                  <Text style={styles.amountValue}>NIHIL</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Submission Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DETAIL PENYAMPAIAN</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Tanggal Diterima</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{formatDateIndonesian(filedAt)}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Waktu Diterima</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{formatTime(filedAt)} WIB</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Saluran Penyampaian</Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{submissionDetails.submissionChannel}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.labelColumn}>
                <Text style={styles.label}>Status</Text>
              </View>
              <View style={styles.valueColumn}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>DITERIMA</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Tax Partner Info (if applicable) */}
        {taxPartner && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>KUASA WAJIB PAJAK</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Nama Kuasa</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{taxPartner.name}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>NPWP Kuasa</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{taxPartner.npwp}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.labelColumn}>
                  <Text style={styles.label}>Nomor Izin Praktik</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.value}>{taxPartner.licenseNumber}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* QR Code */}
        <View style={styles.qrCodeContainer}>
          {qrCodeDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={qrCodeDataUrl} style={styles.qrCodeImage} />
          ) : (
            <View style={styles.qrCodePlaceholder}>
              <Text style={styles.qrCodeText}>QR Code</Text>
              <Text style={styles.qrCodeText}>Verifikasi</Text>
            </View>
          )}
          <Text style={[styles.qrCodeText, { marginTop: 4 }]}>
            Scan untuk verifikasi keaslian BPE
          </Text>
        </View>

        {/* Validation Note */}
        <View style={styles.validationContainer}>
          <Text style={styles.validationText}>
            Bukti Penerimaan Elektronik ini diterbitkan secara otomatis oleh sistem dan sah tanpa
            tanda tangan basah. Untuk memverifikasi keaslian dokumen ini, silakan scan QR Code di
            atas atau kunjungi www.pajak.go.id/validasi
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Dicetak pada: {formatDateIndonesian(new Date())} {formatTime(new Date())} WIB
            </Text>
            <Text style={styles.footerText}>
              BPE: {bpeNumber}
            </Text>
          </View>
          <Text style={[styles.footerText, { textAlign: 'center', marginTop: 4 }]}>
            Dokumen ini digenerate oleh AI Pajak - www.aipajak.com
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Get tax type label in Indonesian
 */
function getTaxTypeLabel(taxType: TaxType): string {
  return TAX_TYPE_LABELS[taxType] || taxType;
}

/**
 * Format number as Indonesian Rupiah
 */
function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/**
 * Format date to Indonesian format
 */
function formatDateIndonesian(date: Date): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Format time (HH:MM:SS)
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default BPEPDF;
