'use client';

import { useTranslations } from 'next-intl';
import { FileX, Inbox, Search, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  titleKey?: string;
  descriptionKey?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  titleKey,
  descriptionKey,
  title,
  description,
  action,
}: EmptyStateProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        {titleKey ? t(titleKey) : title || t('empty.noData')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {descriptionKey ? t(descriptionKey) : description || t('empty.noDataDesc')}
      </p>
      {action}
    </div>
  );
}

export function NoResults() {
  return <EmptyState icon={Search} titleKey="empty.noResults" descriptionKey="empty.noResultsDesc" />;
}

export function NoDocuments() {
  return <EmptyState icon={FileX} titleKey="empty.noDocuments" descriptionKey="empty.noDocumentsDesc" />;
}
