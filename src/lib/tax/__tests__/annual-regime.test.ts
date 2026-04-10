import { describe, it, expect } from 'vitest';
import {
  determineAnnualRegime,
  getMaxUmkmYears,
  UMKM_REVENUE_THRESHOLD,
  NEW_COMPANY_EXEMPTION_YEARS,
} from '../annual-regime';

/**
 * Annual regime determination — covers Phase 4 (연 결산 자동 판별) logic.
 *
 * Rules (priority order):
 * 1. NPWP 발행 시 PPh 25 선택 → PPh 25 (3년 이내라도)
 * 2. UMKM 부적격 법인 형태 → PPh 25
 * 3. UMKM 최대 기간 초과 → PPh 25
 * 4. 당해/과거 연매출 ≥ 48억 IDR → PPh 25
 * 5. 위 조건 모두 미해당 → PPh Final UMKM 0.5%
 */
describe('determineAnnualRegime (Phase 4)', () => {
  const currentYear = 2026;
  const baseInput = {
    establishedYear: 2024,
    currentYear,
    legalForm: 'PT',
    annualRevenue: 1_000_000_000, // 1B IDR
    npwpPph25Elected: false,
    isUmkm: true,
  };

  describe('NOT_DETERMINED (missing data)', () => {
    it('should return NOT_DETERMINED when establishedYear is missing', () => {
      const result = determineAnnualRegime({ ...baseInput, establishedYear: null });
      expect(result.regime).toBe('NOT_DETERMINED');
      expect(result.route).toBe(null);
      expect(result.warnings?.[0]).toContain('설립 연도');
    });

    it('should return NOT_DETERMINED when legalForm is missing', () => {
      const result = determineAnnualRegime({ ...baseInput, legalForm: null });
      expect(result.regime).toBe('NOT_DETERMINED');
      expect(result.route).toBe(null);
    });

    it('should return NOT_DETERMINED when establishedYear is 0', () => {
      const result = determineAnnualRegime({ ...baseInput, establishedYear: 0 });
      expect(result.regime).toBe('NOT_DETERMINED');
    });
  });

  describe('Rule 1: PPh 25 elected at NPWP creation', () => {
    it('should return PPh 25 when npwpPph25Elected is true (within 3 years)', () => {
      const result = determineAnnualRegime({ ...baseInput, npwpPph25Elected: true });
      expect(result.regime).toBe('PPH25');
      expect(result.route).toBe('/tax/annual/pph25');
      expect(result.legalBasis).toContain('PPh 25 election');
    });

    it('should override UMKM eligibility when npwpPph25Elected is true', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        npwpPph25Elected: true,
        isUmkm: true,
        annualRevenue: 500_000_000,
      });
      expect(result.regime).toBe('PPH25');
    });
  });

  describe('Rule 2: Non-UMKM eligible legal form', () => {
    it('should return PPh 25 for YAYASAN (foundation, not UMKM eligible)', () => {
      const result = determineAnnualRegime({ ...baseInput, legalForm: 'YAYASAN' });
      expect(result.regime).toBe('PPH25');
      expect(result.reason).toContain('YAYASAN');
    });

    it('should return PPh Final for KOPERASI (eligible)', () => {
      const result = determineAnnualRegime({ ...baseInput, legalForm: 'KOPERASI' });
      expect(result.regime).toBe('PPH_FINAL');
    });

    it('should return PPh Final for UD (eligible, 7 year limit)', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'UD',
        establishedYear: 2020, // 6 years → within UD 7-year limit
      });
      expect(result.regime).toBe('PPH_FINAL');
    });
  });

  describe('Rule 3: Beyond UMKM max years', () => {
    it('should return PPh 25 for PT after 3 years', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'PT',
        establishedYear: 2022, // 4 years → exceeded PT 3-year limit
      });
      expect(result.regime).toBe('PPH25');
      expect(result.reason).toContain('3년');
    });

    it('should return PPh Final for PT at year 2 (within limit)', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'PT',
        establishedYear: 2024, // 2 years operating
      });
      expect(result.regime).toBe('PPH_FINAL');
      expect(result.umkmYearsRemaining).toBe(1);
    });

    it('should return PPh 25 for CV after 4 years', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'CV',
        establishedYear: 2021, // 5 years
      });
      expect(result.regime).toBe('PPH25');
    });

    it('should return PPh Final for CV at year 3 (within 4-year limit)', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'CV',
        establishedYear: 2023, // 3 years
      });
      expect(result.regime).toBe('PPH_FINAL');
      expect(result.umkmYearsRemaining).toBe(1);
    });

    it('should warn when last UMKM year remaining', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'PT',
        establishedYear: 2024, // 2 years, 1 remaining
      });
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('마지막'))).toBe(true);
    });
  });

  describe('Rule 4: Revenue exceeds threshold', () => {
    it('should return PPh 25 when annual revenue exceeds 4.8B IDR', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        annualRevenue: UMKM_REVENUE_THRESHOLD + 1,
      });
      expect(result.regime).toBe('PPH25');
      expect(result.reason).toContain('임계값');
    });

    it('should return PPh 25 when prior year revenue exceeded threshold', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        annualRevenue: 3_000_000_000, // Current below
        priorYearRevenues: [5_000_000_000], // Prior above
      });
      expect(result.regime).toBe('PPH25');
    });

    it('should return PPh Final when revenue just below threshold', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        annualRevenue: UMKM_REVENUE_THRESHOLD - 1,
      });
      expect(result.regime).toBe('PPH_FINAL');
    });
  });

  describe('Rule 5: UMKM default (happy path)', () => {
    it('should return PPh Final UMKM for new PT with low revenue', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        establishedYear: 2025,
        annualRevenue: 500_000_000,
      });
      expect(result.regime).toBe('PPH_FINAL');
      expect(result.route).toBe('/tax/annual/pph-final');
      expect(result.title).toContain('0.5%');
      expect(result.umkmYearsRemaining).toBe(2);
    });

    it('should handle zero revenue', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        establishedYear: 2025,
        annualRevenue: 0,
      });
      expect(result.regime).toBe('PPH_FINAL');
    });
  });

  describe('Priority ordering', () => {
    it('should prioritize NPWP election over revenue threshold', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        npwpPph25Elected: true,
        annualRevenue: UMKM_REVENUE_THRESHOLD + 1,
      });
      expect(result.regime).toBe('PPH25');
      // Reason should mention election, not revenue
      expect(result.legalBasis).toContain('PPh 25 election');
    });

    it('should prioritize NPWP election over years exceeded', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        npwpPph25Elected: true,
        legalForm: 'PT',
        establishedYear: 2018, // 8 years exceeded
      });
      expect(result.regime).toBe('PPH25');
      expect(result.legalBasis).toContain('PPh 25 election');
    });

    it('should prioritize legal form over years', () => {
      const result = determineAnnualRegime({
        ...baseInput,
        legalForm: 'YAYASAN',
        establishedYear: 2025, // new but non-UMKM form
      });
      expect(result.regime).toBe('PPH25');
      expect(result.reason).toContain('YAYASAN');
    });
  });
});

describe('getMaxUmkmYears (Phase 4)', () => {
  it('should return 3 for PT', () => {
    expect(getMaxUmkmYears('PT')).toBe(3);
  });

  it('should return 4 for CV, Firma, Koperasi', () => {
    expect(getMaxUmkmYears('CV')).toBe(4);
    expect(getMaxUmkmYears('FIRMA')).toBe(4);
    expect(getMaxUmkmYears('KOPERASI')).toBe(4);
  });

  it('should return 7 for UD (individual)', () => {
    expect(getMaxUmkmYears('UD')).toBe(7);
  });

  it('should be case-insensitive', () => {
    expect(getMaxUmkmYears('pt')).toBe(3);
    expect(getMaxUmkmYears('Cv')).toBe(4);
  });

  it('should return default for unknown legal form', () => {
    expect(getMaxUmkmYears('UNKNOWN')).toBe(NEW_COMPANY_EXEMPTION_YEARS);
    expect(getMaxUmkmYears(null)).toBe(NEW_COMPANY_EXEMPTION_YEARS);
    expect(getMaxUmkmYears(undefined)).toBe(NEW_COMPANY_EXEMPTION_YEARS);
  });
});

describe('UMKM_REVENUE_THRESHOLD constant', () => {
  it('should be 4.8 billion IDR', () => {
    expect(UMKM_REVENUE_THRESHOLD).toBe(4_800_000_000);
  });
});

describe('NEW_COMPANY_EXEMPTION_YEARS constant', () => {
  it('should be 3 years', () => {
    expect(NEW_COMPANY_EXEMPTION_YEARS).toBe(3);
  });
});
