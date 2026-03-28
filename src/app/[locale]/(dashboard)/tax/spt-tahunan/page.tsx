'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Building2,
  Briefcase,
  User,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Upload,
} from 'lucide-react';

interface SPTFormOption {
  id: string;
  title: string;
  description: string;
  targetAudience: string;
  icon: React.ElementType;
  href: string;
  features: string[];
  gradient: string;
  iconBg: string;
}

export default function SPTTahunanPage() {
  const t = useTranslations('tax');
  const ts = useTranslations('sptSelect');

  const sptForms: SPTFormOption[] = [
    {
      id: '1770ss',
      title: 'SPT 1770 SS',
      description: ts('ss_desc'),
      targetAudience: ts('ss_audience'),
      icon: User,
      href: '/tax/spt-tahunan/1770ss',
      features: [ts('ss_f1'), ts('ss_f2'), ts('ss_f3')],
      gradient: 'from-green-500 to-emerald-600',
      iconBg: 'bg-green-50',
    },
    {
      id: '1770s',
      title: 'SPT 1770 S',
      description: ts('s_desc'),
      targetAudience: ts('s_audience'),
      icon: FileText,
      href: '/tax/spt-tahunan/1770s',
      features: [ts('s_f1'), ts('s_f2'), ts('s_f3')],
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-50',
    },
    {
      id: '1770',
      title: 'SPT 1770',
      description: ts('full_desc'),
      targetAudience: ts('full_audience'),
      icon: Briefcase,
      href: '/tax/spt-tahunan/1770',
      features: [ts('full_f1'), ts('full_f2'), ts('full_f3'), ts('full_f4')],
      gradient: 'from-purple-500 to-violet-600',
      iconBg: 'bg-purple-50',
    },
    {
      id: '1771',
      title: 'SPT 1771',
      description: ts('badan_desc'),
      targetAudience: ts('badan_audience'),
      icon: Building2,
      href: '/tax/spt-tahunan/1771',
      features: [ts('badan_f1'), ts('badan_f2'), ts('badan_f3'), ts('badan_f4')],
      gradient: 'from-orange-500 to-red-500',
      iconBg: 'bg-orange-50',
    },
  ];
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-700 bg-yellow-50 px-2.5 py-0.5 rounded-full">AI Auto-fill Available</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('sptTahunan.title')}
        </h1>
        <p className="text-gray-500 mt-1">
          {ts('subtitle')}
        </p>
      </div>

      {/* SPT Form Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sptForms.map((form) => {
          const Icon = form.icon;

          return (
            <Card
              key={form.id}
              className="group cursor-pointer border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              onClick={() => router.push(`/${locale}${form.href}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${form.gradient} shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg tracking-tight">{form.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {form.description}
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all mt-1" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  {form.targetAudience}
                </p>

                <div className="space-y-2">
                  {form.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="mt-8 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <CardContent className="py-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              {ts('notSureForm')}
            </h3>
            <p className="text-sm text-gray-600">
              {ts('uploadHint')}
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white shadow-sm shrink-0 ml-4"
            onClick={() => router.push(`/${locale}/documents`)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {ts('uploadDoc')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
