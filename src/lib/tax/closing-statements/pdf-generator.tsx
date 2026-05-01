/**
 * Annual Closing Financial-Statements PDF Generator
 *
 * Renders the year-end PL + BS produced by the closing wizard so the
 * taxpayer can print, sign, and re-upload as the official signed copy
 * required by Coretax.
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

export interface FinancialStatementsPdfData {
  customer: {
    name: string;
    npwp: string;
    address?: string;
  };
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  pl: {
    sales: number;
    cogs: number;
    salary: number;
    opex: number;
    petty: number;
    deprec: number;
    netIncome: number;
  };
  bs: {
    cash: number;
    ar: number;
    inventory: number;
    fa: number;
    totalAssets: number;
    loan: number;
    capital: number;
    surplus: number;
    retained: number;
    totalLE: number;
  };
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { borderWidth: 2, borderColor: '#1a365d', padding: 14, marginBottom: 14, textAlign: 'center' },
  headerTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a365d', marginBottom: 2 },
  headerSubtitle: { fontSize: 9, color: '#4a5568' },
  section: { marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a365d', marginBottom: 6, backgroundColor: '#f7fafc', padding: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 140, color: '#4a5568', fontSize: 8 },
  value: { flex: 1, fontWeight: 'bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  tableCellLabel: { fontSize: 9, color: '#2d3748' },
  tableCellValue: { fontSize: 9, color: '#1a202c', fontFamily: 'Courier', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1a365d', marginTop: 4 },
  totalLabel: { fontSize: 10, fontWeight: 'bold', color: '#1a365d' },
  totalValue: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Courier', color: '#1a365d', textAlign: 'right' },
  signature: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '45%', borderWidth: 1, borderColor: '#cbd5e0', padding: 14, height: 110 },
  signatureLabel: { fontSize: 8, color: '#4a5568', marginBottom: 50 },
  signatureLine: { fontSize: 8, color: '#1a202c', borderTopWidth: 0.5, borderTopColor: '#1a202c', paddingTop: 4 },
  footerText: { fontSize: 7, color: '#a0aec0', textAlign: 'center', marginTop: 14 },
});

function fmt(n: number): string {
  return `Rp ${Math.max(0, Math.round(n)).toLocaleString('id-ID')}`;
}

function FinancialStatementsDocument({ data }: { data: FinancialStatementsPdfData }) {
  const { customer, fiscalYear, closingType, pl, bs, generatedAt } = data;
  const closingLabel = closingType === 'UMKM' ? 'UMKM (Final 0,5%)' : 'PPh 25 (Badan 22%)';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>LAPORAN KEUANGAN TAHUNAN</Text>
          <Text style={styles.headerSubtitle}>Tutup Buku — {closingLabel}</Text>
          <Text style={styles.headerSubtitle}>Tahun Buku {fiscalYear}</Text>
        </View>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A. IDENTITAS PERUSAHAAN</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {customer.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NPWP</Text><Text style={styles.value}>: {customer.npwp}</Text></View>
          {customer.address ? (
            <View style={styles.row}><Text style={styles.label}>Alamat</Text><Text style={styles.value}>: {customer.address}</Text></View>
          ) : null}
          <View style={styles.row}><Text style={styles.label}>Tahun Buku</Text><Text style={styles.value}>: {fiscalYear}</Text></View>
        </View>

        {/* PL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. LAPORAN LABA RUGI (PL)</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Penjualan / Pendapatan</Text><Text style={styles.tableCellValue}>{fmt(pl.sales)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Harga Pokok Penjualan (HPP)</Text><Text style={styles.tableCellValue}>({fmt(pl.cogs)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Gaji</Text><Text style={styles.tableCellValue}>({fmt(pl.salary)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Operasional</Text><Text style={styles.tableCellValue}>({fmt(pl.opex)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Petty Cash</Text><Text style={styles.tableCellValue}>({fmt(pl.petty)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Penyusutan</Text><Text style={styles.tableCellValue}>({fmt(pl.deprec)})</Text></View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>LABA / RUGI BERSIH</Text>
            <Text style={styles.totalValue}>{fmt(pl.netIncome)}</Text>
          </View>
        </View>

        {/* BS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. NERACA (BS)</Text>
          <Text style={[styles.tableCellLabel, { fontWeight: 'bold', marginBottom: 4 }]}>Aset</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Kas / Bank</Text><Text style={styles.tableCellValue}>{fmt(bs.cash)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Piutang Usaha</Text><Text style={styles.tableCellValue}>{fmt(bs.ar)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Persediaan</Text><Text style={styles.tableCellValue}>{fmt(bs.inventory)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Aset Tetap (Netto)</Text><Text style={styles.tableCellValue}>{fmt(bs.fa)}</Text></View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL ASET</Text>
            <Text style={styles.totalValue}>{fmt(bs.totalAssets)}</Text>
          </View>

          <Text style={[styles.tableCellLabel, { fontWeight: 'bold', marginTop: 10, marginBottom: 4 }]}>Kewajiban & Ekuitas</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Pinjaman</Text><Text style={styles.tableCellValue}>{fmt(bs.loan)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Modal Disetor</Text><Text style={styles.tableCellValue}>{fmt(bs.capital)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Agio / Surplus Modal</Text><Text style={styles.tableCellValue}>{fmt(bs.surplus)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Saldo Laba (Retained Earnings)</Text><Text style={styles.tableCellValue}>{fmt(bs.retained)}</Text></View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL KEWAJIBAN + EKUITAS</Text>
            <Text style={styles.totalValue}>{fmt(bs.totalLE)}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disusun oleh,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disetujui oleh Direksi,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
        </View>

        <Text style={styles.footerText}>Dibuat: {generatedAt} · AI Pajak — Tutup Buku Wizard</Text>
      </Page>
    </Document>
  );
}

export async function generateFinancialStatementsPdf(
  data: FinancialStatementsPdfData
): Promise<Buffer> {
  return renderToBuffer(<FinancialStatementsDocument data={data} />);
}
