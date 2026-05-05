import { PageTitle } from '@/components/layout/PageTitle';

/**
 * 전체 케이스 (Phase 1 골격)
 * 좌측 케이스 리스트 + 우측 상세 — Phase 4 구현 예정.
 */
export default function AllCasesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <PageTitle title="전체 케이스" />
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        전체 케이스 화면 — Phase 4에서 구현됩니다.
      </div>
    </div>
  );
}
