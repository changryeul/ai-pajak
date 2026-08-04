'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';
import {
  User, Upload, FileSpreadsheet, ShieldCheck, CreditCard, Send,
  CheckCircle2, Circle, ArrowRight, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

interface StepStatus {
  profile: boolean;
  upload: boolean;
  sptGenerated: boolean;
  validated: boolean;
  paid: boolean;
  filed: boolean;
}

interface Step {
  id: keyof StepStatus;
  icon: typeof User;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  gradient: string;
}

export function NextStepsWizard({ customerId }: { customerId?: string }) {
  const params = useParams();
  const locale = params.locale as string;
  const tw = useTranslations('wizard');
  const [status, setStatus] = useState<StepStatus>({
    profile: false, upload: false, sptGenerated: false,
    validated: false, paid: false, filed: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const steps: Step[] = [
    {
      id: 'profile', icon: User,
      title: 'Lengkapi Profil',
      description: 'Pastikan NPWP dan NIK sudah terisi',
      href: `/${locale}/settings`,
      ctaLabel: 'Isi Profil',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'upload', icon: Upload,
      title: 'Upload Bukti Potong',
      description: 'Upload Form 1721-A1 dari pemberi kerja Anda',
      href: `/${locale}/documents`,
      ctaLabel: 'Upload Sekarang',
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      id: 'sptGenerated', icon: FileSpreadsheet,
      title: 'Buat SPT',
      description: 'AI otomatis mengisi SPT dari dokumen Anda',
      href: `/${locale}/tax/spt-tahunan`,
      ctaLabel: 'Buat SPT',
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      id: 'validated', icon: ShieldCheck,
      title: 'Validasi SPT',
      description: 'AI memeriksa kesalahan sebelum submit',
      href: `/${locale}/tax/spt-tahunan`,
      ctaLabel: 'Validasi',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      id: 'paid', icon: CreditCard,
      title: 'Bayar Pajak',
      description: 'Bayar menggunakan e-Billing',
      href: `/${locale}/tax/monthly-payments`,
      ctaLabel: 'Bayar',
      gradient: 'from-red-500 to-rose-600',
    },
    {
      id: 'filed', icon: Send,
      title: 'Lapor ke DJP',
      description: 'Submit SPT dan dapatkan BPE',
      href: `/${locale}/filings`,
      ctaLabel: 'Lapor',
      gradient: 'from-cyan-500 to-blue-600',
    },
  ];

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    const s: StepStatus = { profile: false, upload: false, sptGenerated: false, validated: false, paid: false, filed: false };

    try {
      // Check profile
      const profileRes = await fetch('/api/auth/me');
      const profileData = await profileRes.json();
      if (profileData.success && profileData.user?.npwp) {
        s.profile = true;
      }

      // Check documents
      const docsRes = await fetch('/api/documents?limit=1');
      const docsData = await docsRes.json();
      if (docsData.success && docsData.data?.length > 0) {
        s.upload = true;
      }

      // Check SPT generated (from sessionStorage)
      if (typeof window !== 'undefined') {
        const sptKey = Object.keys(sessionStorage).find(k => k.startsWith('spt1770ss_'));
        if (sptKey) {
          const sptData = JSON.parse(sessionStorage.getItem(sptKey) || '{}');
          if (sptData.sptData) s.sptGenerated = true;
          if (sptData.step === 'preview') s.validated = true;
        }

        const validationKey = Object.keys(sessionStorage).find(k => k.startsWith('spt_validation_'));
        if (validationKey) s.validated = true;
      }

      // Check filings
      if (customerId) {
        // Use stored completion from localStorage
        const completions = JSON.parse(localStorage.getItem('ai-pajak-completions') || '{}');
        if (completions.paid) s.paid = true;
        if (completions.filed) s.filed = true;
      }
    } catch { /* */ }

    setStatus(s);
    setIsLoading(false);
  }, [customerId]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Find current step (first incomplete)
  const currentStepIndex = steps.findIndex(step => !status[step.id]);
  const completedCount = steps.filter(step => status[step.id]).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  // Don't show if dismissed or all complete
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem('ai-pajak-wizard-dismissed') === 'true');
    }
  }, []);

  if (dismissed || isLoading) return null;

  if (allComplete) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-500"><CheckCircle2 className="h-6 w-6 text-white" /></div>
          <div className="flex-1">
            <h3 className="font-bold text-green-900">{tw('allDone')}</h3>
            <p className="text-sm text-green-700">{tw('allDoneDesc')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setDismissed(true); localStorage.setItem('ai-pajak-wizard-dismissed', 'true'); }}>
            {tw('close')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-yellow-300" />
          <div>
            <h3 className="font-bold text-sm">{tw('nextStep')}</h3>
            <p className="text-blue-200 text-xs">{completedCount}/{steps.length} {tw('completed')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="w-20 h-2 bg-blue-400" />
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>

      {!isCollapsed && (
        <CardContent className="p-0">
          {/* Current Step - Highlighted */}
          {currentStep && (
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${currentStep.gradient} shadow-lg shadow-blue-500/20 animate-pulse`}>
                  <currentStep.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 font-medium">Step {currentStepIndex + 1}</p>
                  <h4 className="font-bold text-gray-900">{currentStep.title}</h4>
                  <p className="text-sm text-gray-600">{currentStep.description}</p>
                </div>
                <Link href={currentStep.href}>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
                    {currentStep.ctaLabel}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* All Steps - Compact */}
          <div className="p-4 space-y-1">
            {steps.map((step, index) => {
              const isComplete = status[step.id];
              const isCurrent = index === currentStepIndex;
                            
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all ${
                    isCurrent ? 'bg-blue-50' : ''
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : isCurrent ? (
                    <div className={`p-1 rounded-full bg-gradient-to-br ${step.gradient}`}>
                      <Circle className="h-3 w-3 text-white" />
                    </div>
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${
                    isComplete ? 'text-gray-400 line-through' :
                    isCurrent ? 'text-gray-900 font-medium' :
                    'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                  {isComplete && <span className="text-[10px] text-green-500">✓</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
