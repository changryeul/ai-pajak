'use client';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RequiredFieldDef } from '@/hooks/useRequiredFields';

/**
 * 필수 미입력 항목 입력유도 배너. (2026-08-30)
 * MASTER 가 지정한 필수항목 중 비어 있는 것을 상단에 모아 보여준다.
 */
export function RequiredFieldsBanner({ missing }: { missing: RequiredFieldDef[] }) {
  const t = useTranslations('requiredFields');
  if (missing.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        {t('bannerTitle', { count: missing.length })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {missing.map(f => (
          <span key={f.fieldKey} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-amber-800 border border-amber-200">
            <span className="font-bold text-red-500">*</span>{f.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-amber-700">{t('bannerHint')}</p>
    </div>
  );
}

/** 라벨 옆 필수 별표. */
export function RequiredMark({ required }: { required: boolean }) {
  const t = useTranslations('requiredFields');
  if (!required) return null;
  return <span className="ml-0.5 font-bold text-red-500" title={t('markTitle')}>*</span>;
}
