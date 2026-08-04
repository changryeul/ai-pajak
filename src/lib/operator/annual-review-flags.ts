/**
 * 연 신고(SPT Tahunan) 워크큐 검토 플래그 — 순수 함수.
 *
 * 소스가 거래/납부 리스트가 아니라 **결산 세션 1건**이므로 플래그도 세션
 * 레벨 하나다 (골든패턴의 row 플래그와 달리 패널 상단 배너로 노출).
 *
 * red   — 검토를 막는 결함 (세션 미연결, 제출 실패)
 * amber — 진행 중이거나 보완 필요 (작성중, 서명서류/증빙 누락, 미제출, BPE 대기)
 * green — 이상 없음
 */

export interface AnnualFlagInput {
  hasSession: boolean;
  /** tax_closing_session.status — IN_PROGRESS | COMPLETED | ARCHIVED */
  sessionStatus: string | null;
  signedStatementsUploaded: boolean;
  documentCount: number;
  /** closing_submission.status — SUBMITTED | OPERATOR_REVIEW | PROCESSING | BPE_UPLOADED | COMPLETED | FAILED | CANCELLED */
  submissionStatus: string | null;
  bpeNumber: string | null;
  failureReason?: string | null;
}

export interface AnnualFlags {
  level: 'red' | 'amber' | 'green';
  issues: string[];
  label: string;
}

export function evaluateAnnualFlags(input: AnnualFlagInput): AnnualFlags {
  const red: string[] = [];
  const amber: string[] = [];

  if (!input.hasSession) {
    // 수동 생성 케이스 — 결산 wizard 를 거치지 않아 검토할 세션 데이터가 없음.
    red.push('결산 세션 미연결');
  } else {
    if (input.sessionStatus === 'IN_PROGRESS') amber.push('결산 작성중');
    if (!input.signedStatementsUploaded) amber.push('서명 재무제표 미업로드');
    if (input.documentCount === 0) amber.push('증빙 문서 없음');

    if (input.submissionStatus === 'FAILED') {
      red.push(input.failureReason ? `제출 실패: ${input.failureReason}` : '제출 실패');
    } else if (input.submissionStatus === 'CANCELLED') {
      amber.push('제출 취소됨');
    } else if (!input.submissionStatus) {
      amber.push('DJP 미제출');
    } else if (
      (input.submissionStatus === 'BPE_UPLOADED' || input.submissionStatus === 'COMPLETED') &&
      !input.bpeNumber
    ) {
      amber.push('BPE 번호 누락');
    }
  }

  const issues = [...red, ...amber];
  const level: AnnualFlags['level'] = red.length > 0 ? 'red' : amber.length > 0 ? 'amber' : 'green';
  return { level, issues, label: issues[0] ?? '정상' };
}
