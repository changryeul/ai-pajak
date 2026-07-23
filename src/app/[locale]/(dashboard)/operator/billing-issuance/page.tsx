import IdBillingBoard from '@/components/id-billing/IdBillingBoard';

/**
 * ID Billing 발행 보드 — JTC 운영팀용 진입점.
 * 세무법인 상담원 진입점은 /consultant-erp/billing (동일 컴포넌트).
 * 접근 게이트는 operator layout + /api/id-billing/* 미들웨어가 담당.
 */
export default function OperatorIdBillingPage() {
  return <IdBillingBoard />;
}
