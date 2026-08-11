import IdBillingBoard from '@/components/id-billing/IdBillingBoard';
import { OperatorFullscreenBar } from '@/components/operator/OperatorFullscreenBar';

/**
 * ID Billing 발행 보드 — JTC 운영팀용 진입점.
 * 세무법인 상담원 진입점은 /consultant-erp/billing (동일 컴포넌트).
 * 접근 게이트는 (fullscreen) layout + /api/id-billing/* 미들웨어가 담당.
 * 수정요청 43 — 대시보드 사이드바(예전 메뉴) 대신 워크큐 맥락의 상단바.
 */
export default function OperatorIdBillingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <OperatorFullscreenBar title="ID Billing 발행" />
      <div className="p-4 lg:p-6">
        <IdBillingBoard />
      </div>
    </div>
  );
}
