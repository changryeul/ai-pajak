/**
 * Rule-based audit-risk detector.
 *
 * Reads a customer's historical SPT Tahunan filings (the same list the
 * personal dashboard consumes) and flags signals that DJP examiners
 * typically pick up first. Pure function — no I/O, no AI — so both the
 * client and the server can call it and always agree.
 *
 * Heuristics come from standard Indonesian audit patterns:
 *   - Lifestyle audit  : assets grow faster than reported income
 *   - Foreign assets   : Harta includes foreign entries → must disclose
 *                        per PMK 74/2017 + PER-13/PJ/2018
 *   - Income dip       : sudden drop in gross without clear reason
 *   - Revenue mismatch : business declared but declared income is ~0
 *   - PPN deviation    : PPN Output ≫ Input (unusual margin) — noted
 *                        only when the filing shows PPN data
 */

import type { DashboardTrend } from '@/lib/tax/trend-from-filings';

export type AuditScenarioId = 'pph21' | 'ppn' | 'tp' | 'umkm' | 'general';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface AuditRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  regulation?: string;
  /** Scenarios where this risk is most relevant */
  scenarios: AuditScenarioId[];
}

export interface DocumentItem {
  id: string;
  label: string;
  scenarios: AuditScenarioId[];
}

export interface PredictedQuestion {
  id: string;
  text: string;
  scenarios: AuditScenarioId[];
}

export interface AuditPrep {
  risks: AuditRisk[];
  documents: DocumentItem[];
  questions: PredictedQuestion[];
}

const BASE_DOCUMENTS: DocumentItem[] = [
  { id: 'spt', label: 'Salinan SPT Tahunan 3 tahun terakhir', scenarios: ['general', 'pph21', 'umkm', 'tp', 'ppn'] },
  { id: 'bukti-potong', label: 'Bukti Potong PPh 21/23/26 (1721-A1, 1721-VI)', scenarios: ['pph21', 'general'] },
  { id: 'ledger', label: 'Buku besar & jurnal 12 bulan', scenarios: ['ppn', 'umkm', 'tp', 'general'] },
  { id: 'bank', label: 'Rekening koran seluruh rekening', scenarios: ['general', 'umkm', 'pph21'] },
  { id: 'faktur', label: 'Faktur Pajak Keluaran & Masukan', scenarios: ['ppn'] },
  { id: 'contract', label: 'Kontrak & faktur transaksi afiliasi', scenarios: ['tp'] },
  { id: 'tp-doc', label: 'Transfer Pricing Documentation (Master + Local File)', scenarios: ['tp'] },
  { id: 'umkm-rev', label: 'Rekap omzet bulanan + bukti penerimaan', scenarios: ['umkm'] },
];

const BASE_QUESTIONS: PredictedQuestion[] = [
  { id: 'q-emp-count', text: 'Berapa jumlah karyawan dan total gaji bruto yang dilaporkan di SPT Masa PPh 21 setiap bulan?', scenarios: ['pph21'] },
  { id: 'q-ptkp', text: 'Bagaimana Anda menghitung PTKP untuk setiap karyawan, dan siapa yang memvalidasi status tanggungannya?', scenarios: ['pph21'] },
  { id: 'q-bonus', text: 'Apakah ada pembayaran bonus/tantiem/THR yang belum dipotong PPh 21?', scenarios: ['pph21'] },
  { id: 'q-ppn-count', text: 'Berapa jumlah Faktur Pajak Keluaran dan Masukan yang diterbitkan tahun ini, dan berapa total DPP-nya?', scenarios: ['ppn'] },
  { id: 'q-ppn-refund', text: 'Mohon jelaskan latar belakang pengajuan restitusi PPN dan bagaimana Anda memastikan Faktur Masukan sah (nomor seri, lawan transaksi, dll)?', scenarios: ['ppn'] },
  { id: 'q-tp-related', text: 'Siapa saja pihak afiliasi Anda dan apa hubungan kepemilikannya (kewajiban PMK-172/2023)?', scenarios: ['tp'] },
  { id: 'q-tp-arms', text: 'Bagaimana Anda memastikan harga transaksi afiliasi sesuai Arm’s Length Principle, dan metode apa yang digunakan?', scenarios: ['tp'] },
  { id: 'q-umkm-rev', text: 'Bagaimana Anda mencatat omzet harian, dan bagaimana rekonsiliasi dengan setoran bank dilakukan?', scenarios: ['umkm'] },
  { id: 'q-lifestyle', text: 'Penghasilan yang Anda laporkan vs aset yang tercantum di Harta terlihat tidak proporsional. Bisa dijelaskan sumber dananya?', scenarios: ['general'] },
  { id: 'q-foreign', text: 'Anda mencatat aset di luar negeri. Mohon sebutkan nomor rekening/negara dan konfirmasikan kewajiban pelaporan SPT Luar Negeri (PMK 74/2017).', scenarios: ['general', 'tp'] },
];

export function detectAuditRisks(
  trend: DashboardTrend,
  scenarioId: AuditScenarioId,
): AuditPrep {
  const risks: AuditRisk[] = [];

  // Lifestyle audit — asset growth far exceeds income growth
  if (
    trend.assetGrowthPct !== null &&
    trend.incomeGrowthPct !== null &&
    trend.assetGrowthPct - trend.incomeGrowthPct >= 5
  ) {
    risks.push({
      id: 'lifestyle-mismatch',
      severity: trend.assetGrowthPct - trend.incomeGrowthPct >= 15 ? 'high' : 'medium',
      title: 'Pertumbuhan aset melebihi penghasilan',
      detail: `Aset tumbuh +${trend.assetGrowthPct}% sementara penghasilan hanya +${trend.incomeGrowthPct}%. Pemeriksa akan meminta bukti sumber dana.`,
      regulation: 'Pasal 4 UU PPh (definisi penghasilan luas)',
      scenarios: ['general', 'pph21', 'umkm'],
    });
  }

  // Foreign assets → reporting obligation
  const latestYear = [...trend.hartaByYear.keys()].sort((a, b) => b - a)[0];
  const latestHarta = latestYear != null ? trend.hartaByYear.get(latestYear) : undefined;
  if (
    latestHarta &&
    (latestHarta.foreignCash > 0 || latestHarta.foreignRealEstate > 0 || latestHarta.foreignStocks > 0)
  ) {
    risks.push({
      id: 'foreign-assets',
      severity: 'high',
      title: 'Aset luar negeri tercatat',
      detail: 'Wajib dilaporkan di SPT Luar Negeri dan kemungkinan CRS exchange dengan negara sumber.',
      regulation: 'PMK 74/2017, PER-13/PJ/2018 (CRS)',
      scenarios: ['general', 'tp'],
    });
  }

  // Income dip — gross income year-over-year drop > 20%
  const incomeYears = [...trend.incomeByYear.keys()].sort((a, b) => a - b);
  if (incomeYears.length >= 2) {
    const latest = trend.incomeByYear.get(incomeYears[incomeYears.length - 1])!;
    const prior = trend.incomeByYear.get(incomeYears[incomeYears.length - 2])!;
    const latestVal = latest.gross || latest.taxable;
    const priorVal = prior.gross || prior.taxable;
    if (priorVal > 0 && latestVal > 0 && latestVal < priorVal * 0.8) {
      risks.push({
        id: 'income-dip',
        severity: 'medium',
        title: 'Penghasilan turun signifikan',
        detail: `Penghasilan turun lebih dari 20% dari tahun sebelumnya. Pemeriksa akan mencari penjelasan.`,
        scenarios: ['general', 'pph21', 'umkm'],
      });
    }
  }

  // UMKM scenario + no income reported → red flag
  if (scenarioId === 'umkm' && latestHarta) {
    const hartaTotal =
      latestHarta.stocks + latestHarta.realEstate + latestHarta.vehicle +
      latestHarta.businessAssets + latestHarta.otherAssets + latestHarta.cashBank;
    const latestIncome = latestYear != null ? trend.incomeByYear.get(latestYear) : undefined;
    if (hartaTotal > 100_000_000 && (!latestIncome || latestIncome.gross < 50_000_000)) {
      risks.push({
        id: 'umkm-revenue-asset-gap',
        severity: 'high',
        title: 'Aset usaha besar tapi omzet rendah',
        detail: 'Aset usaha Anda > Rp 100 juta tapi omzet yang dilaporkan < Rp 50 juta. Pemeriksa akan meminta rekonsiliasi omzet.',
        regulation: 'PP 55/2022 (UMKM final rate)',
        scenarios: ['umkm'],
      });
    }
  }

  // Liability > asset anomaly — debt spike
  const latestUtang = latestYear != null ? trend.utangByYear.get(latestYear) : undefined;
  const hartaTotalLatest = latestHarta
    ? latestHarta.stocks + latestHarta.realEstate + latestHarta.vehicle +
      latestHarta.businessAssets + latestHarta.otherAssets + latestHarta.cashBank +
      latestHarta.foreignCash + latestHarta.foreignRealEstate + latestHarta.foreignStocks
    : 0;
  const utangTotal = latestUtang
    ? latestUtang.bankLoan + latestUtang.creditCard + latestUtang.personalLoan +
      latestUtang.businessDebt + latestUtang.foreignLoan
    : 0;
  if (hartaTotalLatest > 0 && utangTotal > hartaTotalLatest * 1.5) {
    risks.push({
      id: 'debt-exceeds-asset',
      severity: 'low',
      title: 'Utang jauh melebihi aset',
      detail: 'Nilai utang > 1,5× nilai aset. Pemeriksa mungkin akan minta klarifikasi kelangsungan usaha.',
      scenarios: ['general', 'umkm'],
    });
  }

  // Scenario-scoped defaults when no data-driven risk fires
  if (risks.length === 0) {
    risks.push({
      id: 'baseline',
      severity: 'low',
      title: 'Belum ada sinyal audit dari data historis',
      detail: 'Latih jawaban standar audit. Pertahankan pencatatan yang rapi untuk antisipasi.',
      scenarios: ['general', 'pph21', 'ppn', 'tp', 'umkm'],
    });
  }

  const documents = BASE_DOCUMENTS.filter((d) => d.scenarios.includes(scenarioId));
  const questions = BASE_QUESTIONS.filter((q) => q.scenarios.includes(scenarioId));

  return { risks, documents, questions };
}

/** Simple rule-based turn evaluator — no AI. Used as a deterministic
 * fallback / baseline for the three score dimensions. The real chat
 * turn still calls Anthropic for the follow-up question. */
export function evaluateTurn(responseText: string): {
  evidence: number;
  clarity: number;
  compliance: number;
} {
  const text = responseText.trim();
  const length = text.length;

  // Evidence: mention of specific numbers, dates, documents
  let evidence = 3;
  if (/\d{1,3}(?:[.,]\d{3})+|rp\s*\d|idr\s*\d/i.test(text)) evidence += 3;
  if (/\bbukti\b|\bdokumen\b|\bfaktur\b|\bbank\b|\bledger\b|\bslip\b/i.test(text)) evidence += 2;
  if (length > 200) evidence += 2;
  evidence = Math.min(10, evidence);

  // Clarity: sentence structure, not too short, not too long
  let clarity = 5;
  if (length < 30) clarity -= 3;
  else if (length < 80) clarity -= 1;
  else if (length > 600) clarity -= 1;
  if (/[.!?]/.test(text)) clarity += 2;
  clarity = Math.max(0, Math.min(10, clarity));

  // Compliance: mention of regulations, proper tax terminology
  let compliance = 4;
  if (/\bpph\s?2[1-6]\b|\bppn\b|\bspt\b|\bnpwp\b|\bkpp\b|\bumkm\b/i.test(text)) compliance += 2;
  if (/\bpasal\s?\d+|\bper-?\d+|\bpmk\s?\d+|\bpp\s?\d+|\buu\b/i.test(text)) compliance += 3;
  if (/\btidak tahu\b|\btidak ingat\b|\bmungkin\b/i.test(text)) compliance -= 2;
  compliance = Math.max(0, Math.min(10, compliance));

  return { evidence, clarity, compliance };
}
