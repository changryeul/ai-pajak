import { PageTitle } from '@/components/layout/PageTitle';

/**
 * 상담원 관리 (Phase 1 골격)
 * Compact 표 + Span of Control + 상담원별 관리 Supervisor 지정 — Phase 3 구현 예정.
 */
export default function OperatorTeamPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <PageTitle title="상담원 관리" />
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        상담원 관리 화면 — Phase 3에서 구현됩니다.
      </div>
    </div>
  );
}
