'use client';

/**
 * 설정 / 양식버전 / Tax Code Rules (PDF p.23 명세 기준)
 *
 * 헤더 카드 3개 (귀속연도 / 플랫폼 / Coretax 상태) + Badan Form Profile
 * 카드 + OP Form Profile 카드. 현재는 정적 안내 페이지 — 향후 phase에서
 * 실제 룰셋 + Coretax API 연동 토글로 확장.
 */

import { PageTitle } from '@/components/layout/PageTitle';

export default function OperatorSettingsPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-[1200px]">
      <PageTitle title="설정 / 양식버전" />
      <h1 className="text-2xl font-black text-slate-900 mb-4">설정 / 양식버전 / Tax Code Rules</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Header label="귀속연도" value="2025" />
        <Header label="플랫폼" value="Coretax DJP" />
        <Header label="Coretax 상태" value="API 미연동 / 수동처리" tone="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Badan Form Profile</h2>
          <p className="text-sm text-slate-700 mt-2">
            2025년 귀속분부터 Coretax 기준 입력 흐름과 첨부/부속명세 구조를 따른다.
            구 e-Form/e-Filing 1771 화면을 그대로 복제하지 않는다.
          </p>
          <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
            Legacy: 1771
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">OP Form Profile</h2>
          <p className="text-sm text-slate-700 mt-2">
            2025년 귀속분부터 개인 SPT는 1770/1770S/1770SS 선택 화면이 아니라
            Coretax 단일 OP Form 기준으로 처리한다.
          </p>
          <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
            Legacy: 1770 / 1770S / 1770SS
          </p>
        </section>
      </div>
    </div>
  );
}

function Header({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-base font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
