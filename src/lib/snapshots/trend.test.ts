import { describe, it, expect } from 'vitest';
import {
  sumByYear,
  sumForeignByYear,
  yoyGrowth,
  isAssetGrowthAnomaly,
  type SnapshotRow,
} from './trend';

describe('sumByYear', () => {
  it('returns an empty array for no rows', () => {
    expect(sumByYear([])).toEqual([]);
  });

  it('sums multiple rows in the same year', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2024, amount_idr: 100 },
      { snapshot_year: 2024, amount_idr: 250 },
    ];
    expect(sumByYear(rows)).toEqual([{ year: 2024, total: 350 }]);
  });

  it('keeps years separate and sorts ascending', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2025, amount_idr: 500 },
      { snapshot_year: 2023, amount_idr: 100 },
      { snapshot_year: 2024, amount_idr: 300 },
    ];
    expect(sumByYear(rows)).toEqual([
      { year: 2023, total: 100 },
      { year: 2024, total: 300 },
      { year: 2025, total: 500 },
    ]);
  });

  it('ignores is_foreign flag when summing the whole set', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2024, amount_idr: 200, is_foreign: true },
      { snapshot_year: 2024, amount_idr: 100, is_foreign: false },
    ];
    expect(sumByYear(rows)).toEqual([{ year: 2024, total: 300 }]);
  });

  it('does not create entries for missing years', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2021, amount_idr: 100 },
      { snapshot_year: 2025, amount_idr: 500 },
    ];
    const result = sumByYear(rows);
    expect(result.map((r) => r.year)).toEqual([2021, 2025]);
  });
});

describe('sumForeignByYear', () => {
  it('only counts rows with is_foreign=true', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2024, amount_idr: 200, is_foreign: true },
      { snapshot_year: 2024, amount_idr: 800, is_foreign: false },
      { snapshot_year: 2024, amount_idr: 50, is_foreign: true },
    ];
    expect(sumForeignByYear(rows)).toEqual([{ year: 2024, total: 250 }]);
  });

  it('returns empty when no rows are foreign', () => {
    const rows: SnapshotRow[] = [
      { snapshot_year: 2024, amount_idr: 100, is_foreign: false },
      { snapshot_year: 2024, amount_idr: 100 }, // no flag = not foreign
    ];
    expect(sumForeignByYear(rows)).toEqual([]);
  });

  it('treats missing is_foreign as not foreign', () => {
    const rows: SnapshotRow[] = [{ snapshot_year: 2024, amount_idr: 100 }];
    expect(sumForeignByYear(rows)).toEqual([]);
  });
});

describe('yoyGrowth', () => {
  it('computes +15% correctly', () => {
    expect(yoyGrowth(100, 115)).toBeCloseTo(0.15);
  });

  it('computes -10% correctly', () => {
    expect(yoyGrowth(100, 90)).toBeCloseTo(-0.1);
  });

  it('returns null when prev is undefined (no prior year)', () => {
    expect(yoyGrowth(undefined, 100)).toBeNull();
  });

  it('returns null when prev is 0 and curr > 0 (Infinity would be misleading)', () => {
    expect(yoyGrowth(0, 100)).toBeNull();
  });

  it('returns 0 when both prev and curr are 0 (stable)', () => {
    expect(yoyGrowth(0, 0)).toBe(0);
  });

  it('handles very small numbers', () => {
    expect(yoyGrowth(1, 2)).toBeCloseTo(1.0);
  });
});

describe('isAssetGrowthAnomaly', () => {
  it('flags when asset growth exceeds 1.5x income growth (default)', () => {
    // +30% assets vs +10% income = 3x ratio
    expect(isAssetGrowthAnomaly(0.30, 0.10)).toBe(true);
  });

  it('does not flag when asset growth is near income growth', () => {
    // +12% assets vs +10% income = 1.2x ratio, below 1.5x threshold
    expect(isAssetGrowthAnomaly(0.12, 0.10)).toBe(false);
  });

  it('respects a custom multiplier', () => {
    // 2.0x assets vs income — with multiplier=3, 2.0 < 3.0 = not anomalous
    expect(isAssetGrowthAnomaly(0.20, 0.10, 3)).toBe(false);
    expect(isAssetGrowthAnomaly(0.35, 0.10, 3)).toBe(true);
  });

  it('flags assets growing while income shrinks', () => {
    expect(isAssetGrowthAnomaly(0.05, -0.10)).toBe(true);
  });

  it('does not flag when assets shrink too (even with negative income)', () => {
    expect(isAssetGrowthAnomaly(-0.05, -0.10)).toBe(false);
  });

  it('does not flag when both are zero', () => {
    expect(isAssetGrowthAnomaly(0, 0)).toBe(false);
  });

  it('returns null when asset growth is null (insufficient data)', () => {
    expect(isAssetGrowthAnomaly(null, 0.10)).toBeNull();
  });

  it('returns null when income growth is null', () => {
    expect(isAssetGrowthAnomaly(0.20, null)).toBeNull();
  });

  it('exact 1.5x threshold is NOT anomalous (strict > not >=)', () => {
    // 15% vs 10% = exactly 1.5x
    expect(isAssetGrowthAnomaly(0.15, 0.10)).toBe(false);
    // Just above is anomalous
    expect(isAssetGrowthAnomaly(0.1500001, 0.10)).toBe(true);
  });
});
