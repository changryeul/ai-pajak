/**
 * SPT Masa PDF Generator
 *
 * Generates SPT Masa (Monthly Tax Return) preview PDF
 * Supports PPh21, PPh23, PPh4(2), and PPN
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
import type { SPTMasaResult } from '../spt-masa-calculator';

export interface SPTMasaPDFData {
  sptMasa: SPTMasaResult;
  customer: {
    name: string;
    npwp: string;
    address?: string;
  };
  preparedBy?: string;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { borderWidth: 2, borderColor: '#1a365d', padding: 14, marginBottom: 14, textAlign: 'center' },
  headerTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a365d', marginBottom: 2 },
  headerSubtitle: { fontSize: 9, color: '#4a5568' },
  section: { marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: '#1a365d', marginBottom: 6, backgroundColor: '#f7fafc', padding: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 140, color: '#4a5568', fontSize: 8 },
  value: { flex: 1, fontWeight: 'bold', fontSize: 8 },
  table: { borderWidth: 1, borderColor: '#cbd5e0', marginTop: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#edf2f7', borderBottomWidth: 1, borderBottomColor: '#cbd5e0', padding: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 5 },
  tableCell: { fontSize: 7 },
  tableCellRight: { fontSize: 7, textAlign: 'right', fontFamily: 'Courier' },
  summaryBox: { backgroundColor: '#ebf8ff', borderWidth: 1, borderColor: '#90cdf4', padding: 10, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 9, color: '#2b6cb0' },
  summaryValue: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Courier', color: '#1a365d' },
  footer: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
  footerText: { fontSize: 7, color: '#a0aec0' },
});

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }
function pct(n: number) { return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`; }

function SPTMasaPDFDocument({ data }: { data: SPTMasaPDFData }) {
  const { sptMasa, customer } = data;
  const b = sptMasa.breakdown;

  const taxTypeLabels: Record<string, string> = {
    PPh21: 'PPh Pasal 21 — Pajak Penghasilan Karyawan',
    PPh23: 'PPh Pasal 23 — Pajak Pemotongan Jasa',
    PPh4_2: 'PPh Pasal 4(2) — Pajak Final',
    PPN: 'PPN — Pajak Pertambahan Nilai',
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SPT MASA {sptMasa.tax_type}</Text>
          <Text style={styles.headerSubtitle}>{taxTypeLabels[sptMasa.tax_type] || sptMasa.tax_type}</Text>
          <Text style={styles.headerSubtitle}>Masa Pajak: {sptMasa.period}</Text>
        </View>

        {/* Taxpayer Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A. IDENTITAS WAJIB PAJAK</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {customer.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NPWP</Text><Text style={styles.value}>: {customer.npwp}</Text></View>
          {customer.address && <View style={styles.row}><Text style={styles.label}>Alamat</Text><Text style={styles.value}>: {customer.address}</Text></View>}
          <View style={styles.row}><Text style={styles.label}>Masa Pajak</Text><Text style={styles.value}>: {sptMasa.period}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Batas Pelaporan</Text><Text style={styles.value}>: {new Date(sptMasa.submission_deadline).toLocaleDateString('id-ID')}</Text></View>
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Penghasilan Bruto</Text>
            <Text style={styles.summaryValue}>{fmt(sptMasa.total_gross_income)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Pajak Dipotong/Dipungut</Text>
            <Text style={styles.summaryValue}>{fmt(sptMasa.total_tax_withheld)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pajak yang Harus Disetor</Text>
            <Text style={{ ...styles.summaryValue, fontSize: 13 }}>{fmt(sptMasa.total_net_payable)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Jumlah Item</Text>
            <Text style={styles.summaryValue}>{sptMasa.item_count}</Text>
          </View>
        </View>

        {/* PPh21 Detail */}
        {sptMasa.tax_type === 'PPh21' && b.employee_details && b.employee_details.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>B. RINCIAN PEMOTONGAN PPh 21</Text>
            <View style={styles.row}><Text style={styles.label}>Jumlah Karyawan</Text><Text style={styles.value}>: {b.employee_count}</Text></View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCell, width: 30 }}>No</Text>
                <Text style={{ ...styles.tableCell, flex: 2 }}>Nama</Text>
                <Text style={{ ...styles.tableCell, flex: 1 }}>NPWP</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>Bruto</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>PPh 21</Text>
              </View>
              {b.employee_details.slice(0, 30).map((emp, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, width: 30 }}>{i + 1}</Text>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{emp.employee_name}</Text>
                  <Text style={{ ...styles.tableCell, flex: 1 }}>{emp.employee_npwp || '-'}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(emp.gross_income)}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(emp.tax_withheld)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PPh23 Detail */}
        {sptMasa.tax_type === 'PPh23' && b.transaction_details && b.transaction_details.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>B. RINCIAN PEMOTONGAN PPh 23</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCell, width: 25 }}>No</Text>
                <Text style={{ ...styles.tableCell, flex: 1 }}>Jenis</Text>
                <Text style={{ ...styles.tableCell, flex: 2 }}>Penerima</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>Bruto</Text>
                <Text style={{ ...styles.tableCellRight, width: 40 }}>Tarif</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>PPh 23</Text>
              </View>
              {b.transaction_details.slice(0, 30).map((tx, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, width: 25 }}>{i + 1}</Text>
                  <Text style={{ ...styles.tableCell, flex: 1 }}>{tx.transaction_type}</Text>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{tx.recipient_name}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(tx.gross_amount)}</Text>
                  <Text style={{ ...styles.tableCellRight, width: 40 }}>{pct(tx.tax_rate)}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(tx.tax_withheld)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PPh4(2) Detail */}
        {sptMasa.tax_type === 'PPh4_2' && b.final_tax_details && b.final_tax_details.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>B. RINCIAN PAJAK FINAL PPh 4(2)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCell, width: 25 }}>No</Text>
                <Text style={{ ...styles.tableCell, flex: 1 }}>Jenis</Text>
                <Text style={{ ...styles.tableCell, flex: 2 }}>Lawan Transaksi</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>Bruto</Text>
                <Text style={{ ...styles.tableCellRight, width: 40 }}>Tarif</Text>
                <Text style={{ ...styles.tableCellRight, flex: 1 }}>Pajak</Text>
              </View>
              {b.final_tax_details.slice(0, 30).map((tx, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, width: 25 }}>{i + 1}</Text>
                  <Text style={{ ...styles.tableCell, flex: 1 }}>{tx.income_type}</Text>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{tx.counterparty_name}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(tx.gross_amount)}</Text>
                  <Text style={{ ...styles.tableCellRight, width: 40 }}>{pct(tx.tax_rate)}</Text>
                  <Text style={{ ...styles.tableCellRight, flex: 1 }}>{fmt(tx.tax_withheld)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PPN Detail */}
        {sptMasa.tax_type === 'PPN' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>B. RINCIAN PPN</Text>
            <View style={styles.row}><Text style={styles.label}>PPN Keluaran (Penjualan)</Text><Text style={styles.value}>: {fmt(b.output_tax || 0)} ({b.sales_count || 0} faktur)</Text></View>
            <View style={styles.row}><Text style={styles.label}>PPN Masukan (Pembelian)</Text><Text style={styles.value}>: {fmt(b.input_tax || 0)} ({b.purchase_count || 0} faktur)</Text></View>
            <View style={styles.row}><Text style={styles.label}>Selisih (Net PPN)</Text><Text style={styles.value}>: {fmt(b.net_tax || 0)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>: {b.status || 'NIHIL'}</Text></View>
          </View>
        )}

        {/* Legal Basis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. DASAR HUKUM</Text>
          <Text style={{ fontSize: 8, color: '#4a5568' }}>{sptMasa.legal_basis}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Dokumen ini dihasilkan secara otomatis oleh sistem AI Pajak.</Text>
          <Text style={styles.footerText}>Tanggal cetak: {data.generatedAt}</Text>
          {data.preparedBy && <Text style={styles.footerText}>Disiapkan oleh: {data.preparedBy}</Text>}
          <Text style={styles.footerText}>Dokumen ini merupakan DRAFT dan belum dilaporkan ke DJP.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateSPTMasaPDFBuffer(data: SPTMasaPDFData): Promise<Buffer> {
  return renderToBuffer(<SPTMasaPDFDocument data={data} />);
}
