import { PageTitle } from '@/components/layout/PageTitle';

export default function ApprovalRequestPage() {
  return (
    <div>
      <PageTitle title="상담원 업무 화면 — 승인요청" />
      <h1 className="mb-2 text-2xl font-black text-slate-900">Supervisor 승인요청 (Final Review)</h1>
      <p className="mb-6 text-sm text-slate-500">자료와 세금 검토가 끝난 케이스를 Supervisor에게 상신합니다.</p>
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Phase 4에서 최종 원천세 적용값 편집 + 체크 게이트를 채웁니다.</p>
      </section>
    </div>
  );
}
