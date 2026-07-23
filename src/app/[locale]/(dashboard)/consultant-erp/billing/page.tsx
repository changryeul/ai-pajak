import IdBillingBoard from '@/components/id-billing/IdBillingBoard';

/**
 * ID Billing 발행 보드 — 세무법인 상담원용 진입점 (JTC + EXTERNAL).
 * 운영팀 진입점은 /operator/billing-issuance (동일 컴포넌트).
 */
export default function ConsultantIdBillingPage() {
  return <IdBillingBoard />;
}
