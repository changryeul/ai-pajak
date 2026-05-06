import { PageTitle } from '@/components/layout/PageTitle';

export default function OperatorHistoryPage() {
  return (
    <div>
      <PageTitle title="상담원 업무 화면 — 이력" />
      <h1 className="mb-2 text-2xl font-black text-slate-900">상담 / 처리 이력</h1>
      <p className="mb-6 text-sm text-slate-500">
        선택 고객의 메시지, 자료요청, 검토수정, Coretax 처리, NTPN 확인, 신고완료 이력을 한 곳에서 봅니다.
      </p>
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Phase 6에서 케이스/회사/내 고객 통합 타임라인을 채웁니다.</p>
      </section>
    </div>
  );
}
