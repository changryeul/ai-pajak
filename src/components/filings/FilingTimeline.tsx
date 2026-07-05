'use client';

import { useTranslations } from 'next-intl';

interface TimelineEvent {
  id: string;
  action: string;
  status: string;
  notes: string | null;
  performedBy: {
    id: string;
    fullName: string;
    role: string;
  } | null;
  createdAt: string;
}

interface FilingTimelineProps {
  events: TimelineEvent[];
}

export function FilingTimeline({ events }: FilingTimelineProps) {
  const t = useTranslations();

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATED':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        );
      case 'SUBMITTED':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
        );
      case 'APPROVED':
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'REVIEWED':
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        );
      case 'UPDATED':
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        );
      case 'DOCUMENT_ADDED':
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      CUSTOMER: t('roles.customer'),
      CONSULTANT: t('roles.consultant'),
      TAX_ADVISOR: t('roles.taxAdvisor'),
      PLATFORM_ADMIN: t('roles.admin'),
    };
    return roleMap[role] || role;
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('filings.noHistory')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-4">
          {/* Timeline line */}
          {index < events.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200" />
          )}

          {/* Icon */}
          {getActionIcon(event.action)}

          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {t(`filings.actions.${event.action.toLowerCase()}`)}
                </p>
                {event.performedBy && (
                  <p className="text-sm text-gray-500">
                    {event.performedBy.fullName}
                    <span className="mx-1">·</span>
                    <span className="text-xs">{getRoleLabel(event.performedBy.role)}</span>
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {formatDate(event.createdAt)}
              </span>
            </div>
            {event.notes && (
              <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                {event.notes}
              </p>
            )}
            {event.status && (
              <p className="mt-1 text-xs text-gray-500">
                {t('filings.statusChangedTo')}: {t(`filings.status.${event.status.toLowerCase()}`)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
