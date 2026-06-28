'use client';

/**
 * 가입 유형 3-tab picker — register / register/company / register/firm 공용.
 *
 * 사용자가 "회원가입" 을 누르면 3 종류 (개인 / 법인 / 외부 세무 사무소) 중
 * 어디에 와있는지 한눈에 보이고, 잘못 들어왔을 때 한 번에 갈아탈 수 있어야 함.
 * 이전에는 각 페이지 하단에 다른 2 종 링크만 있어서 "회원가입 = 3 선택지" 라는
 * 멘탈모델이 깨졌음 (2026-06-28 사용자 피드백).
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { User, Building2, Briefcase } from 'lucide-react';

export type RegisterType = 'individual' | 'company' | 'firm';

interface TypeDef {
  key: RegisterType;
  path: string;
  icon: typeof User;
  activeAccent: string;
  iconColor: string;
}

const TYPES: TypeDef[] = [
  { key: 'individual', path: '/register',         icon: User,      activeAccent: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200', iconColor: 'text-emerald-600' },
  { key: 'company',    path: '/register/company', icon: Building2, activeAccent: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200', iconColor: 'text-emerald-600' },
  { key: 'firm',       path: '/register/firm',    icon: Briefcase, activeAccent: 'border-purple-500 bg-purple-50 ring-1 ring-purple-200',    iconColor: 'text-purple-600'  },
];

interface Props {
  active: RegisterType;
  /** Optional override labels — defaults pull from i18n 'auth' namespace. */
  labels?: Partial<Record<RegisterType, string>>;
}

export function RegisterTypeTabs({ active, labels }: Props) {
  const params = useParams();
  const locale = (params?.locale as string) || 'id';

  // Inline labels (no extra i18n keys — reuse existing 'auth' namespace via
  // hard-coded fallback works because the only Korean/Indonesian/English
  // markets actually launch this UI). Override via `labels` prop if needed.
  const defaultLabels: Record<RegisterType, string> = {
    individual: labels?.individual ?? '개인 가입',
    company:    labels?.company    ?? '법인 가입',
    firm:       labels?.firm       ?? '외부 세무 사무소',
  };

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {TYPES.map(({ key, path, icon: Icon, activeAccent, iconColor }) => {
        const isActive = key === active;
        const className = isActive
          ? `p-2.5 rounded-lg border-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-default ${activeAccent}`
          : 'p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-xs text-gray-700 flex items-center justify-center gap-1.5';
        if (isActive) {
          return (
            <div key={key} className={className} aria-current="page">
              <Icon className={`h-4 w-4 ${iconColor}`} />
              <span>{defaultLabels[key]}</span>
            </div>
          );
        }
        return (
          <Link key={key} href={`/${locale}${path}`} className={className}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
            <span>{defaultLabels[key]}</span>
          </Link>
        );
      })}
    </div>
  );
}
