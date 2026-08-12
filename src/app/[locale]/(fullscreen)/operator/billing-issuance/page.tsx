import IdBillingBoard from '@/components/id-billing/IdBillingBoard';
import { OperatorRail } from '@/components/operator/workqueue/OperatorRail';
import railStyles from '@/components/operator/workqueue/workqueue.module.css';

/**
 * ID Billing 발행 보드 — JTC 운영팀용 진입점.
 * 세무법인 상담원 진입점은 /consultant-erp/billing (동일 컴포넌트).
 * 접근 게이트는 (fullscreen) layout + /api/id-billing/* 미들웨어가 담당.
 * 수정요청 43·51 — 옛 대시보드 사이드바 대신 워크큐 아이콘 레일.
 */
export default function OperatorIdBillingPage() {
  return (
    <div className={railStyles.root}>
      <div className={railStyles.app}>
        <OperatorRail active="billing" />
        <main className="min-h-screen overflow-x-hidden bg-gray-50 p-4 lg:p-6">
          <IdBillingBoard />
        </main>
      </div>
    </div>
  );
}
