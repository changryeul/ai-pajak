import { describe, it, expect } from 'vitest';
import { evaluateAnnualFlags } from '../annual-review-flags';

const base = {
  hasSession: true,
  sessionStatus: 'COMPLETED',
  signedStatementsUploaded: true,
  documentCount: 3,
  submissionStatus: 'BPE_UPLOADED',
  bpeNumber: 'BPE-123',
  failureReason: null,
};

describe('evaluateAnnualFlags', () => {
  it('green when session complete + submitted + BPE present', () => {
    const f = evaluateAnnualFlags(base);
    expect(f.level).toBe('green');
    expect(f.issues).toEqual([]);
    expect(f.label).toBe('정상');
  });

  it('red when queue row has no linked closing session', () => {
    const f = evaluateAnnualFlags({ ...base, hasSession: false });
    expect(f.level).toBe('red');
    expect(f.issues).toContain('결산 세션 미연결');
  });

  it('amber when wizard still in progress', () => {
    const f = evaluateAnnualFlags({ ...base, sessionStatus: 'IN_PROGRESS' });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('결산 작성중');
  });

  it('amber when signed statements missing', () => {
    const f = evaluateAnnualFlags({ ...base, signedStatementsUploaded: false });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('서명 재무제표 미업로드');
  });

  it('amber when no documents uploaded', () => {
    const f = evaluateAnnualFlags({ ...base, documentCount: 0 });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('증빙 문서 없음');
  });

  it('amber when never submitted to DJP', () => {
    const f = evaluateAnnualFlags({ ...base, submissionStatus: null, bpeNumber: null });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('DJP 미제출');
  });

  it('red with reason when submission failed', () => {
    const f = evaluateAnnualFlags({ ...base, submissionStatus: 'FAILED', failureReason: 'timeout' });
    expect(f.level).toBe('red');
    expect(f.issues).toContain('제출 실패: timeout');
  });

  it('amber when completed without BPE number', () => {
    const f = evaluateAnnualFlags({ ...base, submissionStatus: 'COMPLETED', bpeNumber: null });
    expect(f.level).toBe('amber');
    expect(f.issues).toContain('BPE 번호 누락');
  });

  it('red wins over amber and label is the first issue', () => {
    const f = evaluateAnnualFlags({
      ...base, hasSession: false, signedStatementsUploaded: false,
    });
    expect(f.level).toBe('red');
    expect(f.label).toBe('결산 세션 미연결');
  });
});
