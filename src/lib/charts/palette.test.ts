import { describe, expect, it } from 'vitest';
import {
  OKABE_ITO_8,
  TAX_TYPE_COLORS,
  YEAR_PALETTE,
  QUEUE_STATUS_COLORS,
  CLOSING_BAR_REVENUE,
  CLOSING_BAR_NET_INCOME,
  CLOSING_LINE_ETR,
  CHART_ACCENT_POSITIVE,
  CHART_ACCENT_NEGATIVE,
} from './palette';

const HEX = /^#[0-9A-Fa-f]{6}$/;

function normalize(s: string) {
  return s.toUpperCase();
}

describe('chart palette', () => {
  it('Okabe-Ito 8 — every entry is a valid 6-digit hex', () => {
    for (const c of OKABE_ITO_8) {
      expect(c).toMatch(HEX);
    }
  });

  it('Okabe-Ito 8 — all 8 colors are unique', () => {
    const set = new Set(OKABE_ITO_8.map(normalize));
    expect(set.size).toBe(OKABE_ITO_8.length);
  });

  it('YEAR_PALETTE entries are all unique 6-digit hex', () => {
    for (const c of YEAR_PALETTE) {
      expect(c).toMatch(HEX);
    }
    const set = new Set(YEAR_PALETTE.map(normalize));
    expect(set.size).toBe(YEAR_PALETTE.length);
  });

  it('TAX_TYPE_COLORS — all 5 canonical types map to unique hex colors', () => {
    const types = ['PPh21', 'PPh23', 'PPh25', 'PPN', 'PPh_FINAL'];
    const colors: string[] = [];
    for (const tt of types) {
      const c = TAX_TYPE_COLORS[tt];
      expect(c, `missing color for ${tt}`).toBeDefined();
      expect(c).toMatch(HEX);
      colors.push(normalize(c));
    }
    expect(new Set(colors).size).toBe(types.length);
  });

  it('QUEUE_STATUS_COLORS — all 12 statuses mapped + unique', () => {
    const statuses = [
      'PENDING',
      'DATA_REVIEW',
      'PENDING_APPROVAL',
      'APPROVED',
      'EBILLING_GENERATED',
      'PAYMENT_PENDING',
      'PAYMENT_UPLOADED',
      'PAYMENT_VERIFIED',
      'DJP_SUBMITTED',
      'BPE_UPLOADED',
      'COMPLETED',
      'FAILED',
    ];
    const colors: string[] = [];
    for (const s of statuses) {
      const c = QUEUE_STATUS_COLORS[s];
      expect(c, `missing color for ${s}`).toBeDefined();
      expect(c).toMatch(HEX);
      colors.push(normalize(c));
    }
    // All 12 distinct.
    expect(new Set(colors).size).toBe(statuses.length);
  });

  it('semantic accents — positive ≠ negative (the deuteranopia pitfall)', () => {
    expect(normalize(CHART_ACCENT_POSITIVE)).not.toBe(normalize(CHART_ACCENT_NEGATIVE));
    // Must use bluish-green vs vermillion specifically, NOT emerald/rose.
    expect(normalize(CHART_ACCENT_POSITIVE)).toBe('#009E73');
    expect(normalize(CHART_ACCENT_NEGATIVE)).toBe('#D55E00');
  });

  it('terminal queue statuses follow the semantic-accent pairing', () => {
    expect(normalize(QUEUE_STATUS_COLORS.COMPLETED)).toBe(normalize(CHART_ACCENT_POSITIVE));
    expect(normalize(QUEUE_STATUS_COLORS.FAILED)).toBe(normalize(CHART_ACCENT_NEGATIVE));
  });

  it('closing trend bar/line trio is internally distinct', () => {
    const set = new Set([
      normalize(CLOSING_BAR_REVENUE),
      normalize(CLOSING_BAR_NET_INCOME),
      normalize(CLOSING_LINE_ETR),
    ]);
    expect(set.size).toBe(3);
  });
});
