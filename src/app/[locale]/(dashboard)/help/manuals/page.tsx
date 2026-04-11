import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building2,
  Users,
  User,
  ClipboardList,
  Briefcase,
  Shield,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

export const dynamic = 'force-static';

interface RoleManual {
  slug: string;
  title: string;
  description: string;
  audience: string;
  icon: typeof Building2;
  gradient: string;
}

const MANUALS: RoleManual[] = [
  {
    slug: 'corporate',
    title: '법인 납세자',
    description: '가입 · 월 PPh21/PPh23/PPN 신고 · UMKM/Basic/Pro 요금제 · 회계 연동',
    audience: '법인 고객사 담당자 (재무, 경리, 대표)',
    icon: Building2,
    gradient: 'from-indigo-500 to-blue-600',
  },
  {
    slug: 'external',
    title: '외부 세무 사무소',
    description: '사무소 가입 · 고객 격리 · Starter/Growth/Enterprise Tier · 팀 관리',
    audience: 'JTC 외 다른 세무 사무소 소속 컨설턴트',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    slug: 'individual',
    title: '개인 납세자',
    description: 'SPT Pribadi · 1770SS/1770S/1770 · A1 OCR · 환급 · 건당 결제',
    audience: '개인 NPWP 보유자, 직장인, 프리랜서',
    icon: User,
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    slug: 'operator',
    title: '운영팀',
    description: 'djp_submission_queue 10단계 워크플로우 · Operator/Supervisor/Master',
    audience: 'JTC 운영팀 (TAX_OPERATOR, SUPERVISOR, MASTER)',
    icon: ClipboardList,
    gradient: 'from-orange-500 to-red-600',
  },
  {
    slug: 'jtc',
    title: 'JTC 세무사',
    description: '고객 배정 · 일괄 PPh21 · 이상 탐지 · 이전가격 · 팀 관리',
    audience: 'JTC 내부 CONSULTANT_JTC, TAX_ADVISOR_JTC',
    icon: Briefcase,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    slug: 'admin',
    title: '플랫폼 관리자',
    description: '사용자 · 인프라 · 모니터링 · 감사 로그 · 세율 설정 (세무 데이터 접근 불가)',
    audience: 'PLATFORM_ADMIN',
    icon: Shield,
    gradient: 'from-slate-600 to-gray-700',
  },
];

export default function ManualsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <ManualsIndexContent paramsPromise={params} />;
}

async function ManualsIndexContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ locale: string }>;
}) {
  const { locale } = await paramsPromise;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
          <BookOpen className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          사용자 매뉴얼
        </h1>
        <p className="text-gray-500 mt-1">
          역할별 상세 가이드입니다. 본인에게 해당하는 문서를 선택하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MANUALS.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.slug}
              href={`/${locale}/help/manuals/${m.slug}`}
              className="group"
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-all group-hover:-translate-y-0.5 h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${m.gradient} shadow-sm group-hover:scale-110 transition-transform flex-shrink-0`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-base text-gray-900">
                          {m.title}
                        </h3>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.audience}
                      </p>
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {m.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-8 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">용어 사전</h3>
          <p className="text-sm text-gray-600 mb-3">
            인도네시아어 세무 용어와 플랫폼 내부 용어를 모아 놓았습니다. 각
            매뉴얼 하단에도 포함되어 있습니다.
          </p>
          <Link
            href={`/${locale}/help/manuals/glossary`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            용어 사전 보기 →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
