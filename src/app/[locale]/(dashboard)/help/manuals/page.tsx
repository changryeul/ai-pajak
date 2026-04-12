import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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

interface RoleManual {
  slug: string;
  title: string;
  description: string;
  audience: string;
  icon: typeof Building2;
  gradient: string;
}

const MANUAL_SLUGS = ['corporate', 'external', 'individual', 'operator', 'jtc', 'admin'] as const;
const MANUAL_ICONS: Record<string, typeof Building2> = {
  corporate: Building2,
  external: Users,
  individual: User,
  operator: ClipboardList,
  jtc: Briefcase,
  admin: Shield,
};
const MANUAL_GRADIENTS: Record<string, string> = {
  corporate: 'from-indigo-500 to-blue-600',
  external: 'from-emerald-500 to-teal-600',
  individual: 'from-purple-500 to-pink-600',
  operator: 'from-orange-500 to-red-600',
  jtc: 'from-amber-500 to-orange-500',
  admin: 'from-slate-600 to-gray-700',
};

export default async function ManualsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('manuals');

  const MANUALS: RoleManual[] = MANUAL_SLUGS.map((slug) => ({
    slug,
    title: t(`${slug}_title`),
    description: t(`${slug}_desc`),
    audience: t(`${slug}_audience`),
    icon: MANUAL_ICONS[slug],
    gradient: MANUAL_GRADIENTS[slug],
  }));

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
          <BookOpen className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('pageTitle')}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('pageDesc')}
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
          <h3 className="font-semibold text-gray-900 mb-2">{t('glossaryTitle')}</h3>
          <p className="text-sm text-gray-600 mb-3">
            {t('glossaryDesc')}
          </p>
          <Link
            href={`/${locale}/help/manuals/glossary`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {t('glossaryLink')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
