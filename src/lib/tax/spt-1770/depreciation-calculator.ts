/**
 * Depreciation Calculator for SPT 1770
 *
 * Calculates fiscal depreciation based on Indonesian tax law (Pasal 11 UU PPh)
 * Supports both straight-line and declining balance methods.
 */

import { DEPRECIATION_RATES } from '../shared/constants';
import type { DepreciationCategory } from '../shared/types';
import type { SPT1770DepreciationItem } from './types';

/**
 * Asset input for depreciation calculation
 */
export interface DepreciationAssetInput {
  assetId: string;
  assetName: string;
  assetCategory: DepreciationCategory;
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionCost: number;
  depreciationMethod?: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  priorDepreciation?: number; // Already depreciated amount
}

/**
 * Calculate depreciation for a single asset
 */
export function calculateAssetDepreciation(
  asset: DepreciationAssetInput,
  taxYear: number
): SPT1770DepreciationItem {
  const rates = DEPRECIATION_RATES[asset.assetCategory];
  const usefulLife = rates.usefulLife;

  // Determine depreciation method
  // Buildings can only use straight-line
  const method =
    asset.assetCategory === 'BUILDING_PERMANENT' ||
    asset.assetCategory === 'BUILDING_NON_PERMANENT'
      ? 'STRAIGHT_LINE'
      : asset.depreciationMethod || 'STRAIGHT_LINE';

  // Get annual rate
  const annualRate =
    method === 'STRAIGHT_LINE'
      ? rates.straightLine
      : rates.decliningBalance || rates.straightLine;

  // Calculate acquisition year and month
  const acquisitionDate = new Date(asset.acquisitionDate);
  const acquisitionYear = acquisitionDate.getFullYear();
  const acquisitionMonth = acquisitionDate.getMonth() + 1;

  // Calculate months of use in first year
  const monthsInFirstYear = acquisitionYear === taxYear ? 13 - acquisitionMonth : 12;

  // Calculate years since acquisition
  const yearsSinceAcquisition = taxYear - acquisitionYear;

  // Prior depreciation (either provided or calculated)
  let priorDepreciation = asset.priorDepreciation || 0;

  if (!asset.priorDepreciation && yearsSinceAcquisition > 0) {
    // Calculate prior depreciation
    if (method === 'STRAIGHT_LINE') {
      // First year: prorated
      const firstYearDepreciation =
        (asset.acquisitionCost * annualRate * monthsInFirstYear) / 12;
      priorDepreciation = firstYearDepreciation;

      // Full years between
      const fullYears = yearsSinceAcquisition - 1;
      if (fullYears > 0) {
        priorDepreciation += asset.acquisitionCost * annualRate * fullYears;
      }
    } else {
      // Declining balance - calculate year by year
      let bookValue = asset.acquisitionCost;
      for (let year = acquisitionYear; year < taxYear; year++) {
        const months = year === acquisitionYear ? monthsInFirstYear : 12;
        const yearDepreciation = (bookValue * annualRate * months) / 12;
        priorDepreciation += yearDepreciation;
        bookValue -= yearDepreciation;
      }
    }
  }

  // Calculate current year depreciation
  let currentYearDepreciation = 0;
  const bookValueBeforeDepreciation = asset.acquisitionCost - priorDepreciation;

  if (bookValueBeforeDepreciation > 0) {
    if (method === 'STRAIGHT_LINE') {
      // Check if this is the first year
      if (taxYear === acquisitionYear) {
        // Prorated for first year
        currentYearDepreciation =
          (asset.acquisitionCost * annualRate * monthsInFirstYear) / 12;
      } else {
        // Full year depreciation
        currentYearDepreciation = asset.acquisitionCost * annualRate;
      }

      // Cannot exceed remaining book value
      currentYearDepreciation = Math.min(
        currentYearDepreciation,
        bookValueBeforeDepreciation
      );
    } else {
      // Declining balance
      currentYearDepreciation = bookValueBeforeDepreciation * annualRate;

      // In the last year, depreciate remaining book value
      const expectedEndingBookValue =
        bookValueBeforeDepreciation - currentYearDepreciation;
      if (expectedEndingBookValue < asset.acquisitionCost * 0.1) {
        // If book value would be less than 10%, depreciate fully
        currentYearDepreciation = bookValueBeforeDepreciation;
      }
    }
  }

  // Round to nearest Rupiah
  currentYearDepreciation = Math.round(currentYearDepreciation);
  priorDepreciation = Math.round(priorDepreciation);

  const accumulatedDepreciation = priorDepreciation + currentYearDepreciation;
  const bookValue = asset.acquisitionCost - accumulatedDepreciation;

  return {
    assetId: asset.assetId,
    assetName: asset.assetName,
    assetCategory: asset.assetCategory,
    acquisitionDate: asset.acquisitionDate,
    acquisitionCost: asset.acquisitionCost,
    usefulLife,
    depreciationMethod: method,
    annualDepreciationRate: annualRate,
    priorDepreciation,
    currentYearDepreciation,
    accumulatedDepreciation,
    bookValue: Math.max(0, bookValue),
  };
}

/**
 * Calculate depreciation for multiple assets
 */
export function calculateMultipleAssetsDepreciation(
  assets: DepreciationAssetInput[],
  taxYear: number
): {
  items: SPT1770DepreciationItem[];
  totalCurrentYearDepreciation: number;
  totalBookValue: number;
} {
  const items = assets.map((asset) =>
    calculateAssetDepreciation(asset, taxYear)
  );

  const totalCurrentYearDepreciation = items.reduce(
    (sum, item) => sum + item.currentYearDepreciation,
    0
  );

  const totalBookValue = items.reduce((sum, item) => sum + item.bookValue, 0);

  return {
    items,
    totalCurrentYearDepreciation,
    totalBookValue,
  };
}

/**
 * Get depreciation category from asset type description
 */
export function getDepreciationCategory(
  assetType: string
): DepreciationCategory {
  const type = assetType.toLowerCase();

  // Group 1: 4 years
  if (
    type.includes('computer') ||
    type.includes('komputer') ||
    type.includes('laptop') ||
    type.includes('printer') ||
    type.includes('office equipment') ||
    type.includes('peralatan kantor')
  ) {
    return 'GROUP_1';
  }

  // Group 2: 8 years
  if (
    type.includes('vehicle') ||
    type.includes('kendaraan') ||
    type.includes('mobil') ||
    type.includes('motor') ||
    type.includes('furniture') ||
    type.includes('mebel') ||
    type.includes('perabot')
  ) {
    return 'GROUP_2';
  }

  // Group 3: 16 years
  if (
    type.includes('machine') ||
    type.includes('mesin') ||
    type.includes('equipment') ||
    type.includes('peralatan berat')
  ) {
    return 'GROUP_3';
  }

  // Group 4: 20 years
  if (
    type.includes('heavy equipment') ||
    type.includes('alat berat')
  ) {
    return 'GROUP_4';
  }

  // Buildings
  if (
    type.includes('building') ||
    type.includes('bangunan') ||
    type.includes('gedung')
  ) {
    if (type.includes('permanent') || type.includes('permanen')) {
      return 'BUILDING_PERMANENT';
    }
    return 'BUILDING_NON_PERMANENT';
  }

  // Default to Group 2
  return 'GROUP_2';
}

/**
 * Calculate remaining useful life
 */
export function calculateRemainingUsefulLife(
  acquisitionDate: string,
  usefulLife: number,
  taxYear: number
): number {
  const acquisitionYear = new Date(acquisitionDate).getFullYear();
  const yearsUsed = taxYear - acquisitionYear;
  return Math.max(0, usefulLife - yearsUsed);
}

/**
 * Check if asset is fully depreciated
 */
export function isFullyDepreciated(item: SPT1770DepreciationItem): boolean {
  return item.bookValue <= 0;
}

/**
 * Generate depreciation schedule for an asset
 */
export function generateDepreciationSchedule(
  asset: DepreciationAssetInput,
  startYear?: number
): SPT1770DepreciationItem[] {
  const rates = DEPRECIATION_RATES[asset.assetCategory];
  const usefulLife = rates.usefulLife;
  const acquisitionYear = new Date(asset.acquisitionDate).getFullYear();
  const start = startYear || acquisitionYear;
  const schedule: SPT1770DepreciationItem[] = [];

  // Calculate for each year until fully depreciated
  for (let year = start; year <= acquisitionYear + usefulLife + 1; year++) {
    const item = calculateAssetDepreciation(
      {
        ...asset,
        priorDepreciation:
          schedule.length > 0
            ? schedule[schedule.length - 1].accumulatedDepreciation
            : undefined,
      },
      year
    );

    schedule.push(item);

    if (item.bookValue <= 0) {
      break;
    }
  }

  return schedule;
}
