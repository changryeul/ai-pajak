'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  User,
  Upload,
  FileSpreadsheet,
  Lightbulb,
  ShieldCheck,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface GuideStep {
  id: string;
  icon: typeof User;
  title: string;
  description: string;
  href: string;
  checkFn?: () => Promise<boolean>;
  gradient: string;
}

interface GettingStartedGuideProps {
  customerId?: string;
  userName?: string;
}

export function GettingStartedGuide({ customerId: _customerId, userName: _userName }: GettingStartedGuideProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [dismissed, setDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [_isChecking, setIsChecking] = useState(true);

  const steps: GuideStep[] = [
    {
      id: 'profile',
      icon: User,
      title: t('guide.completeProfile'),
      description: t('guide.completeProfileDesc'),
      href: `/${locale}/my-profile`,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'upload',
      icon: Upload,
      title: t('guide.uploadBuktiPotong'),
      description: t('guide.uploadBuktiPotongDesc'),
      href: `/${locale}/documents`,
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      id: 'spt',
      icon: FileSpreadsheet,
      title: t('guide.createSptTahunan'),
      description: t('guide.createSptDesc'),
      href: `/${locale}/tax/spt-tahunan/1770ss`,
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      id: 'savings',
      icon: Lightbulb,
      title: t('guide.checkSavings'),
      description: t('guide.checkSavingsDesc'),
      href: `/${locale}/tax/savings`,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      id: 'validate',
      icon: ShieldCheck,
      title: t('guide.validateSpt'),
      description: t('guide.validateSptDesc'),
      href: `/${locale}/tax/spt-tahunan`,
      gradient: 'from-red-500 to-rose-600',
    },
  ];

  // Declared with useCallback so the useEffect below can list it as a
  // dependency AND so the function reference exists before useEffect tries
  // to call it on first render. (The previous form used a `const` declared
  // after the effect, which the React 19 lint flags as TDZ access — the
  // effect runs after mount so it worked in practice, but the lint is right
  // that hoisting via useCallback is the canonical fix.)
  const checkSteps = useCallback(async () => {
    setIsChecking(true);
    const completed = new Set<string>();

    try {
      // Check profile — consider "complete" once basic signup fields (name + email) are set.
      // NPWP is optional at signup and the user can add it later from the 내 정보 page.
      const profileRes = await fetch('/api/auth/me');
      const profileData = await profileRes.json();
      if (profileData.success && profileData.user) {
        const u = profileData.user;
        if (u.fullName && u.email) {
          completed.add('profile');
        }
      }

      // Check if any documents uploaded
      const docsRes = await fetch('/api/documents?limit=1');
      const docsData = await docsRes.json();
      if (docsData.success && docsData.data && docsData.data.length > 0) {
        completed.add('upload');
      }

      // Merge with locally saved completions
      const saved = localStorage.getItem('ai-pajak-guide-completed');
      if (saved) {
        try {
          JSON.parse(saved).forEach((s: string) => completed.add(s));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    setCompletedSteps(completed);
    localStorage.setItem('ai-pajak-guide-completed', JSON.stringify([...completed]));
    setIsChecking(false);
  }, []);

  useEffect(() => {
    // Check if dismissed
    if (typeof window !== 'undefined') {
      const d = localStorage.getItem('ai-pajak-guide-dismissed');
      if (d) setDismissed(true);

      // Load completed steps
      const saved = localStorage.getItem('ai-pajak-guide-completed');
      if (saved) {
        try {
          setCompletedSteps(new Set(JSON.parse(saved)));
        } catch { /* ignore */ }
      }
    }

    // Check profile completion
    checkSteps();
  }, [checkSteps]);

  const markComplete = (stepId: string) => {
    const next = new Set(completedSteps);
    next.add(stepId);
    setCompletedSteps(next);
    localStorage.setItem('ai-pajak-guide-completed', JSON.stringify([...next]));
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('ai-pajak-guide-dismissed', 'true');
  };

  if (dismissed || completedSteps.size >= steps.length) return null;

  const progress = (completedSteps.size / steps.length) * 100;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-blue-50/30 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">
              {t('guide.title')}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 -mr-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-gray-500 font-medium">{completedSteps.size}/{steps.length}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.has(step.id);

            return (
              <Link
                key={step.id}
                href={step.href}
                onClick={() => markComplete(step.id)}
                className={`group flex items-center gap-3 rounded-xl p-3 transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-50/50 opacity-60'
                    : 'hover:bg-white hover:shadow-sm'
                }`}
              >
                {isCompleted ? (
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${step.gradient} shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{step.description}</p>
                </div>
                {!isCompleted && (
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default GettingStartedGuide;
