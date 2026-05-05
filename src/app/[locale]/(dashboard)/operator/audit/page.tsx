import { PageTitle } from '@/components/layout/PageTitle';

/**
 * 감사로그 — 케이스 단위 변경 이력 (Phase 1 골격)
 * Phase 4에서 audit_log 기반으로 구현 예정.
 */
export default function OperatorAuditPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <PageTitle title="감사로그 / 변경이력" />
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        감사로그 화면 — Phase 4에서 구현됩니다.
      </div>
    </div>
  );
}
