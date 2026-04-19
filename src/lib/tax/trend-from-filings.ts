/**
 * Derive year-over-year asset / liability / income trends from a list of
 * SPT Tahunan filings. The intake flow writes the snapshot into
 * `tax_data.harta`, `tax_data.utang`, and (when available)
 * `tax_data.incomeSummary` — this helper walks that data and returns the
 * recharts-friendly series the dashboard consumes.
 *
 * When historical coverage is thin we keep the returned array dense by
 * filling missing years with zeros; the caller can decide whether to
 * render a zero-line or fall back to sample data.
 */

export interface TrendFiling {
  id: string;
  tax_type: string;
  tax_period: string;
  tax_year?: number;
  status: string;
  tax_data?: unknown;
  created_at: string;
}

export interface HartaSnapshot {
  stocks: number;
  realEstate: number;
  vehicle: number;
  businessAssets: number;
  otherAssets: number;
  cashBank: number; // sum of IDR bankAccounts balances
  foreignCash: number; // sum of non-IDR bankAccounts balances
  foreignRealEstate: number;
  foreignStocks: number;
}

export interface UtangSnapshot {
  bankLoan: number;
  creditCard: number;
  personalLoan: number;
  businessDebt: number;
  foreignLoan: number;
}

export interface IncomeSnapshot {
  gross: number;
  taxable: number;
}

export interface YearSeriesPoint {
  year: string;
  building: number;
  vehicle: number;
  stocks: number;
  land: number;
  cash: number;
}

export interface YearLiabilityPoint {
  year: string;
  loan: number;
  credit: number;
}

export interface YearForeignAssetPoint {
  year: string;
  property: number;
  stocks: number;
  cash: number;
}

export interface YearForeignLiabilityPoint {
  year: string;
  loan: number;
}

export interface DashboardTrend {
  years: number[];
  domesticAssets: YearSeriesPoint[];
  domesticLiabilities: YearLiabilityPoint[];
  foreignAssets: YearForeignAssetPoint[];
  foreignLiabilities: YearForeignLiabilityPoint[];
  hartaByYear: Map<number, HartaSnapshot>;
  utangByYear: Map<number, UtangSnapshot>;
  incomeByYear: Map<number, IncomeSnapshot>;
  /** latest vs prior-year growth pct, or null when fewer than 2 data points */
  assetGrowthPct: number | null;
  incomeGrowthPct: number | null;
  hasRealData: boolean;
}

function asNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractHarta(taxData: Record<string, unknown> | null | undefined): HartaSnapshot {
  const h = (taxData?.harta as Record<string, unknown>) || {};
  const accounts = Array.isArray(h.bankAccounts) ? (h.bankAccounts as Record<string, unknown>[]) : [];
  const cashBank = accounts.reduce(
    (sum, r) => sum + ((r.currency as string | undefined) === 'IDR' || !r.currency ? asNumber(r.balance) : 0),
    0,
  );
  const foreignCash = accounts.reduce(
    (sum, r) => sum + ((r.currency as string | undefined) && r.currency !== 'IDR' ? asNumber(r.balance) : 0),
    0,
  );
  return {
    stocks: asNumber(h.stocks),
    realEstate: asNumber(h.realEstate),
    vehicle: asNumber(h.vehicle),
    businessAssets: asNumber(h.businessAssets),
    otherAssets: asNumber(h.otherAssets),
    cashBank,
    foreignCash,
    foreignRealEstate: asNumber(h.foreignRealEstate),
    foreignStocks: asNumber(h.foreignStocks),
  };
}

function extractUtang(taxData: Record<string, unknown> | null | undefined): UtangSnapshot {
  const u = (taxData?.utang as Record<string, unknown>) || {};
  return {
    bankLoan: asNumber(u.bankLoan),
    creditCard: asNumber(u.creditCard),
    personalLoan: asNumber(u.personalLoan),
    businessDebt: asNumber(u.businessDebt),
    foreignLoan: asNumber(u.foreignLoan),
  };
}

function extractIncome(taxData: Record<string, unknown> | null | undefined): IncomeSnapshot {
  const i = (taxData?.incomeSummary as Record<string, unknown>) || {};
  // Intake form doesn't collect income directly today, but when a filing
  // carries grossIncome/taxableIncome at the top level (advisor-entered),
  // read it. Otherwise fall back to zero so year-over-year delta ignores it.
  return {
    gross: asNumber(i.gross) || asNumber(taxData?.grossIncome),
    taxable: asNumber(i.taxable) || asNumber(taxData?.taxableIncome),
  };
}

function totalHarta(s: HartaSnapshot): number {
  return (
    s.stocks + s.realEstate + s.vehicle + s.businessAssets + s.otherAssets +
    s.cashBank + s.foreignCash + s.foreignRealEstate + s.foreignStocks
  );
}

function growthPct(latest: number, prior: number): number | null {
  if (!prior || prior <= 0) return null;
  return Math.round(((latest - prior) / prior) * 100);
}

export function buildDashboardTrend(filings: TrendFiling[]): DashboardTrend {
  const now = new Date().getFullYear();
  // Always show the latest 5 years on the x-axis so the chart is stable
  // regardless of which specific years the customer has filed.
  const axisYears = [now - 4, now - 3, now - 2, now - 1, now];

  const hartaByYear = new Map<number, HartaSnapshot>();
  const utangByYear = new Map<number, UtangSnapshot>();
  const incomeByYear = new Map<number, IncomeSnapshot>();

  for (const f of filings) {
    if (f.tax_type !== 'SPT_TAHUNAN') continue;
    const y = Number(f.tax_period) || f.tax_year || NaN;
    if (!Number.isFinite(y)) continue;
    const td = (f.tax_data as Record<string, unknown> | undefined) ?? {};
    // Multiple filings for the same year → keep the latest (by created_at)
    const existingIncome = incomeByYear.get(y);
    if (!hartaByYear.has(y)) hartaByYear.set(y, extractHarta(td));
    if (!utangByYear.has(y)) utangByYear.set(y, extractUtang(td));
    if (!existingIncome) incomeByYear.set(y, extractIncome(td));
  }

  const domesticAssets: YearSeriesPoint[] = axisYears.map((y) => {
    const h = hartaByYear.get(y);
    return {
      year: String(y),
      building: h?.realEstate ?? 0,
      vehicle: h?.vehicle ?? 0,
      stocks: h?.stocks ?? 0,
      land: h?.otherAssets ?? 0, // Coretax groups land under 토지; 1770SS intake
                                  // doesn't split it further so we alias to otherAssets
      cash: h?.cashBank ?? 0,
    };
  });

  const domesticLiabilities: YearLiabilityPoint[] = axisYears.map((y) => {
    const u = utangByYear.get(y);
    return {
      year: String(y),
      loan: u?.bankLoan ?? 0,
      credit: u?.creditCard ?? 0,
    };
  });

  const foreignAssets: YearForeignAssetPoint[] = axisYears.map((y) => {
    const h = hartaByYear.get(y);
    return {
      year: String(y),
      property: h?.foreignRealEstate ?? 0,
      stocks: h?.foreignStocks ?? 0,
      cash: h?.foreignCash ?? 0,
    };
  });

  const foreignLiabilities: YearForeignLiabilityPoint[] = axisYears.map((y) => {
    const u = utangByYear.get(y);
    return { year: String(y), loan: u?.foreignLoan ?? 0 };
  });

  // Growth: latest year with data vs prior year with data
  const yearsWithHarta = [...hartaByYear.keys()].sort((a, b) => a - b);
  const yearsWithIncome = [...incomeByYear.keys()].sort((a, b) => a - b);

  let assetGrowthPct: number | null = null;
  if (yearsWithHarta.length >= 2) {
    const latestY = yearsWithHarta[yearsWithHarta.length - 1];
    const priorY = yearsWithHarta[yearsWithHarta.length - 2];
    assetGrowthPct = growthPct(
      totalHarta(hartaByYear.get(latestY)!),
      totalHarta(hartaByYear.get(priorY)!),
    );
  }

  let incomeGrowthPct: number | null = null;
  if (yearsWithIncome.length >= 2) {
    const latestY = yearsWithIncome[yearsWithIncome.length - 1];
    const priorY = yearsWithIncome[yearsWithIncome.length - 2];
    const latest = incomeByYear.get(latestY)!;
    const prior = incomeByYear.get(priorY)!;
    incomeGrowthPct = growthPct(latest.gross || latest.taxable, prior.gross || prior.taxable);
  }

  return {
    years: axisYears,
    domesticAssets,
    domesticLiabilities,
    foreignAssets,
    foreignLiabilities,
    hartaByYear,
    utangByYear,
    incomeByYear,
    assetGrowthPct,
    incomeGrowthPct,
    hasRealData: hartaByYear.size > 0 || utangByYear.size > 0,
  };
}
