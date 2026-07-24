import { describe, it, expect } from 'vitest';
import { rankOperators, scoreCandidate, UNAPPLIED_CRITERIA, type OperatorCandidate } from '../assignment-engine';

const base: OperatorCandidate = {
  id: 'op1', maxClients: 10, status: 'active', workState: 'available',
  autoAssignEnabled: true, approvalQualityScore: 80, accuracyPct: 90, specialties: [],
};
const load0 = () => 0;

describe('assignment-engine scoreCandidate', () => {
  it('marks non-active operator ineligible', () => {
    const r = scoreCandidate({ ...base, status: 'inactive' }, load0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toBe('not-active');
  });

  it('excludes auto-assign-disabled operators', () => {
    const r = scoreCandidate({ ...base, autoAssignEnabled: false }, load0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toBe('auto-assign-disabled');
  });

  it('excludes offline operators', () => {
    const r = scoreCandidate({ ...base, workState: 'offline' }, load0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.ineligibleReason).toBe('offline');
  });

  it('excludes at-capacity operators', () => {
    const r = scoreCandidate(base, () => 10, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.ineligibleReason).toBe('at-capacity');
  });

  it('awards full sticky weight to the existing operator', () => {
    const r = scoreCandidate(base, load0, { currentLoad: 0, stickyOperatorId: 'op1', taxType: null });
    expect(r.breakdown.sticky).toBe(40);
  });

  it('awards specialty weight only when tax type matches', () => {
    const withSpec = { ...base, specialties: ['PPh23'] };
    expect(scoreCandidate(withSpec, load0, { currentLoad: 0, stickyOperatorId: null, taxType: 'PPh23' }).breakdown.specialty).toBe(15);
    expect(scoreCandidate(withSpec, load0, { currentLoad: 0, stickyOperatorId: null, taxType: 'PPN' }).breakdown.specialty).toBe(0);
  });

  it('gives full headroom to an empty operator and less to a loaded one', () => {
    const empty = scoreCandidate(base, () => 0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    const half = scoreCandidate(base, () => 5, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(empty.breakdown.headroom).toBe(20);
    expect(half.breakdown.headroom).toBeCloseTo(10, 5);
  });

  it('scores quality as 60% approval + 40% accuracy', () => {
    const r = scoreCandidate(base, load0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    // (0.8*0.6 + 0.9*0.4) * 25 = (0.48+0.36)*25 = 21
    expect(r.breakdown.quality).toBeCloseTo(21, 5);
  });
});

describe('assignment-engine rankOperators', () => {
  const ops: OperatorCandidate[] = [
    { ...base, id: 'busy', approvalQualityScore: 95, accuracyPct: 95 },
    { ...base, id: 'idle', approvalQualityScore: 60, accuracyPct: 60 },
  ];

  it('prefers sticky operator even if another scores higher on quality', () => {
    const r = rankOperators(ops, () => 0, { currentLoad: 0, stickyOperatorId: 'idle', taxType: null });
    expect(r.method).toBe('sticky');
    expect(r.best?.operatorId).toBe('idle');
  });

  it('falls back to scored when no sticky', () => {
    const r = rankOperators(ops, () => 0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.method).toBe('scored');
    expect(r.best?.operatorId).toBe('busy'); // higher quality
  });

  it('returns overflow when everyone is at capacity', () => {
    const r = rankOperators(ops, () => 10, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.method).toBe('overflow');
    expect(r.best).toBeNull();
  });

  it('always reports the unapplied criteria (no silent caps)', () => {
    const r = rankOperators(ops, () => 0, { currentLoad: 0, stickyOperatorId: null, taxType: null });
    expect(r.unappliedCriteria).toEqual([...UNAPPLIED_CRITERIA]);
    expect(r.unappliedCriteria).toContain('language');
    expect(r.unappliedCriteria).toContain('risk');
  });
});
