/**
 * Coretax 작성본 xlsx 생성 (v19 §5).
 *
 * "빈 템플릿"이 아니라 승인완료 데이터(고객 입력 + AI 계산 + 상담원 검토 +
 * 수퍼바이저 승인값)가 채워진 Coretax 입력 준비파일. 4시트:
 *   README / Coretax_Ready / Company_Summary / Tax_Code_Reference
 *
 * Tax_Code_Reference 는 Track B 의 tax_code_rule DB(마스터 편집 가능)를
 * 우선 사용하고, 비어 있으면 정적 KAP/KJS 표로 대체한다.
 */

import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillingTarget } from './board-data';

const STATIC_TAX_CODES = [
  ['PPh 21', '411121', '100', 'Gaji/upah bulanan (TER PMK 168/2023)'],
  ['PPh 22', '411122', '100', 'Impor/pengadaan tertentu'],
  ['PPh 23', '411124', '100', 'Jasa/sewa non-tanah-bangunan 2%'],
  ['PPh 4(2)', '411128', '403', 'Sewa tanah/bangunan 10% (final)'],
  ['PPh Final UMKM', '411128', '420', 'Omzet 0.5% (PP 55/2022)'],
  ['PPh 25', '411126', '100', 'Angsuran bulanan badan'],
  ['PPh 26', '411127', '100', 'Non-residen 20% / P3B'],
  ['PPN', '411211', '100', 'PPN Masa 11%'],
  ['SPT Tahunan Badan', '411126', '200', 'Kurang bayar tahunan'],
] as const;

export async function buildCoretaxWorkbook(
  admin: SupabaseClient,
  targets: BillingTarget[],
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // ── 1. README ────────────────────────────────────────────────
  const readme = [
    ['AI Pajak — Coretax ID Billing 작성본'],
    [],
    ['생성 시각(UTC)', now],
    ['대상 회사 수', targets.length],
    [],
    ['용도', '수퍼바이저 승인완료 데이터 기반의 Coretax 입력 준비값입니다.'],
    ['', 'Coretax(https://coretaxdjp.pajak.go.id/)에 접속해 Coretax_Ready 시트의'],
    ['', '행 단위 값으로 ID Billing 을 발행하세요.'],
    [],
    ['주의', '1) 본 파일은 빈 양식이 아니라 계산 결과가 채워진 작성본입니다.'],
    ['', '2) 고객이 납부하면 NTPN 은 Coretax 에서 자동 생성됩니다 (납부 = 신고).'],
    ['', '3) Coretax 공식 업로드 스펙은 변경될 수 있으므로 발행 전 화면 기준으로 확인하세요.'],
  ];
  const wsReadme = XLSX.utils.aoa_to_sheet(readme);
  wsReadme['!cols'] = [{ wch: 16 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsReadme, 'README');

  // ── 2. Coretax_Ready ─────────────────────────────────────────
  const readyHeader = ['Company', 'NPWP', 'Tax Period', 'Tax Type', 'KAP', 'KJS', 'Tax Base / DPP', 'Rate', 'Tax Amount', 'Customer Email'];
  const readyRows: (string | number | null)[][] = [readyHeader];
  for (const t of targets) {
    for (const item of t.items) {
      readyRows.push([
        t.customer.name, t.customer.npwp ?? '', item.period, item.taxType,
        item.kap, item.kjs, item.taxBase ?? '', item.rateLabel, item.amount,
        t.customer.email ?? '',
      ]);
    }
  }
  const wsReady = XLSX.utils.aoa_to_sheet(readyRows);
  wsReady['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsReady, 'Coretax_Ready');

  // ── 3. Company_Summary ──────────────────────────────────────
  const summaryRows: (string | number)[][] = [['Company', 'NPWP', 'Items', 'Total Tax Amount']];
  for (const t of targets) {
    summaryRows.push([t.customer.name, t.customer.npwp ?? '', t.items.length, t.totalAmount]);
  }
  summaryRows.push(['TOTAL', '', targets.reduce((a, t) => a + t.items.length, 0), targets.reduce((a, t) => a + t.totalAmount, 0)]);
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 8 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Company_Summary');

  // ── 4. Tax_Code_Reference ───────────────────────────────────
  const refRows: (string | number | null)[][] = [['Category / Tax Type', 'Tax Code (KAP-KJS)', 'Rate Rule', 'Condition / Note']];
  const { data: rules } = await admin
    .from('tax_code_rule')
    .select('category, tax_code, rate_rule, condition_text, sort_order')
    .order('sort_order', { ascending: true });
  if (rules && rules.length > 0) {
    for (const r of rules) refRows.push([r.category, r.tax_code, r.rate_rule, r.condition_text]);
  } else {
    for (const r of STATIC_TAX_CODES) refRows.push([r[0], `${r[1]}-${r[2]}`, '', r[3]]);
  }
  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Tax_Code_Reference');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
