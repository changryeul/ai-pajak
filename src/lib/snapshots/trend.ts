/**
 * Trend and growth math for asset / liability snapshots.
 *
 * Pure. No I/O. Consumed by:
 *   * API responses under /api/customer/snapshots (aggregate fields)
 *   * Future dashboard 5-year chart (PR3 Batch 2)
 *   * The asset-growth anomaly rule engine (PR3 Batch 2 → T-002)
 */

export interface SnapshotRow {
  snapshot_year: number;
  amount_idr: number;
  is_foreign?: boolean;
}

export interface YearTotal {
  year: number;
  total: number;
}

/**
 * Sum raw snapshot rows into one (year → total) series.
 * Multiple rows per (customer, year) are summed. Missing years are NOT
 * filled in — callers can decide whether to left-join against a year range.
 */
export function sumByYear<T extends SnapshotRow>(rows: readonly T[]): YearTotal[] {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.snapshot_year, (map.get(r.snapshot_year) ?? 0) + r.amount_idr);
  }
  return [...map.entries()]
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Same as sumByYear but counts only the rows where is_foreign === true.
 * For T-004 (cross-border foreign-asset threshold checks).
 */
export function sumForeignByYear(rows: readonly SnapshotRow[]): YearTotal[] {
  return sumByYear(rows.filter((r) => r.is_foreign === true));
}

/**
 * Year-over-year growth rate as a decimal (0.15 = +15%).
 *
 * Returns null when the prior year total is zero or missing — growth vs 0 is
 * undefined, and callers should render "N/A" rather than Infinity. Returns 0
 * when both years are zero (stable).
 */
export function yoyGrowth(prev: number | undefined, curr: number): number | null {
  if (prev === undefined) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return (curr - prev) / prev;
}

/**
 * Asset-growth anomaly check: flags when asset growth outpaces income
 * growth by more than `multiplier` (default 1.5×). Per T-002 / the
 * prototype's `isWarning` logic.
 *
 *   isAssetGrowthAnomaly(assetGrowth=0.30, incomeGrowth=0.10) → true
 *     (+30% assets vs +10% income = 3× ratio, clearly anomalous)
 *
 *   isAssetGrowthAnomaly(assetGrowth=0.05, incomeGrowth=0.10) → false
 *     (assets grew slower than income)
 *
 *   isAssetGrowthAnomaly(0.30, null) → null
 *     (can't compare without income data; caller renders "data tidak cukup")
 */
export function isAssetGrowthAnomaly(
  assetGrowth: number | null,
  incomeGrowth: number | null,
  multiplier = 1.5,
): boolean | null {
  if (assetGrowth === null || incomeGrowth === null) return null;
  // Negative income growth while assets grow → always anomalous
  if (incomeGrowth <= 0) return assetGrowth > 0;
  return assetGrowth > incomeGrowth * multiplier;
}
