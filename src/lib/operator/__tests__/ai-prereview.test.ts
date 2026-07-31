import { describe, it, expect } from 'vitest';
import { ruleBasedPreReview, type PreReviewInput } from '../ai-prereview';

const mk = (levels: Array<'red' | 'amber' | 'green'>, label = '확인 필요'): PreReviewInput => ({
  taxView: 'withholding',
  period: '2026-06',
  summary: { txnCount: levels.length },
  rows: levels.map(level => ({ flags: { level, label: level === 'green' ? '확인 완료' : label } })),
});

describe('ruleBasedPreReview', () => {
  it('is low risk when no red rows', () => {
    const r = ruleBasedPreReview(mk(['green', 'green']));
    expect(r.riskLevel).toBe('low');
    expect(r.mode).toBe('rule');
    expect(r.findings).toEqual([]);
  });

  it('is medium risk with some red (<=50%)', () => {
    const r = ruleBasedPreReview(mk(['red', 'green', 'green', 'green']));
    expect(r.riskLevel).toBe('medium');
    expect(r.headline).toContain('1');
  });

  it('is high risk when more than half are red', () => {
    const r = ruleBasedPreReview(mk(['red', 'red', 'red', 'green']));
    expect(r.riskLevel).toBe('high');
  });

  it('aggregates findings by flag label, descending', () => {
    const input: PreReviewInput = {
      taxView: 'ppn', period: '2026-06', summary: {},
      rows: [
        { flags: { level: 'red', label: 'Coretax 확인 필요' } },
        { flags: { level: 'red', label: 'Coretax 확인 필요' } },
        { flags: { level: 'red', label: 'NPWP 확인 필요' } },
        { flags: { level: 'green', label: '확인 완료' } },
      ],
    };
    const r = ruleBasedPreReview(input);
    expect(r.findings[0]).toContain('Coretax 확인 필요');
    expect(r.findings[0]).toContain('2');
    expect(r.findings.some(f => f.includes('NPWP 확인 필요'))).toBe(true);
    // green rows never appear in findings
    expect(r.findings.some(f => f.includes('확인 완료'))).toBe(false);
  });

  it('handles empty rows as low risk', () => {
    const r = ruleBasedPreReview({ taxView: 'umkm', period: '2026-06', summary: {}, rows: [] });
    expect(r.riskLevel).toBe('low');
    expect(r.headline).toBeTruthy();
  });
});
