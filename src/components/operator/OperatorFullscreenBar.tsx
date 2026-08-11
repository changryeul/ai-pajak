'use client';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 수정요청 43·44 — ID Billing 발행 / 고객 인박스를 워크큐(full-bleed)와 같은
 * 맥락에서 열도록, 대시보드 사이드바 대신 이 슬림 상단바만 얹는다.
 * 로고 + '상담원 업무함으로' 복귀 링크 + 로그아웃.
 */
export function OperatorFullscreenBar({ title }: { title: string }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const router = useRouter();
  const logout = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-gray-200 bg-white/95 px-5 py-3 backdrop-blur">
      <Image src="/logo.png" alt="AI Pajak" width={110} height={39} className="h-7 w-auto" priority />
      <a href={`/${locale}/operator/workqueue`}
        className="flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline">
        ← 상담원 업무함
      </a>
      <span className="text-sm font-black text-slate-900">{title}</span>
      <button onClick={logout}
        className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50">
        로그아웃
      </button>
    </header>
  );
}
