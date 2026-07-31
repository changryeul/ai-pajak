import { describe, it, expect } from 'vitest';
import { evaluateUmkmFlags, type UmkmReviewInput } from '../umkm-review-flags';

const paid: UmkmReviewInput = { status: 'PAID', amountDue: 500000 };

describe('evaluateUmkmFlags', () => {
  it('marks a paid record with a due amount green', () => {
    const r = evaluateUmkmFlags(paid);
    expect(r.level).toBe('green');
    expect(r.issues).toEqual([]);
    expect(r.label).toBe('확인 완료');
  });

  it('flags UNPAID as red 미납', () => {
    const r = evaluateUmkmFlags({ status: 'UNPAID', amountDue: 500000 });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('미납');
    expect(r.label).toBe('미납 확인 필요');
  });

  it('flags OVERDUE as red 연체', () => {
    expect(evaluateUmkmFlags({ status: 'OVERDUE', amountDue: 500000 }).issues).toContain('연체');
  });

  it('flags PARTIAL as red 부분납', () => {
    expect(evaluateUmkmFlags({ status: 'PARTIAL', amountDue: 500000 }).issues).toContain('부분납');
  });

  it('flags zero amount_due as red 미계산', () => {
    const r = evaluateUmkmFlags({ status: 'PAID', amountDue: 0 });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('미계산');
  });

  it('combines status and 미계산 in fixed order', () => {
    const r = evaluateUmkmFlags({ status: 'UNPAID', amountDue: 0 });
    expect(r.level).toBe('red');
    expect(r.issues).toEqual(['미납', '미계산']);
    expect(r.label).toBe('미납·미계산 확인 필요');
  });
});
