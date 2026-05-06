import { PageTitle } from '@/components/layout/PageTitle';

export default function ReviewCasePage() {
  return (
    <div>
      <PageTitle title="상담원 업무 화면 — 검토" />
      <h1 className="mb-2 text-2xl font-black text-slate-900">검토 — 자료·원천세·결산 확인</h1>
      <p className="mb-6 text-sm text-slate-500">고객이 제출한 자료를 확인하고, 부족분은 자료요청을 보냅니다.</p>
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Phase 3에서 3-pane 검토 화면 + Sticky 다음 작업 패널을 채웁니다.</p>
      </section>
    </div>
  );
}
