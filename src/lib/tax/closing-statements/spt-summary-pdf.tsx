/**
 * SPT Tahunan summary PDF — produced from the closing wizard.
 *
 * UMKM path: Final Tax 0.5% summary (1771 attachment style — Final Tax block)
 * PPh25 path: SPT 1771 standard summary (PKP × 22% + SME 50% + credits)
 *
 * This is a customer-facing review PDF. The full DJP-prescribed 1771 form
 * is generated in src/lib/tax/spt-1771/pdf-generator.tsx and is filled in
 * later by the operator workflow.
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

export interface SptSummaryPdfData {
  customer: { name: string; npwp: string; address?: string };
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  // PL summary
  pl: {
    sales: number;
    cogs: number;
    salary: number;
    opex: number;
    petty: number;
    deprec: number;
    netIncome: number;
  };
  // Computation
  pkp: number;
  pphBadan: number;
  finalTaxRate?: number;       // UMKM only — e.g. 0.005
  finalTax?: number;            // UMKM only
  smeDiscount?: boolean;        // PPh25 — flag indicating UU PPh 31E was applied
  credits?: { pph22: number; pph23: number; pph24: number; pph25: number };
  settlement?: number;          // PPh25 — refund/payable
  nextYearMonthlyPph25?: number;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { borderWidth: 2, borderColor: '#1a365d', padding: 12, marginBottom: 14, textAlign: 'center' },
  headerTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a365d', marginBottom: 2 },
  headerSubtitle: { fontSize: 9, color: '#4a5568' },
  section: { marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a365d', marginBottom: 6, backgroundColor: '#f7fafc', padding: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 160, color: '#4a5568', fontSize: 8 },
  value: { flex: 1, fontWeight: 'bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  tableCellLabel: { fontSize: 9, color: '#2d3748' },
  tableCellValue: { fontSize: 9, color: '#1a202c', fontFamily: 'Courier', textAlign: 'right' },
  highlightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, marginTop: 5, backgroundColor: '#1a365d' },
  highlightLabel: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  highlightValue: { fontSize: 12, fontWeight: 'bold', fontFamily: 'Courier', color: '#fff', textAlign: 'right' },
  refundRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, marginTop: 5, backgroundColor: '#065f46' },
  payableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, marginTop: 5, backgroundColor: '#9f1239' },
  signature: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '45%', borderWidth: 1, borderColor: '#cbd5e0', padding: 12, height: 100 },
  signatureLabel: { fontSize: 8, color: '#4a5568', marginBottom: 44 },
  signatureLine: { fontSize: 8, color: '#1a202c', borderTopWidth: 0.5, borderTopColor: '#1a202c', paddingTop: 4 },
  footerText: { fontSize: 7, color: '#a0aec0', textAlign: 'center', marginTop: 14 },
});

function fmt(n: number): string {
  return `Rp ${Math.max(0, Math.round(n)).toLocaleString('id-ID')}`;
}

function fmtSigned(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? '−' : ''}Rp ${abs.toLocaleString('id-ID')}`;
}

function SptUmkmDocument({ data }: { data: SptSummaryPdfData }) {
  const { customer, fiscalYear, pl, finalTaxRate = 0.005, finalTax = 0, generatedAt } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SPT TAHUNAN — UMKM (PPh Final 0,5%)</Text>
          <Text style={styles.headerSubtitle}>PP 55/2022 · Lampiran Pelengkap SPT 1771</Text>
          <Text style={styles.headerSubtitle}>Tahun Pajak {fiscalYear}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A. IDENTITAS WAJIB PAJAK</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {customer.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NPWP</Text><Text style={styles.value}>: {customer.npwp}</Text></View>
          {customer.address ? <View style={styles.row}><Text style={styles.label}>Alamat</Text><Text style={styles.value}>: {customer.address}</Text></View> : null}
          <View style={styles.row}><Text style={styles.label}>Tahun Pajak</Text><Text style={styles.value}>: {fiscalYear}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. RINGKASAN OMZET (UMKM)</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Omzet Tahunan</Text><Text style={styles.tableCellValue}>{fmt(pl.sales)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>HPP / Beban (referensi)</Text><Text style={styles.tableCellValue}>{fmt(pl.cogs + pl.salary + pl.opex + pl.petty + pl.deprec)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Laba Bersih (akuntansi)</Text><Text style={styles.tableCellValue}>{fmt(pl.netIncome)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. PERHITUNGAN PPh FINAL UMKM</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Dasar Pengenaan Pajak (Omzet)</Text><Text style={styles.tableCellValue}>{fmt(pl.sales)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Tarif PPh Final</Text><Text style={styles.tableCellValue}>{(finalTaxRate * 100).toFixed(1)}%</Text></View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>PPh FINAL TERUTANG</Text>
            <Text style={styles.highlightValue}>{fmt(finalTax)}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 8, color: '#4a5568' }}>
          PPh Final UMKM disetorkan paling lambat tanggal 15 bulan berikutnya melalui ID Billing.
          Lampiran: Laporan Keuangan tertanda direksi.
        </Text>

        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disusun oleh,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disetujui Direksi,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
        </View>

        <Text style={styles.footerText}>Dibuat: {generatedAt} · AI Pajak — Tutup Buku UMKM</Text>
      </Page>
    </Document>
  );
}

function Spt1771Document({ data }: { data: SptSummaryPdfData }) {
  const {
    customer, fiscalYear, pl, pkp, pphBadan, smeDiscount,
    credits = { pph22: 0, pph23: 0, pph24: 0, pph25: 0 },
    settlement = 0, nextYearMonthlyPph25 = 0, generatedAt,
  } = data;
  const creditTotal = credits.pph22 + credits.pph23 + credits.pph24 + credits.pph25;
  const isRefund = settlement < 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SPT TAHUNAN PPh BADAN — 1771</Text>
          <Text style={styles.headerSubtitle}>UU PPh · Tarif 22% (UU PPh Pasal 17/31E)</Text>
          <Text style={styles.headerSubtitle}>Tahun Pajak {fiscalYear}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A. IDENTITAS WAJIB PAJAK</Text>
          <View style={styles.row}><Text style={styles.label}>Nama</Text><Text style={styles.value}>: {customer.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NPWP</Text><Text style={styles.value}>: {customer.npwp}</Text></View>
          {customer.address ? <View style={styles.row}><Text style={styles.label}>Alamat</Text><Text style={styles.value}>: {customer.address}</Text></View> : null}
          <View style={styles.row}><Text style={styles.label}>Tahun Pajak</Text><Text style={styles.value}>: {fiscalYear}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B. LABA RUGI (akuntansi)</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Penjualan</Text><Text style={styles.tableCellValue}>{fmt(pl.sales)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>HPP</Text><Text style={styles.tableCellValue}>({fmt(pl.cogs)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Gaji</Text><Text style={styles.tableCellValue}>({fmt(pl.salary)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Operasional</Text><Text style={styles.tableCellValue}>({fmt(pl.opex)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Beban Petty Cash</Text><Text style={styles.tableCellValue}>({fmt(pl.petty)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Penyusutan</Text><Text style={styles.tableCellValue}>({fmt(pl.deprec)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Laba Bersih (akuntansi)</Text><Text style={styles.tableCellValue}>{fmt(pl.netIncome)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>C. PENGHITUNGAN PPh BADAN</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Penghasilan Kena Pajak (PKP)</Text><Text style={styles.tableCellValue}>{fmt(pkp)}</Text></View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              PPh Badan 22%
              {smeDiscount ? ' (UU PPh 31E — diskon 50% pada bagian s.d. Rp 4,8B)' : ''}
            </Text>
            <Text style={styles.tableCellValue}>{fmt(pphBadan)}</Text>
          </View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>(−) PPh 22</Text><Text style={styles.tableCellValue}>({fmt(credits.pph22)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>(−) PPh 23</Text><Text style={styles.tableCellValue}>({fmt(credits.pph23)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>(−) PPh 24</Text><Text style={styles.tableCellValue}>({fmt(credits.pph24)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>(−) PPh 25 (angsuran tahun berjalan)</Text><Text style={styles.tableCellValue}>({fmt(credits.pph25)})</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Total Kredit Pajak</Text><Text style={styles.tableCellValue}>({fmt(creditTotal)})</Text></View>

          <View style={isRefund ? styles.refundRow : styles.payableRow}>
            <Text style={styles.highlightLabel}>{isRefund ? 'PPh LEBIH BAYAR (REFUND)' : 'PPh KURANG BAYAR (PPh 29)'}</Text>
            <Text style={styles.highlightValue}>{fmtSigned(settlement)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>D. ANGSURAN PPh 25 TAHUN BERIKUTNYA</Text>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Dasar PPh 25 ({(fiscalYear + 1)})</Text><Text style={styles.tableCellValue}>{fmt(pphBadan - credits.pph22 - credits.pph23 - credits.pph24)}</Text></View>
          <View style={styles.tableRow}><Text style={styles.tableCellLabel}>Bagi 12 bulan</Text><Text style={styles.tableCellValue}>÷ 12</Text></View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>ANGSURAN PPh 25 / BULAN</Text>
            <Text style={styles.highlightValue}>{fmt(nextYearMonthlyPph25)}</Text>
          </View>
        </View>

        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disusun oleh,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Disetujui Direksi,</Text>
            <Text style={styles.signatureLine}>(_____________________)</Text>
          </View>
        </View>

        <Text style={styles.footerText}>Dibuat: {generatedAt} · AI Pajak — Tutup Buku PPh 25</Text>
      </Page>
    </Document>
  );
}

export async function generateSptSummaryPdf(data: SptSummaryPdfData): Promise<Buffer> {
  const element = data.closingType === 'UMKM'
    ? <SptUmkmDocument data={data} />
    : <Spt1771Document data={data} />;
  return renderToBuffer(element);
}
