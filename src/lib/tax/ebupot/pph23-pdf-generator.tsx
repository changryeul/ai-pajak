/**
 * e-Bupot PPh 23 PDF Generator
 *
 * Generates Bukti Potong PPh 23 (Withholding Tax Certificate)
 * Uses @react-pdf/renderer for PDF generation
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { BupotPPh23Data } from './pph23-bupot-service';
import { formatRupiah, formatPercent } from './pph23-bupot-service';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    backgroundColor: '#ffffff',
  },
  header: {
    borderWidth: 2,
    borderColor: '#1a365d',
    padding: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#4a5568',
  },
  bupotNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#2d3748',
  },
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 150,
    color: '#4a5568',
    fontSize: 9,
  },
  value: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 9,
  },
  amountTable: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 8,
  },
  amountRowHighlight: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ebf8ff',
  },
  amountLabel: {
    flex: 2,
    fontSize: 9,
  },
  amountValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: 200,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    marginTop: 40,
    paddingTop: 4,
  },
  note: {
    marginTop: 16,
    fontSize: 7,
    color: '#718096',
    fontStyle: 'italic',
  },
});

function BupotPPh23Document({ data }: { data: BupotPPh23Data }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            BUKTI PEMOTONGAN PPh PASAL 23
          </Text>
          <Text style={styles.headerSubtitle}>
            (Sesuai Pasal 23 Undang-Undang Pajak Penghasilan)
          </Text>
        </View>

        {/* Bukti Potong Number */}
        <Text style={styles.bupotNumber}>
          Nomor: {data.buktiPotongNumber}
        </Text>

        {/* Pemotong Pajak (Withholding Agent) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. Identitas Pemotong Pajak</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nama</Text>
            <Text style={styles.value}>: {data.pemotongName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>NPWP</Text>
            <Text style={styles.value}>: {data.pemotongNpwp}</Text>
          </View>
        </View>

        {/* Penerima Penghasilan (Income Recipient) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Identitas Penerima Penghasilan</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nama</Text>
            <Text style={styles.value}>: {data.recipientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>NPWP</Text>
            <Text style={styles.value}>: {data.recipientNpwp || '-'}</Text>
          </View>
          {data.recipientAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Alamat</Text>
              <Text style={styles.value}>: {data.recipientAddress}</Text>
            </View>
          )}
        </View>

        {/* Transaction Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Rincian Penghasilan dan Pemotongan</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Jenis Penghasilan</Text>
            <Text style={styles.value}>: {data.serviceTypeLabel}</Text>
          </View>
          {data.ebupotServiceCode && (
            <View style={styles.row}>
              <Text style={styles.label}>Kode e-Bupot</Text>
              <Text style={styles.value}>: {data.ebupotServiceCode}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Masa Pajak</Text>
            <Text style={styles.value}>: {data.taxPeriod}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal Transaksi</Text>
            <Text style={styles.value}>: {data.transactionDate}</Text>
          </View>
          {data.invoiceNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Nomor Invoice</Text>
              <Text style={styles.value}>: {data.invoiceNumber}</Text>
            </View>
          )}
          {data.description && (
            <View style={styles.row}>
              <Text style={styles.label}>Uraian</Text>
              <Text style={styles.value}>: {data.description}</Text>
            </View>
          )}

          {/* Amount Table */}
          <View style={styles.amountTable}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Jumlah Penghasilan Bruto (DPP)</Text>
              <Text style={styles.amountValue}>{formatRupiah(data.grossAmount)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Tarif ({formatPercent(data.taxRate)})</Text>
              <Text style={styles.amountValue}>{formatPercent(data.taxRate)}</Text>
            </View>
            <View style={styles.amountRowHighlight}>
              <Text style={[styles.amountLabel, { fontWeight: 'bold' }]}>PPh yang Dipotong</Text>
              <Text style={[styles.amountValue, { fontSize: 11 }]}>{formatRupiah(data.taxAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>Penerima Penghasilan</Text>
            <View style={styles.signatureLine}>
              <Text style={{ fontSize: 9 }}>{data.recipientName}</Text>
            </View>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>
              {data.buktiPotongDate}
            </Text>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>Pemotong Pajak</Text>
            <View style={styles.signatureLine}>
              <Text style={{ fontSize: 9 }}>{data.pemotongName}</Text>
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.note}>
          Bukti Pemotongan ini dibuat secara elektronik melalui sistem AI Pajak.
          Dokumen ini sah tanpa tanda tangan basah sesuai ketentuan perpajakan yang berlaku.
          Peraturan: Pasal 23 UU PPh, PMK 141/PMK.03/2015.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Generate e-Bupot PPh 23 PDF buffer
 */
export async function generateBupotPPh23PDF(data: BupotPPh23Data): Promise<Buffer> {
  return renderToBuffer(<BupotPPh23Document data={data} />);
}
