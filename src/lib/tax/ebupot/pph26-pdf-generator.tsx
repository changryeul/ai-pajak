/**
 * e-Bupot PPh 26 PDF Generator
 *
 * Generates Bukti Potong PPh 26 (Non-Resident Withholding Tax Certificate)
 * Uses @react-pdf/renderer
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
import { formatRupiah, formatPercent } from './pph23-bupot-service';

export interface BupotPPh26Data {
  id: string;
  buktiPotongNumber: string;
  buktiPotongDate: string;
  taxPeriod: string;

  pemotongName: string;
  pemotongNpwp: string;

  recipientName: string;
  recipientCountry: string;
  recipientAddress?: string;

  incomeType: string;
  incomeTypeLabel: string;
  description: string;
  transactionDate: string;
  invoiceNumber?: string;

  grossAmount: number;
  standardRate: number;
  appliedRate: number;
  taxAmount: number;

  treatyApplied: boolean;
  treatyReference?: string;
  hasCod: boolean;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.4 },
  header: { borderWidth: 2, borderColor: '#1a365d', padding: 16, marginBottom: 16, textAlign: 'center' },
  headerTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a365d', marginBottom: 4 },
  headerSubtitle: { fontSize: 10, color: '#4a5568' },
  bupotNumber: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#2d3748' },
  section: { marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a365d', marginBottom: 8 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 150, color: '#4a5568', fontSize: 9 },
  value: { flex: 1, fontWeight: 'bold', fontSize: 9 },
  amountTable: { borderWidth: 1, borderColor: '#cbd5e0', marginTop: 8 },
  amountRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 8 },
  amountRowHighlight: { flexDirection: 'row', padding: 8, backgroundColor: '#ebf8ff' },
  amountLabel: { flex: 2, fontSize: 9 },
  amountValue: { flex: 1, textAlign: 'right', fontFamily: 'Courier', fontSize: 9, fontWeight: 'bold' },
  treatyBadge: { backgroundColor: '#c6f6d5', padding: '2 6', borderRadius: 4, fontSize: 8, color: '#276749', alignSelf: 'flex-start' },
  footer: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between' },
  signatureBlock: { width: 200, textAlign: 'center' },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#2d3748', marginTop: 40, paddingTop: 4 },
  note: { marginTop: 16, fontSize: 7, color: '#718096', fontStyle: 'italic' },
});

function BupotPPh26Document({ data }: { data: BupotPPh26Data }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BUKTI PEMOTONGAN PPh PASAL 26</Text>
          <Text style={styles.headerSubtitle}>(Pajak Penghasilan atas Wajib Pajak Luar Negeri)</Text>
        </View>

        <Text style={styles.bupotNumber}>Nomor: {data.buktiPotongNumber}</Text>

        {/* Pemotong */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. Identitas Pemotong Pajak</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {data.pemotongName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NPWP</Text><Text style={styles.value}>: {data.pemotongNpwp}</Text></View>
        </View>

        {/* Recipient */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Identitas Penerima Penghasilan (Non-Resident)</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {data.recipientName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Negara</Text><Text style={styles.value}>: {data.recipientCountry}</Text></View>
          {data.recipientAddress && <View style={styles.row}><Text style={styles.label}>Alamat</Text><Text style={styles.value}>: {data.recipientAddress}</Text></View>}
          <View style={styles.row}>
            <Text style={styles.label}>SKD (CoD)</Text>
            <Text style={styles.value}>: {data.hasCod ? 'Ada' : 'Tidak Ada'}</Text>
          </View>
        </View>

        {/* Transaction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Rincian Penghasilan dan Pemotongan</Text>
          <View style={styles.row}><Text style={styles.label}>Jenis Penghasilan</Text><Text style={styles.value}>: {data.incomeTypeLabel}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Masa Pajak</Text><Text style={styles.value}>: {data.taxPeriod}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tanggal Transaksi</Text><Text style={styles.value}>: {data.transactionDate}</Text></View>
          {data.invoiceNumber && <View style={styles.row}><Text style={styles.label}>Nomor Invoice</Text><Text style={styles.value}>: {data.invoiceNumber}</Text></View>}

          {data.treatyApplied && (
            <View style={{ ...styles.row, marginTop: 4 }}>
              <Text style={styles.label}>P3B (Tax Treaty)</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.treatyBadge}>Treaty Applied</Text>
                {data.treatyReference && <Text style={{ fontSize: 8, color: '#4a5568', marginTop: 2 }}>{data.treatyReference}</Text>}
              </View>
            </View>
          )}

          <View style={styles.amountTable}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Jumlah Penghasilan Bruto (DPP)</Text>
              <Text style={styles.amountValue}>{formatRupiah(data.grossAmount)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Tarif Standar</Text>
              <Text style={styles.amountValue}>{formatPercent(data.standardRate)}</Text>
            </View>
            {data.treatyApplied && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Tarif P3B (Treaty Rate)</Text>
                <Text style={styles.amountValue}>{formatPercent(data.appliedRate)}</Text>
              </View>
            )}
            <View style={styles.amountRowHighlight}>
              <Text style={{ ...styles.amountLabel, fontWeight: 'bold' }}>PPh 26 yang Dipotong</Text>
              <Text style={{ ...styles.amountValue, fontSize: 11 }}>{formatRupiah(data.taxAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>Penerima Penghasilan</Text>
            <View style={styles.signatureLine}><Text style={{ fontSize: 9 }}>{data.recipientName}</Text></View>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>{data.buktiPotongDate}</Text>
            <Text style={{ fontSize: 9, color: '#4a5568' }}>Pemotong Pajak</Text>
            <View style={styles.signatureLine}><Text style={{ fontSize: 9 }}>{data.pemotongName}</Text></View>
          </View>
        </View>

        <Text style={styles.note}>
          Bukti Pemotongan ini dibuat secara elektronik melalui sistem AI Pajak.
          Dokumen ini sah tanpa tanda tangan basah. Pasal 26 UU PPh, P3B Indonesia.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateBupotPPh26PDF(data: BupotPPh26Data): Promise<Buffer> {
  return renderToBuffer(<BupotPPh26Document data={data} />);
}
