import { WorkflowActions } from '../types/taxcase';

type Props = {
  taxCaseId: string;
  actions: WorkflowActions;
  reload: () => void;
};

export function TaxCaseActions({ taxCaseId, actions, reload }: Props) {
  async function post(url: string) {
    await fetch(url, {
      method: 'POST',
      headers: {
        'x-user-id': '1', // 임시 테스트용
      },
    });

    // 상태 변경 후 재조회
    reload();
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      {actions.canApplyAI && (
        <button onClick={() => post(`/api/tax-cases/${taxCaseId}/ai-result`)}>
          AI 분석
        </button>
      )}

      {actions.canRequestReview && (
        <button onClick={() => post(`/api/tax-cases/${taxCaseId}/review`)}>
          리뷰 요청
        </button>
      )}

      {actions.canOverride && (
        <button onClick={() => post(`/api/tax-cases/${taxCaseId}/override`)}>
          AI 결과 수정
        </button>
      )}

      {actions.canApprove && (
        <button onClick={() => post(`/api/tax-cases/${taxCaseId}/approve`)}>
          승인
        </button>
      )}

      {actions.canFile && (
        <button onClick={() => post(`/api/tax-cases/${taxCaseId}/file`)}>
          신고
        </button>
      )}
    </div>
  );
}