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
import type { SPTMasaResult, FakturRow } from '../spt-masa-calculator';

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
  subSectionTitle: { fontSize: 9, fontWeight: 'bold', color: '#2b6cb0', marginTop: 8, marginBottom: 4 },
  footnote: { fontSize: 7, color: '#4a5568', marginTop: 8, fontStyle: 'italic' },

  // DJP Form 1111 lampiran (A1/A2/B1) — landscape pages. Keys are prefixed
  // with `lampiran` to avoid colliding with the existing `tableRow` /
  // `tableHeader` keys used by the summary tables above.
  lampiranTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
  lampiranSubtitle: { fontSize: 8, color: '#666', marginBottom: 12 },
  lampiranRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 3,
  },
  lampiranHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  lampiranTotal: {
    backgroundColor: '#fef3c7',
    fontWeight: 'bold',
  },
  lampiranTotalLabel: { fontSize: 8 },
  colNo: { width: '4%', fontSize: 8, textAlign: 'center', paddingHorizontal: 2 },
  colFaktur: { width: '17%', fontSize: 8, paddingHorizontal: 2 },
  colDate: { width: '8%', fontSize: 8, textAlign: 'center', paddingHorizontal: 2 },
  colNpwp: { width: '14%', fontSize: 8, paddingHorizontal: 2 },
  colCounterparty: { width: '21%', fontSize: 8, paddingHorizontal: 2 },
  colAmount: { width: '12%', fontSize: 8, textAlign: 'right', paddingHorizontal: 2 },
});

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }
function pct(n: number) { return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`; }
// Lampiran tables use a tabular plain-number format (no "Rp " prefix) so
// column widths stay tight in the landscape layout.
function fmtPlain(n: number) { return n.toLocaleString('id-ID'); }

/**
 * DJP Form 1111 lampiran table — A1 / A2 / B1.
 * Renders an 8-column table (No / Nomor Faktur / Tanggal / NPWP /
 * Nama Lawan Transaksi / DPP / DPP Nilai Lain / PPN) followed by a
 * TOTAL row tinted amber. `wrap={false}` on each row prevents a single
 * row from being split across pages — react-pdf will move the whole row
 * to the next page if it overflows.
 */
function LampiranSection({ title, rows }: { title: string; rows: FakturRow[] }) {
  const totalDpp = rows.reduce((s, r) => s + r.dpp, 0);
  const totalDppNilaiLain = rows.reduce((s, r) => s + r.dpp_nilai_lain, 0);
  const totalPpn = rows.reduce((s, r) => s + r.ppn, 0);

  return (
    <View>
      <Text style={styles.lampiranTitle}>{title}</Text>
      <Text style={styles.lampiranSubtitle}>{rows.length} faktur</Text>

      {/* Header row */}
      <View style={[styles.lampiranRow, styles.lampiranHeader]} wrap={false}>
        <Text style={styles.colNo}>No.</Text>
        <Text style={styles.colFaktur}>Nomor Faktur</Text>
        <Text style={styles.colDate}>Tanggal</Text>
        <Text style={styles.colNpwp}>NPWP</Text>
        <Text style={styles.colCounterparty}>Nama Lawan Transaksi</Text>
        <Text style={styles.colAmount}>DPP</Text>
        <Text style={styles.colAmount}>DPP Nilai Lain</Text>
        <Text style={styles.colAmount}>PPN</Text>
      </View>

      {/* Data rows */}
      {rows.map((r, i) => (
        <View key={r.id} style={styles.lampiranRow} wrap={false}>
          <Text style={styles.colNo}>{i + 1}</Text>
          <Text style={styles.colFaktur}>{r.faktur_number || '—'}</Text>
          <Text style={styles.colDate}>{r.faktur_date}</Text>
          <Text style={styles.colNpwp}>{r.counterparty_npwp || '—'}</Text>
          <Text style={styles.colCounterparty}>{r.counterparty_name || '—'}</Text>
          <Text style={styles.colAmount}>{fmtPlain(r.dpp)}</Text>
          <Text style={styles.colAmount}>{fmtPlain(r.dpp_nilai_lain)}</Text>
          <Text style={styles.colAmount}>{fmtPlain(r.ppn)}</Text>
        </View>
      ))}

      {/* Total row */}
      <View style={[styles.lampiranRow, styles.lampiranTotal]} wrap={false}>
        <Text style={[styles.colNo, styles.lampiranTotalLabel]}>—</Text>
        <Text style={[styles.colFaktur, styles.lampiranTotalLabel]}>TOTAL ({rows.length} faktur)</Text>
        <Text style={styles.colDate} />
        <Text style={styles.colNpwp} />
        <Text style={styles.colCounterparty} />
        <Text style={styles.colAmount}>{fmtPlain(totalDpp)}</Text>
        <Text style={styles.colAmount}>{fmtPlain(totalDppNilaiLain)}</Text>
        <Text style={styles.colAmount}>{fmtPlain(totalPpn)}</Text>
      </View>
    </View>
  );
}

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

        {/* PPN Detail — PMK 131/2024 split (Phase 3.x).
            `b.splits` is optional so legacy filings still render.            */}
        {sptMasa.tax_type === 'PPN' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>B. RINCIAN PPN</Text>

            {/* B.1 PPN Keluaran (sales) */}
            <Text style={styles.subSectionTitle}>B.1 PPN Keluaran (Penjualan)</Text>
            {b.splits ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Essential ({b.splits.sales_essential.count} faktur)</Text>
                  <Text style={styles.value}>
                    : DPP {fmt(b.splits.sales_essential.total_dpp)} · DPP Nilai Lain {fmt(b.splits.sales_essential.total_dpp_nilai_lain)} · PPN {fmt(b.splits.sales_essential.total_ppn)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Luxury ({b.splits.sales_luxury.count} faktur)</Text>
                  <Text style={styles.value}>
                    : DPP {fmt(b.splits.sales_luxury.total_dpp)} · PPN {fmt(b.splits.sales_luxury.total_ppn)}
                  </Text>
                </View>
              </>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.label}>Total PPN Keluaran</Text>
              <Text style={styles.value}>: {fmt(b.output_tax || 0)} ({b.sales_count || 0} faktur)</Text>
            </View>

            {/* B.2 PPN Masukan (purchases) */}
            <Text style={styles.subSectionTitle}>B.2 PPN Masukan (Pembelian)</Text>
            {b.splits ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Essential ({b.splits.purchase_essential.count} faktur)</Text>
                  <Text style={styles.value}>
                    : DPP {fmt(b.splits.purchase_essential.total_dpp)} · DPP Nilai Lain {fmt(b.splits.purchase_essential.total_dpp_nilai_lain)} · PPN {fmt(b.splits.purchase_essential.total_ppn)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Luxury ({b.splits.purchase_luxury.count} faktur)</Text>
                  <Text style={styles.value}>
                    : DPP {fmt(b.splits.purchase_luxury.total_dpp)} · PPN {fmt(b.splits.purchase_luxury.total_ppn)}
                  </Text>
                </View>
              </>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.label}>Total PPN Masukan</Text>
              <Text style={styles.value}>: {fmt(b.input_tax || 0)} ({b.purchase_count || 0} faktur)</Text>
            </View>

            {/* B.3 Selisih (Net PPN) */}
            <Text style={styles.subSectionTitle}>B.3 Selisih (Net PPN)</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Net PPN</Text>
              <Text style={styles.value}>
                : {fmt(b.net_tax || 0)} {(b.net_tax ?? 0) > 0 ? '(KURANG BAYAR)' : (b.net_tax ?? 0) < 0 ? '(LEBIH BAYAR)' : '(NIHIL)'}
              </Text>
            </View>
            <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>: {b.status || 'NIHIL'}</Text></View>

            {/* Legal basis footnote (PMK 131/2024) */}
            {b.legal_basis && (
              <Text style={styles.footnote}>{b.legal_basis}</Text>
            )}
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

      {/* DJP Form 1111 lampiran (A1/A2/B1) — landscape pages with faktur-
          level detail. Only emitted for PPN filings that include the new
          lampiran shape; legacy filings fall through. A2 is skipped when
          there are no Non-PKP sales to keep the PDF tight. */}
      {sptMasa.tax_type === 'PPN' && b.lampiran && (
        <>
          <Page size="A4" style={styles.page} orientation="landscape">
            <LampiranSection
              title="LAMPIRAN A1 — Daftar Penyerahan Dalam Negeri kepada PKP"
              rows={b.lampiran.a1_pkp_sales}
            />
          </Page>
          {b.lampiran.a2_non_pkp_sales.length > 0 && (
            <Page size="A4" style={styles.page} orientation="landscape">
              <LampiranSection
                title="LAMPIRAN A2 — Daftar Penyerahan Dalam Negeri kepada Non-PKP"
                rows={b.lampiran.a2_non_pkp_sales}
              />
            </Page>
          )}
          <Page size="A4" style={styles.page} orientation="landscape">
            <LampiranSection
              title="LAMPIRAN B1 — Daftar Perolehan BKP/JKP yang Dapat Dikreditkan"
              rows={b.lampiran.b1_input_credit}
            />
          </Page>
        </>
      )}
    </Document>
  );
}

export async function generateSPTMasaPDFBuffer(data: SPTMasaPDFData): Promise<Buffer> {
  return renderToBuffer(<SPTMasaPDFDocument data={data} />);
}
