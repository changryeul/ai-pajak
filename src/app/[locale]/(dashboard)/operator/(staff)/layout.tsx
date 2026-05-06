/**
 * 상담원(TAX_OPERATOR) 전용 5단계 워크플로우 레이아웃.
 *
 * 모든 /operator/(my-work|review-case|approval-request|coretax|history) 페이지에
 *   상단 5단계 stepper + 우상단 내 상태 카드
 * 를 자동 부착한다.
 *
 * Supervisor / Master는 별도 4-dropdown 콘솔(/operator/dashboard, /operator/workload 등)을
 * 사용하므로 이 레이아웃을 거치지 않는다.
 */

import { OperatorStepper } from '@/components/operator/OperatorStepper';
import { MyStatusCard } from '@/components/operator/MyStatusCard';

export default function OperatorStaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-[1400px] py-2">
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <OperatorStepper />
        <MyStatusCard />
      </div>
      {children}
    </div>
  );
}
