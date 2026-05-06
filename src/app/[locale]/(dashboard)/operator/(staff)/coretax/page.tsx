import { PageTitle } from '@/components/layout/PageTitle';

export default function CoretaxPage() {
  return (
    <div>
      <PageTitle title="상담원 업무 화면 — Coretax 처리" />
      <h1 className="mb-2 text-2xl font-black text-slate-900">Coretax 처리</h1>
      <p className="mb-6 text-sm text-slate-500">
        Supervisor 승인 후 상담원이 Coretax에 접속해 ID Billing 발행, NTPN 확인, 신고완료/BPE 반영을 처리합니다.
      </p>
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Phase 5에서 Coretax 4단계 + 체크리스트 + 수동 로그를 채웁니다.</p>
      </section>
    </div>
  );
}
