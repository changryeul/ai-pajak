import { PageTitle } from '@/components/layout/PageTitle';

export default function MyWorkPage() {
  return (
    <div>
      <PageTitle title="상담원 업무 화면 — 내 업무" />
      <h1 className="mb-2 text-2xl font-black text-slate-900">상담원 업무 화면</h1>
      <p className="mb-6 text-sm text-slate-500">
        복잡한 내부 메뉴 대신, 고객 한 명을 선택하고 아래 5단계만 순서대로 처리합니다.
      </p>
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Phase 2에서 「오늘 처리할 고객」 카드 + KPI + 빠른 필터를 채웁니다.</p>
      </section>
    </div>
  );
}
