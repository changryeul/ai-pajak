/**
 * 세목 → Coretax KAP/KJS 코드 매핑 (ID Billing 발행 보드 공용).
 *
 * operator cases coretax route 의 mapTaxTypeToKap 와 정합 — 발행 보드는
 * ERP calc kind 까지 다뤄야 해서 별도 모듈로 확장한다.
 */

export interface KapKjs {
  kap: string;
  kjs: string;
}

export function kapKjsForTaxType(taxType: string): KapKjs {
  switch (taxType) {
    case 'PPh21':       return { kap: '411121', kjs: '100' };
    case 'PPh22':       return { kap: '411122', kjs: '100' };
    case 'PPh23':       return { kap: '411124', kjs: '100' };
    case 'PPh4_2':
    case 'PPh4(2)':
    case 'PPh42':       return { kap: '411128', kjs: '403' };
    case 'PPh Final':
    case 'PPH_FINAL':   return { kap: '411128', kjs: '420' }; // UMKM 0.5% (PP 55/2022)
    case 'PPh25':
    case 'PPH25':       return { kap: '411126', kjs: '100' };
    case 'PPh26':       return { kap: '411127', kjs: '100' };
    case 'PPN':         return { kap: '411211', kjs: '100' };
    case 'SPT_TAHUNAN': return { kap: '411126', kjs: '200' };
    default:            return { kap: '411124', kjs: '100' };
  }
}

/**
 * ERP calc kind → 보드에 표시할 세목/세율 라벨.
 * CORP_TAX_MONTHLY 는 basis.selectedCase 로 PPh25 / PPh Final 을 판별한다
 * (v19 §9: 해당하는 법인세만 표시).
 */
export function taxTypeForCalc(
  kind: string,
  basis: Record<string, unknown> | null,
): { taxType: string; rateLabel: string; taxBase: number | null } | null {
  const b = basis ?? {};
  switch (kind) {
    case 'PPH21_TER': {
      const rate = typeof b.terRate === 'number' ? b.terRate : null;
      const base = typeof b.grossMonthlyPayroll === 'number' ? b.grossMonthlyPayroll : null;
      return { taxType: 'PPh21', rateLabel: rate != null ? `TER ${(rate * 100).toFixed(2)}%` : 'TER', taxBase: base };
    }
    case 'WITHHOLDING_SUMMARY': {
      const rate = typeof b.averageRate === 'number' ? b.averageRate : null;
      const base = typeof b.totalGross === 'number' ? b.totalGross : null;
      return { taxType: 'PPh23', rateLabel: rate != null ? `${(rate * 100).toFixed(2)}%` : '—', taxBase: base };
    }
    case 'CORP_TAX_MONTHLY': {
      const selected = b.selectedCase as string | null;
      if (selected === 'PPH_FINAL') {
        const base = typeof b.annualRevenueAnnualized === 'number' ? (b.annualRevenueAnnualized as number) / 12 : null;
        return { taxType: 'PPh Final', rateLabel: '0.5%', taxBase: base };
      }
      if (selected === 'PPH25') {
        return { taxType: 'PPh25', rateLabel: '전년 법인세 ÷ 12', taxBase: null };
      }
      return null; // NOT_DETERMINED — 발행 항목에서 제외
    }
    case 'PPN_NET':
      return { taxType: 'PPN', rateLabel: '11%', taxBase: null };
    case 'BANK_RECON':
      return null; // 검증용 — 세금 항목 아님
    default:
      return null;
  }
}
