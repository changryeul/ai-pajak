'use client';

import { useTranslations } from 'next-intl';
import { Shield, Lock, CheckCircle, Award } from 'lucide-react';

export function TrustBadges({ variant = 'horizontal' }: { variant?: 'horizontal' | 'vertical' }) {
  const t = useTranslations('trust');

  const badges = [
    { icon: Award, labelKey: 'djpPartner', color: 'text-blue-600' },
    { icon: Lock, labelKey: 'encrypted', color: 'text-green-600' },
    { icon: Shield, labelKey: 'secure', color: 'text-purple-600' },
    { icon: CheckCircle, labelKey: 'certified', color: 'text-orange-600' },
  ];

  if (variant === 'vertical') {
    return (
      <div className="space-y-3">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div key={badge.labelKey} className="flex items-center gap-2 text-sm text-gray-500">
              <Icon className={`h-4 w-4 ${badge.color}`} />
              <span>{t(badge.labelKey)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <div key={badge.labelKey} className="flex items-center gap-1.5 text-xs text-gray-500">
            <Icon className={`h-3.5 w-3.5 ${badge.color}`} />
            <span>{t(badge.labelKey)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DJPPartnerBanner() {
  const t = useTranslations('trust');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <Award className="h-5 w-5 text-blue-600 shrink-0" />
      <div>
        <p className="text-sm font-medium text-blue-900">{t('djpOfficialPartner')}</p>
        <p className="text-xs text-blue-600">{t('djpOfficialDesc')}</p>
      </div>
    </div>
  );
}
