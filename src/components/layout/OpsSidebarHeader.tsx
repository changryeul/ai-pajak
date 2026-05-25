'use client';

/**
 * Supervisor / Master / Operator 전용 사이드바 상단 영역.
 *
 * PDF 「AI Pajak 수퍼바이저 화면_메신저 포함_20260525」 p.1 의 좌측 사이드바
 * 상단 구성을 재현:
 *   1. "AI Pajak Ops" 타이틀 + role 별 서브타이틀
 *   2. 사용자 카드 (이름 · role short code)
 *   3. 언어 선택 (사이드바 inline dropdown)
 *   4. "실제 작업자 로그인 전환" 표시 박스 + 안내문
 *   5. "내 고객/케이스 검색" 입력 (display-only — 검색 동작은 후속 트랙)
 *
 * 다크 배경(slate-900) 위에 light text. 사이드바 root 의 그라데이션과
 * 시각적으로 분리되도록 위쪽에 어두운 패널을 깐다.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ChevronDown, Search } from 'lucide-react';
import { LOCALE_NAMES, LOCALES, type Locale } from '@/config/constants';
import { UserRole } from '@/types/auth';
import type { ClientSessionContext } from '@/hooks/useSession';
import { cn } from '@/lib/utils';

interface Props {
  session: ClientSessionContext;
}

export function OpsSidebarHeader({ session }: Props) {
  const t = useTranslations('supervisorSidebar');
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = (params?.locale as Locale) ?? 'id';

  const [langOpen, setLangOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { subTitle, roleShort } = useMemo(() => {
    if (session.role === UserRole.TAX_OPERATOR_MASTER) {
      return { subTitle: t('subTitleMaster'), roleShort: t('roleShortMaster') };
    }
    if (
      session.role === UserRole.TAX_OPERATOR_SUPERVISOR ||
      session.role === UserRole.TAX_OPERATOR_LEAD
    ) {
      return { subTitle: t('subTitleSupervisor'), roleShort: t('roleShortSV') };
    }
    return { subTitle: t('subTitleOperator'), roleShort: t('roleShortOperator') };
  }, [session.role, t]);

  const displayName = session.fullName || session.email?.split('@')[0] || 'User';

  const handleLocaleChange = (next: Locale) => {
    const nextPath = pathname.replace(`/${currentLocale}`, `/${next}`);
    router.push(nextPath);
    setLangOpen(false);
  };

  return (
    <div className="bg-slate-950 text-slate-100 px-5 pt-5 pb-4 space-y-3">
      {/* 1. Title + subtitle */}
      <div>
        <p className="text-base font-bold text-white tracking-tight">{t('appTitle')}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{subTitle}</p>
      </div>

      {/* 2. User badge */}
      <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-100">
        <span className="font-semibold">{displayName}</span>
        <span className="text-slate-400"> · {roleShort}</span>
      </div>

      {/* 3. Language */}
      <div>
        <p className="text-[10px] text-slate-400 mb-1">{t('languageLabel')}</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-100 hover:bg-slate-700"
          >
            <span>{LOCALE_NAMES[currentLocale]}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
              <div className="absolute z-40 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg">
                {LOCALES.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleLocaleChange(loc)}
                    className={cn(
                      'flex w-full items-center px-3 py-1.5 text-xs',
                      loc === currentLocale
                        ? 'bg-blue-900/40 text-blue-200 font-medium'
                        : 'text-slate-200 hover:bg-slate-800',
                    )}
                  >
                    {LOCALE_NAMES[loc]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Actor switch — display-only. Real cross-actor switch lives on the
          login screen (or via a second browser tab as the note explains). */}
      <div>
        <p className="text-[10px] text-slate-400 mb-1">{t('actorSwitchLabel')}</p>
        <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-100 flex items-center justify-between">
          <span className="truncate">
            {roleShort === t('roleShortSV') ? 'Supervisor' : roleShort === t('roleShortMaster') ? 'Master' : 'Staff'}{' '}
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <p className="text-[10px] text-slate-500 leading-4 mt-1.5">
          {t('actorSwitchNote')}
        </p>
      </div>

      {/* 5. Search box — display-only for now. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg bg-slate-800/80 pl-8 pr-2 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:bg-slate-700"
        />
      </div>
    </div>
  );
}
